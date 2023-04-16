export class TreeView extends HTMLElement{
  #layerTransformer;
  constructor(){
    super();
    this.refSet = new Map();
    
    let template = document.getElementById('tree-template');
    let templateContent = template ? template.content : TreeView.TreeWrapper;
    let cloned = templateContent.cloneNode(true);
    const shadowRoot = this.attachShadow({mode: 'open'});
    shadowRoot.appendChild(cloned)
    const treeRoot = TreeView.Node.cloneNode(true);
    treeRoot.firstChild.firstChild.textContent = ":root";
    treeRoot.firstChild.classList.add("root");
    treeRoot.firstChild.setAttribute("part","tree");
    shadowRoot.appendChild(treeRoot);
  }
  
  static Node = (function(){
    const frag = new DocumentFragment();
    frag.appendChild(document.createElement("details"))
    .appendChild(document.createElement("summary"));

    return frag
  })();
  
  static TreeWrapper = (function(){
    const frag = new DocumentFragment();
    let link = document.createElement("link");
    link.setAttribute("type","text/css");
    link.setAttribute("rel","preload prefetch stylesheet");
    link.setAttribute("href","tree-view/tree-view.css");
    frag.appendChild(link);

    return frag
  })();
  
  static produceLoadedEvent(instance, b){
    instance.dispatchEvent(new CustomEvent("dataload", {"detail":{"success": b},"bubbles":false, "cancelable":false}));
  }
  static createTargetIdFor(detail){
    if(detail.hasAttribute("id")){
      return  detail.id
    }
    let s = "i";
    for(let i = 0; i < 4; i++){
      let i = Math.floor(Math.random() * 256);
      s += i.toString(16)
    }
    detail.id = s;
    detail.tabIndex = 0;
    return s
  }
  setLayerTransform(fun){
    if(typeof fun === "function" || fun === null){
      this.#layerTransformer = fun
    }
    return this
  }
  get tree(){
    return this.shadowRoot.querySelector("details");
  }
  
  static TYPE_OBJECT = Symbol("object");
  static TYPE_ARRAY = Symbol("array");
  static TYPE_STRING = Symbol("string");
  static TYPE_FUNCTION = Symbol("function");
  static TYPE_NULL = Symbol("null");
  static TYPE_UNDEFINED = Symbol("undefined");
  static TYPE_NUMBER = Symbol("number");
  
  static isContainer = (type) => (type === this.TYPE_OBJECT || type === this.TYPE_ARRAY);
  
  static createRootLayer(obj,aTreeView,type,isJson){
    const frag = new DocumentFragment();
    if(this.isContainer(type)){
      let keys = Object.getOwnPropertyNames(obj);
      if(type === this.TYPE_ARRAY){
        keys.pop();
      }
      
      for(let key of keys){
        const valuetype = this.getTypeOf(obj,key);
        if(this.isContainer(valuetype)){
          const treeContent = isJson 
          ? this.createSafeLayer( key, obj[key], aTreeView.#layerTransformer, valuetype )
          : this.createLayer( key, obj[key], aTreeView.refSet, aTreeView.#layerTransformer, valuetype );
          frag.appendChild(treeContent)
        }else{
          frag.appendChild( this.createLeafNode(key,obj,aTreeView.#layerTransformer,valuetype) )
        }
      }
    }
    return frag
  }
  
  static createLeafNode(name,obj,transformer,type){
    const details = this.Node.firstChild.cloneNode(true);
    const visualname = transformer
          ? transformer(details,name)
          : name;
    if(visualname === this.IGNORE_LAYER){
      return null
    }
    
    const summary = details.firstChild;
    summary.append(visualname);
    summary.classList.add(type.description);
    let div = document.createElement("div");
    switch(type){
      case this.TYPE_STRING:
        div.classList.add("string");
      case this.TYPE_NUMBER:
        let text = obj[name];
        div.append(text);
        if(text.length > 30){
          summary.setAttribute("data-label",text.slice(0,27)+"...")
        }else{
          summary.setAttribute("data-label",text)
        } 
        break;
      case this.TYPE_NULL:
      case this.TYPE_UNDEFINED:
        div.append(type.description);
        break
      default:
        div.append(obj[name].toString());
    }
    details.appendChild(div);
    return details
  }
  
  static createBaseLayer(obj,type,name,transformer){
    const layer = this.Node.firstChild.cloneNode(true);
    layer.firstChild.classList.add(type.description);
    
    const visualname = transformer
          ? transformer(layer,name)
          : name;
    if(visualname === this.IGNORE_LAYER){
      return {layer: null,keys:null}
    }
    
    layer.firstChild.append(visualname);
    let keys = Object.getOwnPropertyNames(obj);
    if(type === this.TYPE_ARRAY){
      keys.pop();
      layer.firstChild.setAttribute("data-label",obj.length)
    }
    return {layer,keys}
  }
  
  static IGNORE_LAYER = Symbol("ignore");
  
  static createSafeLayer(name,obj,transformer,type){
    
    const {layer,keys} = this.createBaseLayer(obj,type,name,transformer);
    
    if(layer === null){
      return null
    }
    
    for(let key of keys){
      const valuetype = this.getTypeOf(obj,key);
      const sublayer = this.isContainer(valuetype)
            ? this.createSafeLayer(key,obj[key],transformer,valuetype)
            : this.createLeafNode(key,obj,transformer,valuetype);
      if(sublayer){
        layer.appendChild(sublayer)
      }
    }
    return layer
  }
  
  static createLayer(name,obj,refSet,transformer,type){
    
    const {layer,keys} = this.createBaseLayer(obj,type,name,transformer);
    
    if(layer === null){
      return null
    }
    
    if(!refSet.has(obj)){
      refSet.set(obj,layer);
      for(let key of keys){
        const valuetype = this.getTypeOf(obj,key);
        const sublayer = this.isContainer(valuetype)
            ? this.createLayer(key,obj[key],refSet,transformer,valuetype)
            : this.createLeafNode(key,obj,transformer,valuetype);
        if(sublayer){
          layer.appendChild(sublayer)
        }
      }
      refSet.delete(obj)
    }else{
      const id = this.createTargetIdFor(refSet.get(obj));
      
      layer.addEventListener("toggle",(ev)=>{
        let root = ev.target.closest(".root");
        let det = root ? root.querySelector(`#${id}`) : null;
        if(det){
          det.classList.add("focus");
          setTimeout(()=>det.classList.remove("focus"),2000)
        }
      })
      layer.firstChild.classList.add("circular");
    }
    
    return layer
  }
  
  static getTypeOf(some,key){
    if(key){
      some = some[key]
    }
    if(some === null){
      return this.TYPE_NULL
    }
    if(some === undefined){
      return this.TYPE_UNDEFINED
    }
    const type = typeof some;
    
    switch(type){
      case "object":
      
        return Array.isArray(some) ? this.TYPE_ARRAY : this.TYPE_OBJECT
      case "string":
        return this.TYPE_STRING
      case "function":
        return this.TYPE_FUNCTION
      case "number":
        return this.TYPE_NUMBER
    }
    return this.TYPE_UNDEFINED
  }
  
  setSource(some,isJson = false){
    const type = TreeView.getTypeOf(some);
    const tree = this.tree;
    while(tree.children.length > 1){
      tree.children[1].remove();    
    }
    
    tree.firstChild.className = type.description;
    
    switch(type){
      case TreeView.TYPE_ARRAY:
        tree.firstChild.setAttribute("data-label",some.length)
        break;
      case TreeView.TYPE_STRING:
      case TreeView.TYPE_NUMBER:
        tree.firstChild.setAttribute("data-label",some);
        break
      default:
        tree.firstChild.removeAttribute("data-label")
    }
    
    if(TreeView.isContainer(type)){
      const frag = TreeView.createRootLayer(some,this,type,isJson);
      tree.appendChild( frag );
      this.refSet.clear();
      const open = this.getAttribute("open");
      const openAll = open === "all";
      if(openAll || open === "layers"){
        for(let detail of Array.from(tree.querySelectorAll("details"))){
          
          detail.open = openAll || detail.children[1].localName === "details"
        }
      }
    }
    return this
  }
  
  static async loadSourceAsJSON(src){
    let response = await fetch(src);
    if(!response.ok){
      throw "source file: "+src+ " was not found";
    }
    if(response.headers.get("Content-Type").includes("application/json")){
      let data = await response.json();
      return data
    }
    return null
  }
  
  get name(){
    return this.getAttribute("data-filename")
  }
  set name(name){
    if(!name){
      this.removeAttribute("data-filename")
    }else{
      this.setAttribute("data-filename",name);
    }
  }
  
  get src(){
    return this.getAttribute("src")
  }
  
  set src(some){
    if(typeof some === "string"){
      this.setAttribute("src",some);
      TreeView.loadSourceAsJSON(some)
      .then((data) => this.setSource(data,true))
      .catch(console.error)
    }else if(typeof some === "object"){
      this.setSource(some,false);
      this.removeAttribute("src");
      this.removeAttribute("data-filename");
    }
  }
  static parseText(text){
    return JSON.parse(text);
  }
  
  onDrop(ev){
    ev.preventDefault();
    
    if (ev.dataTransfer && ev.dataTransfer.items) {
      const item = ev.dataTransfer.items[0];
      if(item && item.kind === "file"){
        if(item.type.match(/^application\/json/)){
          let file = item.getAsFile();
          this.name = file.name;
          file.text()
          .then(TreeView.parseText)
          .then(json => this.setSource(json,true))
          .catch(console.error)
        }else{
          this.setSource("unsupported file");
          this.name = "unsupported file";
        }
      }
    }
    this.onDragEnd();
  }

  onDragEnter(ev){
    ev.preventDefault();
    this.tree.classList.add("droptarget");
  }
  
  onDragOver(ev){
    ev.preventDefault();
  }
  
  onDragEnd(ev){
    this.tree.classList.remove("droptarget");
  }
  
  addDropHandler(){
    
    this.addDropHandler = () => (this);
    
    this.addEventListener("drop",this.onDrop);
    this.addEventListener("dragover",this.onDragOver);
    this.addEventListener("dragenter",this.onDragEnter);
    this.addEventListener("dragend",this.onDragEnd);
    this.addEventListener("dragleave",this.onDragEnd);
    return this
  }
  
  connectedCallback(){
    let src = this.getAttribute("src");
    if(src){
      TreeView.loadSourceAsJSON(src)
      .then(json => this.setSource(json,true))
      .then(() => TreeView.produceLoadedEvent(this,true))
      .catch(e => {
        console.error(e);
        TreeView.produceLoadedEvent(this,false)
      })
    }
    this.tree.open = this.hasAttribute("open");
    
    if(this.hasAttribute("data-drop")){
      this.addDropHandler();
    }
  }
}

customElements.define("tree-view",TreeView);