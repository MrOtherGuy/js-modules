class ViewBox extends HTMLElement{
  constructor(){
    super();
  }
  get linkedTab(){
    return this._linkedTab
  }
  connectedCallback(){
    if(!this.isConnected || this.initialized){
      return
    }
    if(this.parentNode instanceof TabView){
      
      if(!this.hasAttribute("data-name")){
        this.setAttribute("data-name",`tab-${this.parentNode.children.length}`);
      }
      this.parentNode.tabIds.add(this.dataset.name);
      this.setAttribute("slot","innerbox");
      
      this.setAttribute("hidden","");
      let box = this.parentNode.tabbox;
      if(box){
        let tab = document.createElement("tab-view-tab");
        tab.setAttribute("data-label",this.dataset.name);
        box.appendChild(tab);
        this._linkedTab = tab;
        
      }
      
      if(!this.previousElementSibling || this.hasAttribute("selected")){
        this.parentNode.value = this.dataset.name;
      }else{
        this.removeAttribute("selected")
      }
    }
  }
}

class Tab extends HTMLElement{
  constructor(){
    super();
  }
  
  setLabel(name){
    this.textContent = name;
    this.dataset.label = name;
  }
  
  _linkedView = null;
  get linkedView(){
    return this._linkedView;
  }
  connectedCallback(){
    if(!this.isConnected || this.initialized){
      return
    }
    this.addEventListener("click",Tab.setSelected);
    this.setAttribute("part","tab");
    this.textContent = this.dataset.label;
    this._linkedView = this.parentNode.host.findView(this.dataset.label);
  }
  static setSelected(ev){
    if(ev.target instanceof Tab){
      ev.target.linkedView.parentNode.value = ev.target.dataset.label
    }
  }
}

class TabView extends HTMLElement{
  constructor(){
    super();
    let template = document.getElementById("tab-view-template");
    let templateContent = template ? template.content : TabView.Fragment();
    let cloned = templateContent.cloneNode(true);
    const shadowRoot = this.attachShadow({mode: 'open'})
    .appendChild(cloned);
    this.tabIds = new Set();
  }
  get tabbox(){
    return this.shadowRoot.querySelector("#tabbox")
  }
  
  addTab(name,node){
    if(!name || this.tabIds.has(name)){
      throw "tab name is not unique"
    }
    this.tabIds.add(name);
    let tabView = document.createElement("view-box");
    tabView.setAttribute("data-name",name);
    if(node && (node instanceof HTMLElement || node instanceof DocumentFragment)){
      tabView.appendChild(node);
    }
    this.appendChild(tabView);
  }
  
  connectedCallback(){
    if(!this.isConnected || this.initialized){
      return
    }
    
    this.initialized = true;
    let box = this.tabbox;
    if(box){
      box.host = this;
    }
  }
  
  removeTab(name){
    let thing = this.findView(name);
    if(thing){
      thing.linkedTab.remove();
      thing.remove();
    }
    this.tabIds.delete(name);
  }
  
  findView(name){
    let view;
    let idx = 0;
    while(view = this.children[idx]){
      if(view.dataset.name === name){
        break
      }
      idx++
    }
    return view
  }
  
  get activeTab(){
    return this.tabbox.querySelector(".selected");
  }
  
  get value(){
    return this._value
  }
  
  set value(name){
    let idx = 0;
    let section = this.findView(name);
    if(section){
      let active = this.activeTab;
      if(active){
        active.linkedView.hidden = true;
        active.classList.remove("selected");
      }
      section.hidden = false;
      section.linkedTab.classList.add("selected");
      this._value = section.dataset.name;
    }
  }
  
  // static helper TabView.Fragment()
  // return default tree. Matches following markup:
  /*
  <template id="tab-view-template">
    <link as="style" type="text/css" rel="preload prefetch stylesheet" href="tab-view.css">
    <div part="outerbox" class="outerbox">
      <div id="tabbox" class="flex" part="tabbox"></div>
      <div part="innerbox">
        <slot name="innerbox"></slot>
      </div>
    </div>
  </template>
  */
  static Fragment(){
    let frag = new DocumentFragment();
    let link = document.createElement("link");
    link.setAttribute("as","style");
    link.setAttribute("type","text/css");
    link.setAttribute("rel","preload prefetch stylesheet");
    link.setAttribute("href","tab-view.css");
    frag.appendChild(link);
    let outer = document.createElement("div");
    outer.classList.add("outerbox");
    outer.setAttribute("part","outerbox");
    let tabbox = document.createElement("div");
    tabbox.id = "tabbox";
    tabbox.classList.add("flex");
    tabbox.setAttribute("part","tabbox");
    outer.appendChild(tabbox);
    let innerbox = document.createElement("div");
    innerbox.setAttribute("part","innerbox");
    innerbox.appendChild(document.createElement("slot")).setAttribute("name","innerbox");
    outer.appendChild(innerbox);
    frag.appendChild(outer);
    return frag
  }
}

customElements.define("tab-view",TabView);
customElements.define("view-box",ViewBox);
customElements.define("tab-view-tab",Tab);