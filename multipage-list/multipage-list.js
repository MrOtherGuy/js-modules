class HidableElement extends HTMLElement{
  constructor(){
    super();
  }
  
  waitForStyle(){
    this.setAttribute("data-hidden","");
    this.resolveOnStyle()
    .then(this.show.bind(this));
    return this
  }
  hide(){
    this.setAttribute("data-hidden","");
  }
  show(){
    this.removeAttribute("data-hidden");
  }
  loaded = false;
  
  resolveOnStyle(obj){
    const timeout = obj && obj.ms;
    return new Promise((res,rej) => {
      if(this.loaded){
        res();
        return
      }
      timeout && setTimeout(rej,timeout);
      let style = this.shadowRoot.firstElementChild;
      style.addEventListener("load",()=>{ this.loaded=true; res(); },{once:true})
    })
  }
  
}


class PageTrack extends HidableElement{
  constructor(){
    super();
    let template = document.getElementById('pagetrack-template');
    let templateContent = template.content;
    let cloned = templateContent.cloneNode(true);
    const shadowRoot = this.attachShadow({mode: 'open'})
    .appendChild(cloned);
  }
  min = 1;
  max = 1;
  canSkipRedraw = false;
  
  setViewLimits(a,b){
    a |= 0;
    b |= 0;
    if(a > b || (this.min === a && this.max === b)){ return }
    this.min = a;
    this.max = b;
    this.buttons[0].setAttribute("data-value",1);
    this.buttons[6].setAttribute("data-value",this.max);
    if(b - a < 7){
      this.buttons[0].nextElementSibling.classList.add("hidden");
      this.buttons[5].nextElementSibling.classList.add("hidden");
    }else{
      this.buttons[0].nextElementSibling.classList.remove("hidden");
      this.buttons[5].nextElementSibling.classList.remove("hidden");
    }
    this.canSkipRedraw = false;
  }
  _buttons = null;
  get buttons(){
    if(!this._buttons){
      this._buttons = this.shadowRoot.querySelectorAll(".page-num");
    }
    return this._buttons
  }
  
  currentlySelected = 1;
  
  setSelected(n){
    if(this.canSkipRedraw
    &&(n < this.min
    || n > this.max
    || this.min === this.max
    || n === this.currentlySelected
    )){
      return
    }
    this.canSkipRedraw = true;
    
    let buttons = this.buttons;
    for(let i = 0; i< buttons.length; i++){
      buttons[i].classList.remove("selected");
    }

    
    let startValue = Math.max(this.min + 1,n-2);
    if(n === this.min){
      buttons[0].classList.add("selected")
    }else if(n === this.max){
      buttons[6].classList.add("selected");
      startValue = Math.max(startValue,this.max - 5);
    }
    
    this.currentlySelected = n;
    
    if(this.max - n < 3){
      startValue = Math.max(this.min+1,startValue - (3-(this.max - n)));
    }
    
    let node = buttons[1];
    let max = this.max - 1;
    const end = n === this.min ? 6 : 5;
    for(let i = 0; i < end; i++){
      let val = startValue + i;
      if(val > max){
        node.classList.add("hidden");
      }else{
        node.classList.remove("hidden");
      }
      node.setAttribute("data-value",val);
      if(val === n){
        node.classList.add("selected");
      }
      node = node.nextElementSibling;
    }
  }
  connectedCallback(){
    this.shadowRoot.addEventListener("click",(ev)=>{
      switch(ev.target.getAttribute("data-type")){
        case "page-num":
          this.host.setView(Number(ev.target.getAttribute("data-value")))
          return
        case "page-control":
          if(ev.target.classList.contains("next")){
            this.host.next();
          }else{
            this.host.previous();
          }
          return
        default:
          console.log("unsupported data-type was clicked")
      }
      return
    },{passive:true})
  }
}

customElements.define('page-track', PageTrack );


class MultipageViewer extends HidableElement{
  constructor(){
    super();
    let template = document.getElementById('multipageinner-template');
    let templateContent = template.content;
    let cloned = templateContent.cloneNode(true);
    const shadowRoot = this.attachShadow({mode: 'open'})
    .appendChild(cloned);
    this.rowsToBeAdded = new Set();
  }
  
