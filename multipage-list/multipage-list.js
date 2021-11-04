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
    this.removeAttribute("data-hidden")
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
  
  useSwipeAnimation(){
    if(MultipageViewer.TouchCapable){
      this.animator = new MultipageViewer.Animator(this).forElement(this.inner);
    }
    return this
  }
  animator = null;
  data = null;
  size = 10;
  page = 1;
  filtered = null;
  
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
   
  forData(array){
    this.data = Array.isArray(array) ? array : [];
    return this.setView(1)
  }
  setRows(n){
    n |= 0;
    if(n >= 0){
      this.size = n|0;
    }
    this.setAttribute("rows",(n|0));
    
    while(this.children.length > 0){
      this.children[0].remove()
    }
    return this.setView(1)
  }
  
  next(){
    return this.setView(this.page + 1)
  }
  
  previous(){
    return this.setView(this.page - 1)
  }
    
  filters = new (function(el){
    const store = new Map();
    const host = el;
    
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
    
    this.clear = function(id){
      if(id){
        store.delete(id)
      }else{
        store.clear()
      }
      execFilters();
      return host.setView(1);
    }
    
    this.add = function(def){
      if(def && typeof def.fn === "function"){
        store.set(def.id || "default",new MultipageViewer.Filter(def.fn));
      }else{
        store.delete(def ? def.id : "default")
      }
      
      execFilters();
      
      return host.setView(1)
    }
    
    this.set = function(def){
      store.clear();
      
      if(def && def.fn){
        return this.add(def)
      }
      execFilters();
      return host.setView(1)
    }
    
    return this
  })(this);
  
  sort(fn){
    this.dataView.sort(fn);
    return this.setView(1)
  }
  
  
  setView(page){
    this.page = Math.max(1,Math.min(this.pageCount,page));
    return this.update();
  }
  
  update(){
    let end = Math.min(this.page * this.size,this.dataView.length);
    let start = Math.max(0,end - this.size);
    this.pageTracker.setViewLimits(1,this.pageCount);
    this.pageTracker.setSelected(this.page);
    let max_items = this.dataView.length;
    for(let i = 0; i < this.size; i++){
      let row = this.children[i];
      if(i < max_items){
        if(!row){
          row = this.appendChild(document.createElement("multipage-item"));
          this._cachedVisibleSize = null;
        }else{
          row.show()
        }
        this.rowFormatter(row,this.dataView[start+i])
      }else{
        row && row.hide()
      }
    }
    return this
  }
  
  set rows(n){
    if(typeof n === "number" && n >= 0){
      this.setAttribute("rows",(n|0));
      this.setRows(n|0) 
    }
  }
  get rows(){
    return this.size
  }
  
  _cachedVisibleSize = null;
  get visibleRows(){
    if(this._cachedVisibleSize === null){
      this._cachedVisibleSize = this.querySelectorAll("multipage-item:not([data-hidden])").length
    }
    return this._cachedVisibleSize
  }
  
  _onWheelEvent(ev){
    ev.preventDefault()
    ev.deltaY > 0 ? this.next() : this.previous();
  }
  
  switchByScrollWheel(){
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
        if(!this.visibleRows){ return }
        if(document.activeElement === this || document.activeElement === this.children[this.visibleRows-1]){
          this.children[0].focus()
        }else{
          document.activeElement.nextElementSibling.focus()
        }
        break;
      case "ArrowUp":
        if(!this.visibleRows){ return }
        if(document.activeElement === this || document.activeElement === this.children[0]){
          this.children[this.visibleRows-1].focus()
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
  
  set columns(int){
    if(typeof int === "number" && int > 1){
      let n = Math.ceil(int);
      this.setAttribute("columns",Math.ceil(int));
      this.inner.classList.add("grid");
      this.inner.setAttribute("style",`--multipage-grid-columns:${n};`)
    }else{
      this.removeAttribute("columns");
      this.inner.classList.remove("grid");
    }
  }
  
  addKeyboardControls(){
    this.addEventListener("keyup",this._onKeyPress);
    return this
  }
  
  connectedCallback(){
    let len = Number(this.getAttribute("rows"));
    if(len){ this.size = len; this.loaded = true }
    let columns = Number(this.getAttribute("columns"))
    if(columns){
      this.inner.classList.add("grid");
      this.inner.setAttribute("style","--multipage-gird-columns:"+columns)
    }
  }
}

customElements.define('multipage-list', MultipageViewer );

class MultipageItem extends HidableElement{
  constructor(){
    super();
    let templateContent = MultipageViewer.RowFragment;
    let cloned = templateContent.cloneNode(true);
    const shadowRoot = this.attachShadow({mode: 'closed'})
    .appendChild(cloned);
  }
  
  setContent(item){ 
    this.host.rowFormatter(this,item);
  }
    
  onClicked(ev){ 
    this.host.rowClicked(this,ev)
  }
  
  _host = null;
  get host(){
    if(!this._host){
      this._host = this.closest("multipage-list");
    }
    return this._host
  }
  
  connectedCallback(){
    this.setAttribute("slot","innerbox");
    this.setAttribute("tabindex","-1");
    let template = document.getElementById('multipagerow-template');
    this.appendChild(template.content.cloneNode(true));
    for(let e of Array.from(this.querySelectorAll("[data-part]"))){
      let prop = e.getAttribute("data-part");
      if(prop && !this[prop]){
        Object.defineProperty(this,prop,{value:e})
      }
      
    }
    this.addEventListener("click",this.onClicked);
  }
  
}

customElements.define('multipage-item', MultipageItem );