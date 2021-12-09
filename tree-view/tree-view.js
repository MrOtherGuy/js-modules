class TreeView extends HTMLElement{
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
    link.setAttribute("href","modules/tree-view.css");
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
  
  static isContainer = (type) => (type === TreeView.TYPE_OBJECT || type === TreeView.TYPE_ARRAY);
  
  static createRootLayer(obj,refSet,type,isJson){
    const frag = new DocumentFragment();
    if(TreeView.isContainer(type)){
      let keys = Object.getOwnPropertyNames(obj);
      if(type === TreeView.TYPE_ARRAY){
        keys.pop();
      }
      
      for(let key of keys){
        const valuetype = TreeView.getTypeOf(obj,key);
        if(TreeView.isContainer(valuetype)){
          const treeContent = isJson 
          ? TreeView.createSafeLayer( key, obj[key], valuetype )
          : TreeView.createLayer( key, obj[key], refSet, valuetype );
          frag.appendChild(treeContent)
        }else{
          frag.appendChild( TreeView.createLeafNode(key,obj,valuetype) )
        }
      }
    }
    return frag
  }
  
  static createLeafNode(name,obj,type){
    const details = TreeView.Node.firstChild.cloneNode(true);
    const summary = details.firstChild;
    summary.textContent = name;
    summary.classList.add(type.description);
    let div = document.createElement("div");
    switch(type){
      case TreeView.TYPE_STRING:
        div.classList.add("string");
      case TreeView.TYPE_NUMBER:
        let text = obj[name];
        div.textContent = text;
        if(text.length > 20){
          summary.setAttribute("data-label",text.slice(0,17)+"...")
        }else{
          summary.setAttribute("data-label",text)
        } 
        break;
      case TreeView.TYPE_NULL:
      case TreeView.TYPE_UNDEFINED:
        div.textContent = type.description;
        break
      default:
        div.textContent = obj[name].toString();
    }
    details.appendChild(div);
    return details
  }
  
  static createBaseLayer(obj,type){
    const layer = TreeView.Node.firstChild.cloneNode(true);
    layer.firstChild.classList.add(type.description);
    
    let keys = Object.getOwnPropertyNames(obj);
    if(type === TreeView.TYPE_ARRAY){
      keys.pop();
      layer.firstChild.setAttribute("data-label",obj.length)
    }
    return {layer,keys}
  }
  
  static createSafeLayer(name,obj,type){
    
    const {layer,keys} = TreeView.createBaseLayer(obj,type);
    layer.firstChild.textContent = name;
    
    for(let key of keys){
      const valuetype = TreeView.getTypeOf(obj,key);
      if(TreeView.isContainer(valuetype)){
        layer.appendChild(
          TreeView.createSafeLayer(key,obj[key],valuetype)
        )
      }else{
        layer.appendChild(
          TreeView.createLeafNode(key,obj,valuetype)
        )
      }
    }
    return layer
  }
  
  static createLayer(name,obj,refSet,type){
    const {layer,keys} = TreeView.createBaseLayer(obj,type);
    layer.firstChild.textContent = name;
    
    if(!refSet.has(obj)){
      refSet.set(obj,layer);
      for(let key of keys){
        const valuetype = TreeView.getTypeOf(obj,key);
        if(TreeView.isContainer(valuetype)){
          layer.appendChild(
            TreeView.createLayer(key,obj[key],refSet,valuetype)
          )
        }else{
          layer.appendChild(
            TreeView.createLeafNode(key,obj,valuetype)
          )
        }
      }
      refSet.delete(obj)
    }else{
      const id = TreeView.createTargetIdFor(refSet.get(obj));
      
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
      return TreeView.TYPE_NULL
    }
    if(some === undefined){
      return TreeView.TYPE_UNDEFINED
    }
    const type = typeof some;
    
    switch(type){
      case "object":
      
        return Array.isArray(some) ? TreeView.TYPE_ARRAY : TreeView.TYPE_OBJECT
      case "string":
        return TreeView.TYPE_STRING
      case "function":
        return TreeView.TYPE_FUNCTION
      case "number":
        return TreeView.TYPE_NUMBER
    }
    return TreeView.TYPE_UNDEFINED
  }
  
  setSource(some,isJson = false){
    const type = TreeView.getTypeOf(some);
    const tree = this.tree;
    while(tree.children.length > 1){
      tree.children[1].remove();    
    }
    
    tree.firstChild.className = type.description;
    if(type === TreeView.TYPE_ARRAY){
      tree.firstChild.setAttribute("data-label",some.length)
    }else{
      tree.firstChild.removeAttribute("data-label")
    }
    
    if(TreeView.isContainer(type)){
      tree.appendChild( TreeView.createRootLayer(some,this.refSet,type,isJson) );
      this.refSet.clear();
      const open = this.getAttribute("open");
      const openAll = open === "all";
      if(openAll || open === "layers"){
        for(let detail of Array.from(tree.querySelectorAll("details"))){
          
          detail.open = openAll || detail.children[1].localName === "details"
        }
      }
    }
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
      if(item && item.kind === "file" && item.type.match(/^application\/json/)){
        let file = item.getAsFile();
        this.setAttribute("data-filename",file.name);
        file.text()
        .then(TreeView.parseText)
        .then(json => this.setSource(json,true))
        .catch(console.error)
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
    this.addEventListener("drop",this.onDrop);
    this.addEventListener("dragover",this.onDragOver);
    this.addEventListener("dragenter",this.onDragEnter);
    this.addEventListener("dragend",this.onDragEnd);
    this.addEventListener("dragleave",this.onDragEnd);
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
  }
}

customElements.define("tree-view",TreeView);