  static produceLoadedEvent(instance, b){
    instance.dispatchEvent(new CustomEvent("dataload", {"detail":{"success": b},"bubbles":false, "cancelable":false}));
  }
  
  static TouchCapable = ("ontouchstart" in window) && navigator.maxTouchPoints > 0;
    
  static Filter = function(fun){
    const fn = fun;
    this.run = (some) => fn(some);
    this.enabled = true;
    return this
  }
  
  static RowFragment = (function(){
    const frag = new DocumentFragment();
    const slot = frag.appendChild(document.createElement("slot"));
    slot.setAttribute("name","row-content");
    return frag
  })();
  
  static Animator = function(context){
    let element = null;
    let host = context;
    let animating = false;
    let offsetX = 0;
    let originalX = 0;
    
    this.forElement = function(elem){
      element = elem;
      elem.addEventListener("touchstart",onTouchStart);
      elem.addEventListener("touchmove",onTouchMove);
      elem.addEventListener("touchend",onTouchEnd);
      return this
    }
    
    function onTouchStart(ev){
      if(animating){
        return
      }
      animating = true;
      offsetX = 0;
      originalX = ev.touches[0].clientX;
      
    }
    function onTouchMove(ev){
      if(!animating){
        return
      }
      offsetX = ev.touches[0].clientX - originalX;
      element.style.transform = `translateX(${offsetX}px)`
    }
    
    function finishAction(i){
      element.classList.add("finishing");
      switch(i){
        case 1:
          element.style.transform = "translateX(-100%)";
          break;
        case -1:
          element.style.transform = "translateX(100%)";
          break;
        case 0:
          element.style.transform = "translateX(0)";
          break;
        default:
          return
      }
      setTimeout(()=>clearStyle(i),100);
    }
    
    function clearStyle(i){
      if(i === 1){
        host.next()
      }else if(i === -1){
        host.previous();
      }
      element.classList.remove("finishing");
      element.style.transform = "";
    }
    
    function fireTouchEndAnimation(){
      let direction = (offsetX < 0) ? 1 : -1;
      let hasMoreItems = direction < 0 ? host.page > 1 : host.page < host.pageCount;
      if(!hasMoreItems){
        finishAction(0);
        return
      }
      finishAction(direction);
      if(direction > 0){
        element.classList.add("animateUp");
      }else{
        element.classList.add("animateDown");
      }
    }
    
    function onTouchEnd(ev){
      if(animating){ 
        if(Math.abs(offsetX) > 90){
          fireTouchEndAnimation();
        }else{
          animating = false;
          finishAction(0);
        }
        reset()
      }
    }
    
    function removeClasses(){
      element.classList.remove("animateUp");
      element.classList.remove("animateDown");
    }

    function reset(){
      offsetX = 0;
      originalX = 0;
      if(!animating){
        removeClasses();
      }else{
        animating = false;
        setTimeout(removeClasses,300)
      }
    }
    return this
  }
  
  static FilterManager = function(element){
    const store = new Map();
    const host = element;
    
    function filterFn(o){
      for(let f of store.values()){
        if(f.enabled && !f.run(o)){
          return false
        }
      }
      return true
    }

    function execFilters(){
      host._cachedVisibleSize = null;
      host.filtered = store.size ? host.data.filter(filterFn) : null
    }
    
    this.clearWithoutRunning = () => {
      store.clear();
      execFilters();
      return this
    }
    
    this.clear = (id) => {
      if(id){
        store.delete(id)
      }else{
        store.clear()
      }
      execFilters();
      return host.setView(1);
    }
    
    this.add = (def) => {
      if(def && typeof def.fn === "function"){
        store.set(def.id || "default",new MultipageViewer.Filter(def.fn));
      }else{
        store.delete(def ? def.id : "default")
      }
      
      execFilters();
      
      return host.setView(1)
    }
    
    this.set = (def) => {
      store.clear();
      
      if(def && def.fn){
        return this.add(def)
      }
      execFilters();
      return host.setView(1)
    }
    
    return this
  }
  
  switchBySwiping(){
    if(MultipageViewer.TouchCapable){
      this.animator = new MultipageViewer.Animator(this).forElement(this.inner);
    }
    return this
  }
  animator = null;
  data = null;
  page = 1;
  filtered = null;
  dataLoader = null;
  lazyLoadedItems = null;
  
