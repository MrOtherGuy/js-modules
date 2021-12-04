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
    link.setAttribute("href","tree-view.css");
    frag.appendChild(link);

    return frag
  })();
  
  static produceLoadedEvent(instance, b){
    instance.dispatchEvent(new CustomEvent("dataload", {"detail":{"success": b},"bubbles":false, "cancelable":false}));
  }
  static createTargetIdFor(detail){
    let s = "";
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
  static TYPEE_FUNCTION = Symbol("function");
  static TYPE_NULL = Symbol("null");
  static TYPE_EMPTY = Symbol("empty");
  
  static classMap = (
    (new Map())
    .set(TreeView.TYPE_OBJECT,"object")
    .set(TreeView.TYPE_ARRAY,"array")
    .set(TreeView.TYPE_FUNCTION,"function")
    .set(TreeView.TYPE_STRING,"string")
    .set(TreeView.TYPE_NULL,"null")
    .set(TreeView.TYPE_EMPTY,"")
  );
  
  static createRootLayer(obj,refSet){
    const frag = new DocumentFragment();
    if(obj && typeof obj === "object"){
      let keys = Object.getOwnPropertyNames(obj);
      Array.isArray(obj) && keys.pop();
      for(let key of keys){
        frag.appendChild(TreeView.createLayer(key,obj[key],refSet))
      }
    }
    return frag
  }
  
  static createLayer(name,obj,refSet){
    
    const details = TreeView.Node.firstChild.cloneNode(true);
    const summary = details.firstChild;
    summary.textContent = name;
    const type = typeof obj;
    
    if(type === "object"){
      let keys = Object.getOwnPropertyNames(obj);
      
      if(Array.isArray(obj)){
        keys.pop();
        summary.classList.add("array");
      }else{
        summary.classList.add("object")
      }
      if(!refSet.has(obj)){
        refSet.set(obj,details);
        for(let key of keys){
          details.appendChild(TreeView.createLayer(key,obj[key],refSet))
        }
      }else{
        const id = TreeView.createTargetIdFor(refSet.get(obj));
        
        details.addEventListener("toggle",(ev)=>{
          if(details.open){
            let det = document.getElementById(id);
            det && det.focus();
          }
        })
        details.firstChild.classList.add("circular");
      }
    }else{
      let ostr;
      if(type === "string"){
        summary.classList.add("string");
        ostr = `"${obj}"`
      }else{
        ostr = obj.toString();
      }

      details.appendChild(document.createElement("div")).textContent = ostr;
      let slice = ostr.slice(0,10);
      if(ostr.length > 13){
        slice += "..."
      }else{
        slice += ostr.slice(10,13)
      }
      summary.setAttribute("data-label",slice)
    }
    return details
  }
  
  static getTypeOf(some){
    switch(typeof some){
      case "object":
        return Array.isArray(some) ? TreeView.TYPE_ARRAY : TreeView.TYPE_OBJECT
      case "string":
        return TreeView.TYPE_STRING
      case "function":
        return TreeView.TYPE_FUNCTION
      case "null":
        return TreeView.TYPE_NULL
    }
    return TYPE_EMPTY
  }
  
  setSource(some){
    const type = TreeView.getTypeOf(some);
    const tree = this.tree;
    while(tree.children.length > 1){
      tree.children[1].remove();    
    }
    
    tree.firstChild.className = TreeView.classMap.get(type);
    
    if(type === TreeView.TYPE_OBJECT || TreeView.TYPE_ARRAY){
      let created = TreeView.createRootLayer(some,this.refSet);
      tree.appendChild(created);
      this.refSet.clear();
    }
  }
  
  static async loadSourceAsJSON(src){
    let response = await fetch(src);
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
      .then((data) => this.setSource(data))
      .catch(console.error)
    }else if(typeof some === "object"){
      this.setSource(some);
      this.removeAttribute("src")
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
        .then(json => {
          this.src = json
        })
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
      .then(json => this.setSource(json))
      .then(() => TreeView.produceLoadedEvent(this,true))
      .catch(e => {
        console.error(e);
        TreeView.produceLoadedEvent(this,false)
      })
    }
    
  }
}

customElements.define("tree-view",TreeView);