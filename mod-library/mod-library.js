class Shelf{
  constructor(obj,keys = []){
    this.data = obj;
    for(let key of keys){
      if(this.data[key]){
        Object.defineProperty(this,key,{
          get: () => {
            let nkey = `_${key}`;
            if(!this[nkey]){
              this[nkey] = Shelf.flatten(this.data[key]);
            }
            return this[nkey]
          }
        });
      }else{
        Object.defineProperty(this,key,{
          get: () => {
            let nkey = `_${key}`;
            if(!this[nkey]){
              this[nkey] = Shelf.flatten(this.data,key);
            }
            return this[nkey]
          }
        });
      }
    }
  }
  _any = null;
  get any(){
    if(!this._any){
      this._any = Shelf.flatten(this.data)
    }
    return this._any
  }
  
  static from(obj){
    let keys = Shelf.getKeys(obj,2);
    return new Shelf(obj,keys)
  }
  
  static getKeys(obj,depth = 2){
    if(depth < 1 || Array.isArray(obj)){
      return [];
    }
    let a = [];
    for(let key of Object.keys(obj)){
      a.push(key);
      a.push(Shelf.getKeys(obj[key],--depth))
    }
    return a.flat()
  }
  
  static flatten(obj,key){
    if(Array.isArray(obj)){
      return obj
    }
    let a = [];
    for(let k of Object.keys(obj)){
      if(!key || k === key){
        let o = obj[k];
        if(Array.isArray(o)){
          a.push(o)
        }else{
          a.push(Shelf.flatten(o,key))
        }
      }else if(!Array.isArray(obj[k])){
        a.push(Shelf.flatten(obj[k],key))
      }
    }
    return a.flat()
  }
  
}

class Library{
  
  constructor(){
    this.data = new Map();
  }
  
  static fetchAsJSON(filename){
    return new Promise((resolve,reject) => {
      fetch(filename)
      .then(res => res.json())
      .then(a => resolve(a))
      .catch((e)=>{reject(`@${filename}: ${e}`)})
    })
  }
  
  static loadFiles(files){
    return new Promise((res,rej) => {
      Promise.all([
        Library.resolveOnReady(),
        Promise.all(files.map(Library.fetchAsJSON))
      ])
      .then(results => res(results[1]))
      .catch(rej)
    });
  }
  
  static resolveOnReady(obj){
    const timeout = obj && obj.ms;
    return new Promise((res,rej) => {
      if(document.readyState === "complete"){
        res();
        return
      }
      timeout && setTimeout(rej,timeout);
      document.onreadystatechange = function () {
        if (document.readyState === "complete") {
          res()
        }
      }
    })
  }
  
  addMappedGetter(def){
    const error = "cannot add mapped getter: ";
    if(!(def.property && def.name && (def.mapper || def.key))){
      throw error + "getter must have a specified name, property and either mapper or key"
    }
    
    const shelf = this[def.property];
    
    if(!shelf){
      throw `${error}property "${def.property}" doesn't exist`
    }
    if(!Array.isArray(shelf)){
      throw `${error}item "${def.property}" is not iterable`
    }
    const map = new Map();
    if(def.mapper){
      if(typeof def.mapper != "function"){
        throw `${error}definition of "mapper" is not a function`
      }
      for(let item of shelf){
        map.set(def.mapper(item),item)
      } 
    }else if(typeof def.key === "string"){
      for(let item of shelf){
        map.set(item[def.key],item)
      }
      
    }else{
      throw `${error}key: "${def.key}" cannot be used to map items because it's not a string`
    }
    const id = def.id || Symbol();
    this.data.set(id,map);
    Object.defineProperty(this,def.name,{value:(some) => map.get(some)})
    return this
  }
  
  populateNamed(obj){
    return new Promise((res,rej) => {

      let names = Object.keys(obj);
      let filenames = [];
      for(let name of names){
        filenames.push(obj[name].file)
      }
      Library.loadFiles(filenames)
      .then(arr => {
        for(let i = 0; i < arr.length; i++){
          let desc = obj[names[i]];
          const key = desc.key || Symbol();
          if(typeof desc.transform === "function"){
            this.data.set(key,desc.transform(arr[i]));
          }else if(desc.transform === null){
            this.data.set(key,arr[i])
          }else{
            this.data.set(key,Shelf.from(arr[i]));
          }
          Object.defineProperty(this,names[i],{get:()=>this.data.get(key)});
          if(desc.mappedGetter){
            desc.mappedGetter.property = names[i];
            try{
              this.addMappedGetter(desc.mappedGetter);
            }catch(e){
              console.error(e)
            }
          }
        }
      })
      .then(()=>res(this))
      .catch(rej)
    })
  }

}

export{ Library }