  rowFormatter(elem,athing){
    elem.children[0].textContent = athing
  }
  
  rowClicked(){
    return
  }
  
  hasPageTrack = true;
  
  setRowClickHandler(fn){
    if(typeof fn === "function"){
      this.rowClicked = fn;
    }else{
      delete this.rowClicked
    }
    return this
  }
  
  setRowFormatter(fn){
    if(typeof fn === "function"){
      this.rowFormatter = fn;
    }else{
      delete this.rowFormatter;
    }
    return this
  }
  
  _inner = null;
  get inner () {
    if(!this._inner){
      this._inner = this.shadowRoot.getElementById("multipage-innerbox");
    }
    return this._inner
  }
  
  _pageTracker = null;
  get pageTracker(){
    if(!this._pageTracker){
      let container = this.shadowRoot.getElementById("multipage-track-container");
      if(container){
        this._pageTracker = container.appendChild(document.createElement("page-track"))
        Object.defineProperty(this._pageTracker,"host",{value:this});
      }
    }
    return this._pageTracker
  }
  
  get dataView (){ return this.filtered || this.data || [] }
  
  get pageCount (){ return Math.max(Math.ceil(this.dataView.length / Math.max(this.size,1)), 1) }
   
  setSource(array){
    if(this.lazyLoadedItems){
      for(let value of this.lazyLoadedItems.values()){
        value.forgetObjectUrl();
      }
      this.lazyLoadedItems.clear();
    }
    this.data = Array.isArray(array) ? array : [];
    this.filters.clearWithoutRunning();
    return this.setView(1)
  }
  
  get src(){
    return this.getAttribute("src")
  }
  set src(some){
    if(typeof some === "string"){
      this.setAttribute("src",some);
      MultipageViewer.loadSourceAsJSON(some)
      .then((data) => this.setSource(data))
      .catch(console.error)
    }else if(Array.isArray(some)){
      this.setSource(some);
      this.removeAttribute("src")
    }
  }
  
  next(){
    return this.setView(this.page + 1)
  }
  
  previous(){
    return this.setView(this.page - 1)
  }
  
  _filterManager = null;
  get filters(){
    if(!this._filterManager){
      this._filterManager = new MultipageViewer.FilterManager(this)
    }
    return this._filterManager
  };
  
  sort(fn){
    this.dataView.sort(fn);
    return this.setView(1)
  }
  
  setView(page){
    const newpage = Math.max(1,Math.min(this.pageCount,page));
    if(newpage === this.page){
      return this.update();
    }
    const event = new CustomEvent('multipagechange', {
      detail: {
        current: newpage,
        previous: this.page 
      }
    });
    this.dispatchEvent(event);
    this.page = newpage;
    return this.update();
  }
  
  _itemChildren = null;
  get itemChildren(){
    if(!this._itemChildren){
      this._itemChildren = this.querySelectorAll("multipage-item");
    }
    return this._itemChildren
  }
  
  makeVisibleChildAtIndex(index){
    let row = this.itemChildren[index];
    if(!row){
      row = document.createElement("multipage-item");
      row.init(this);
      this.rowsToBeAdded.add(row);
      this._cachedVisibleSize = null;
    }else{
      row.show()
    }
    return row
  }
  
  static appendPendingChildrenOf(list){
    if(list.rowsToBeAdded.size > 0){
      for(let row of list.rowsToBeAdded){
        list.appendChild(row);
      }
      list._itemChildren = null;
      list.rowsToBeAdded.clear();
    }
    return
  }
  
  static getDataBounds(list){
    let end = Math.min(list.page * list._size,list.dataView.length);
    let start = Math.max(0,end - list._size);
    list.pageTracker.setViewLimits(1,list.pageCount);
    list.pageTracker.setSelected(list.page);
    return { start: start, max: list.dataView.length }
  }
  
  update(){
    const bounds = MultipageViewer.getDataBounds(this);
    for(let i = 0; i < this.size; i++){
      if(i < bounds.max){
        let row = this.makeVisibleChildAtIndex(i);
        this.rowFormatter(row,this.dataView[bounds.start+i]);
      }else{
        let row = this.itemChildren[i];
        row && row.hide();
      }
    }
    
    MultipageViewer.appendPendingChildrenOf(this);
    return this
  }
  
  _size = 10;
  set size(n){
    if(typeof n !== "number"){ return }
    n |= 0;
    if(n >= 0 && n != this._size){
      this._cachedVisibleSize = null;
      this._size = n;
      this.setAttribute("size",(n));
      {
        const children = Array.from(this.itemChildren);
        while(children.length > n){
          children.pop().remove();
        }
      }
      this._itemChildren = null;
      this.setView(1);
      return
    }
  }
  get size(){
    return this._size
  }
  
  
  setSize(some){
    if(!some){ return this }
    if(typeof some === "number"){
      this.size = some;
      return this
    }
    if(some.rows && some.columns){
      this.columns = some.columns;
      this.size = some.rows * some.columns;
    }
    return this
  }
  
  set rows(n){
    let newSize = this._columns * n;
    this.size = newSize;
    return
  }
  
  get rows(){
    return Math.ceil(this.size / this._columns)
  }
  
  _columns = 1;
  get columns(){
    return this._columns
  }
  
  set columns(n){
    if(typeof n !== "number" || n < 1){ return }
    n |= 0;
    this._columns = n;
    if(n > 1){
      this.setAttribute("columns",n);
      this.inner.classList.add("grid");
      this.inner.setAttribute("style",`--multipage-grid-columns:${n};`)
    }else{
      this.removeAttribute("columns");
      this.inner.classList.remove("grid");
    }
    return
  }
  
  _cachedVisibleSize = null;
  get visibleItems(){
    if(this._cachedVisibleSize === null){
      this._cachedVisibleSize = this.querySelectorAll("multipage-item:not([data-hidden])").length
    }
    return this._cachedVisibleSize
  }
  
  [Symbol.iterator](){
    let idx = 0;
    return {
      next: () => {
        const comp = this.visibleItems;
        return idx < comp ? {
          value: this.itemChildren[idx],
          done: (idx++ >= comp)
        } : {
          done: true
        }
      }
    }
  }
  
  _onWheelEvent(ev){
    ev.preventDefault();
    ev.deltaY > 0 ? this.next() : this.previous();
  }
  
  switchByScrolling(){
    this.addEventListener("wheel",this._onWheelEvent);
    return this
  }
  
  _onKeyPress(ev){
    switch (ev.key){
      case "ArrowLeft":
        this.previous();
        break;
      case "ArrowRight":
        this.next();
        break;
      case "ArrowDown":
        if(!this.visibleItems){ return }
        if(document.activeElement === this || document.activeElement === this.itemChildren[this.visibleItems-1]){
          this.itemChildren[0].focus()
        }else{
          document.activeElement.nextElementSibling.focus()
        }
        break;
      case "ArrowUp":
        if(!this.visibleItems){ return }
        if(document.activeElement === this || document.activeElement === this.itemChildren[0]){
          this.itemChildren[this.visibleItems-1].focus()
        }else{
          document.activeElement.previousElementSibling.focus()
        }
        break;
      case "Enter":
        if(document.activeElement instanceof MultipageItem){
          document.activeElement.click()
        }
      default:
        return
    }
    ev.preventDefault();
  }
  
  addKeyboardControls(){
    this.addEventListener("keyup",this._onKeyPress);
    return this
  }
  
  static async loadSourceAsJSON(src){
    let response = await fetch(src);
    if(response.headers.get("Content-Type").includes("application/json")){
      let data = await response.json();
      return data
    }
    return null
  }
  
  connectedCallback(){
    
    // Handle columns attribute
    let columns = Number(this.getAttribute("columns"))
    if(columns){
      this.inner.classList.add("grid");
      this.inner.setAttribute("style","--multipage-grid-columns:"+columns)
    }
    
    // Set base size
    let len = Number(this.getAttribute("size"));
    if(len){
      this.size = len;
      this.loaded = true;
    }

    // Handle src attribute
    let src = this.getAttribute("src");
    if(src){
      MultipageViewer.loadSourceAsJSON(src)
      .then(json => this.setSource(json))
      .then(() => MultipageViewer.produceLoadedEvent(this,true))
      .catch(e => {
        console.error(e);
        MultipageViewer.produceLoadedEvent(this,false)
      })
    }
  }
}

customElements.define('multipage-list', MultipageViewer );

class MultipageLazyViewer extends MultipageViewer{
  constructor(){
    super();
    this.lazyLoadedItems = new Map();
    this.dataLoader = new MultipageLazyViewer.DataLoader();
  }
  
  static Load_Interrupted = Symbol("load interrupted");
  
  static dataLoadError(e){
    if(e.reason === MultipageLazyViewer.Load_Interrupted){
      return
    }
    console.warn("Data load interrupted: " + e)
  }
  
  static resolveContentType(response){
    const type = response.headers.get("Content-Type");
    if(!response.ok){
      throw "response wasn't ok"
    }
    if(type.includes("application/json")){
      return new MultipageLazyViewer.Result(response,MultipageLazyViewer.Result.JSON)
    }
    if(type.includes("image/")){
      return new MultipageLazyViewer.Result(response,MultipageLazyViewer.Result.BLOB)
    }
    return new MultipageLazyViewer.Result(response,MultipageLazyViewer.Result.TEXT)
  } 
  
  static Result = class{
    constructor(some,symbol){
      this.raw = some;
      this._type = symbol;
    }
    resolved = false;
    static BLOB = Symbol("blob");
    static JSON = Symbol("json");
    static TEXT = Symbol("text");
    
    _content = null;
    
    forgetObjectUrl(){
      if(this._type === MultipageLazyViewer.Result.BLOB){
        URL.revokeObjectURL(this._content);
      }
    }
    
    async resolve(){
      if(!this.resolved){
        this.resolved = true;
        switch(this._type){
          case MultipageLazyViewer.Result.JSON:
            let json = await this.raw.json();
            this._content = json;
            break;
          case MultipageLazyViewer.Result.BLOB:
            let blob = await this.raw.blob();
            this._content = URL.createObjectURL(blob);
            break;
          case MultipageLazyViewer.Result.TEXT:
            let text = await this.raw.text();
            this._content = text;
            break;
          default:
            this._content = null;
            break;
        }
      }
      return this
    }
    
    get type(){ return this._type.description }
    
    get content(){
      if(!this._content){
        this.resolve()
      }
      return this._content
    }
  }
  
  // dataLoader is somewhat complicated because it has to deal with the fact that lazy // loaded items might get requested multiple times and we want to prevent that.
  // That being said, there's probably plenty of room for simplification here.
  static DataLoader = function(){
        
    // Used to store currently loading object descriptors
    const loadingItems = new Map();

    // An object that wraps a promise that can be resolved or rejected on demand
    function Loadable(){
      this.promise = new Promise((res,rej)=>{
        this.resolve = res;
        this.reject = rej;
      });

      // Stores the fetch() promise and reference to the Loadable that triggers it
      this.dataload = { that: this, data: null };
      //
      this.load = (ob) => {
        const dl = this.dataload;
        if(!dl.data){
          dl.data = fetch(ob.url);
          dl.data
          .then( MultipageLazyViewer.resolveContentType )
          .then( result => result.resolve() )
          .then( dl.that.resolve, dl.that.reject )
        }
        return this
      }
    }
    
    // Returns a Loadable that is stored in loadingItems map
    function createLoadableWithCallback(obj,onsuccess,onerror){
      const loadable = new Loadable();
      loadingItems.set(obj,loadable);

      loadable.promise.then(
        some => { loadingItems.delete(obj); onsuccess(some) },
        err => {
          onerror(err);
          if(err.reason !== MultipageLazyViewer.Load_Interrupted){
            loadingItems.delete(obj)
          }
        }
      )
      return loadable
    }
    
    this.load = (obj) => {
      
      return new Promise((resolveLoad,rejectLoad) => {
        
        if(loadingItems.has(obj)){  
          let old_loadable = loadingItems.get(obj);
          old_loadable.reject({ "reason":MultipageLazyViewer.Load_Interrupted });
          
          let newLoadable = createLoadableWithCallback(obj,resolveLoad,rejectLoad);
          
          // Copy dataload from the old loadable, then delete the old
          newLoadable.dataload = old_loadable.dataload;
          newLoadable.dataload.that = newLoadable;
          delete old_loadable.dataload;
          
        }else{
          // Just initiate a new load
          createLoadableWithCallback(obj,resolveLoad,rejectLoad)
          .load(obj)
        }

      })
    }
    
    return this
  }
  
  rowFormatter(elem,athing){
    elem.children[0].textContent = athing.content
  }
  
  update(){
    
    const bounds = MultipageViewer.getDataBounds(this);
    let preloadStart = this.preload ? bounds.start + this.size : 0;

    for(let i = 0; i < this.size; i++){

      if(i < bounds.max){

        const row = this.makeVisibleChildAtIndex(i);
        let rowData = this.dataView[bounds.start+i];
        
        // If the requested item isn't already loaded
        if(!this.lazyLoadedItems.has(rowData)){
          // the current "real" target is stored to row, because it might happen that another lazy loaded content item resolves first and and we don't want that to be drawn
          row.lazyLoadTarget = rowData;
          row.classList.add("loading");
          // Load contents, then store the result to map and draw the item
          this.dataLoader.load(rowData)
          .then(
            result => {
              this.lazyLoadedItems.set(rowData,result);
              // Only draw the item if it really is the last requested item
              if(row.lazyLoadTarget === rowData){
                this.rowFormatter(row,result);
                row.lazyLoadTarget = null;
                row.classList.remove("loading");
              }
            },
            MultipageLazyViewer.dataLoadError
          )
        }else{ // The requested item has already been loaded so just use that 
          let item = this.lazyLoadedItems.get(rowData);
          if(item){
            this.rowFormatter(row,item)
          }else{ // Not sure how this could happen
            console.error("Preload-map got a key with no data")
          }
          row.classList.remove("loading");
        }
      }else{ // Hide the row if filtered list has no content for it
        preloadStart = 0;
        let row = this.itemChildren[i];
        row && row.hide()
      }

    }
    MultipageViewer.appendPendingChildrenOf(this);
    // Pre-load next page contents and store them to lazyLoadedItems map.
    if(this.preload && preloadStart > 0){
      const end = Math.min(this.size, bounds.max - preloadStart) + preloadStart;
     
      for(let i = preloadStart; i < end; i++){
        const item = this.dataView[i];
        if(!this.lazyLoadedItems.has(item)){
          this.dataLoader.load(item)
          .then(
            result => this.lazyLoadedItems.set(item,result),
            MultipageLazyViewer.dataLoadError
          )
        }
      }
      
    }
    return this
  }
  
  connectedCallback(){
    super.connectedCallback.apply(this);
    Object.defineProperty(this,"preload",{
      value: this.getAttribute("preload") === "next"
    });
  }
  
}

customElements.define('multipage-lazy-list', MultipageLazyViewer );

class MultipageItem extends HidableElement{
  constructor(){
    super();
    let templateContent = MultipageViewer.RowFragment;
    let cloned = templateContent.cloneNode(true);
    const shadowRoot = this.attachShadow({mode: 'closed'})
    .appendChild(cloned);
    
  }
  
  init(element){
    if(this.initialized){ return }
    this.setAttribute("tabindex","-1");
    if(element){ this._host = element }
    let template = document.getElementById(this.host.getAttribute("data-template") || "multipagerow-template");
    this.appendChild(template.content.cloneNode(true));
    
    for(let e of Array.from(this.querySelectorAll("[data-part]"))){
      let prop = e.getAttribute("data-part");
      if(prop && !this[prop]){
        Object.defineProperty(this,prop,{value:e})
      }
      
    }
    this.initialized = true
  }
  
  lazyLoadTarget = null;
  
  setContent(item){
    this.host.rowFormatter(this,item);
  }
    
  onClicked(ev){ 
    this.host.rowClicked(this,ev)
  }
  
  _host = null;
  get host(){
    if(!this._host){
      this._host = this.closest("multipage-list") || this.closest("multipage-lazy-list");
    }
    return this._host
  }
  
  connectedCallback(){
    this.setAttribute("slot","innerbox");
    if(!this.initialized){
      this.init()
    }
    
    this.addEventListener("click",this.onClicked);
  }
  
}

customElements.define('multipage-item', MultipageItem );