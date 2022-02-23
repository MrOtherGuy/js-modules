class ReaderView extends HTMLElement{
  constructor(){
    super();
    let template = document.getElementById("reader-view-template");
    let templateContent = template ? template.content : ReaderView.Fragment();
    let cloned = templateContent.cloneNode(true);
    const shadowRoot = this.attachShadow({mode: 'open'})
    .appendChild(cloned);
  }
  clear(){
    while(this.children.length){
      this.children[0].remove()
    }
  }
  
  setSource(obj){
    this.clear();
    let tryTitle = true;
    let lines = obj.content.split("\n");
    for(let line of lines){
      line = line.trim();
      if(!line.length){
        tryTitle = false;
        continue
      }
      if(tryTitle && line.startsWith("#") && line.length < 50){
        const title = line.slice(1);
        document.title = title;
        this.appendChild(
          ReaderView.H1({ slot:"contentbox",text: title })
        );
        continue
      }
      tryTitle = false;
      if(line.startsWith("#")){
        this.appendChild(
          ReaderView.H2({ slot:"contentbox",text: line.slice(1) })
        );
      }else{
        this.appendChild(
          ReaderView.P({ slot:"contentbox",text: line })
        )
      }
    }
  }
  
  get src(){
    return this.getAttribute("src")
  }
  
  set src(some){
    if(typeof some === "string"){
      this.setAttribute("src",some);
      ReaderView.TryLoadFile(some)
      .then((obj)=>{
        this.setSource(obj);
      })
      .catch((e)=>{
        console.error(e);
        this.removeAttribute("data-filename");
      })
    }
  }
  
  set allowNoMIME(bool){
    this.noMIMEAllowed = !!bool;
  }
  
  set name(title){
    document.title = title;
  }
  
  get outerbox(){
    return this.shadowRoot.children[1]
  }
  
  onDrop(ev){
    ev.preventDefault();
    
    if (ev.dataTransfer && ev.dataTransfer.items) {
      const item = ev.dataTransfer.items[0];
      if(item && item.kind === "file"){
        if(item.type.match(/^text\//) || (this.noMIMEAllowed && !item.type )){
          let file = item.getAsFile();
          this.name = file.name;
          file.text()
          .then(text => {
            let obj = {content: text};
            this.setSource(obj) 
          })
          .catch(console.error)
        }else{
          this.setSource({content:"unsupported file"});
          this.name = "unsupported file";
        }
      }
    }
    this.onDragEnd();
  }
  
  onDragEnter(ev){
    ev.preventDefault();
    this.outerbox.classList.add("dropover");
  }
  
  onDragOver(ev){
    ev.preventDefault();
  }
  
  onDragEnd(ev){
    this.outerbox.classList.remove("dropover");
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
  
  get controlbox(){
    return this.shadowRoot.querySelector(".controls");
  }
  
  connectedCallback(){
    let searchParams = new URLSearchParams(document.location.search);
    let filename = searchParams.get("file");
    if(!filename){
      filename = this.getAttribute("src");
    }
    this.src = filename;
    if(this.classList.contains("droptarget")){
      this.addDropHandler();
    }
    let cbox = this.controlbox;
    if(cbox){
      let range = cbox.querySelector("input[type='range']");
      const setSizeFromRange = () => {
        this.textSize = Number(range.value);
      }
      range && range.addEventListener("change",setSizeFromRange);
      range.previousElementSibling.addEventListener("click",(e)=>{
        let oldValue = range.value;
        range.stepDown();
        if(range.value != oldValue){
          setSizeFromRange();
        }
      });
      range.nextElementSibling.addEventListener("click",(e)=>{
        let oldValue = range.value;
        range.stepUp();
        if(range.value != oldValue){
          setSizeFromRange()
        }
      });
      const fun = (ev)=>{
        if(ev.target.checked){
          if(ev.target.name === "theme"){
            this.theme = ev.target.value;
          }else if(ev.target.name === "texttype"){
            this.textStyle = ev.target.value;
          }
        }
      };
      let radios = Array.from(cbox.querySelectorAll("input[type='radio']"));
      for(let radio of radios){
        radio.addEventListener("change",fun)
      }
      let theme = this.theme;
      if(theme){
        this.theme = theme
      }
      let innerbox = this.outerbox.querySelector(".innerbox");
      if(innerbox){
        innerbox.addEventListener("click",()=>{
          this.hideControls();
        })
      }
    }
  }
  
  get textStyle(){
    return this.outerbox.classList.contains("serif") ? "serif" : "sans"
  }
  set textStyle(style){
    if(["sans","serif"].includes(style)){
      if(style === "sans"){
        this.outerbox.classList.remove("serif")
      }else{
        this.outerbox.classList.add("serif")
      }
      let radio = this.controlbox.querySelector("label.sans");
      radio.parentNode.className = "radiogroup "+style;
      ReaderView.DispatchSettingChanged(this,{
        textStyle: style
      });
    }
  }
  get textSize(){
    return window.getComputedStyle(this).fontSize
  }
  set textSize(some){
    if(some && typeof some === "number" && !Number.isNaN(some)){
      let value = Math.min(2,Math.max(0.5,some));
      this.controlbox.querySelector("input[type='range']").value = value;
      this.outerbox.setAttribute("style",`--reader-font-size:${some}em`);
      ReaderView.DispatchSettingChanged(this,{
        textSize: some
      });
    }
  }
  
  hideControls(){
    let cbox = this.shadowRoot.getElementById("controlstoggle");
    if(cbox){
      cbox.checked = false;
    }
  }
  showControls(){
    let cbox = this.shadowRoot.getElementById("controlstoggle");
    if(cbox){
      cbox.checked = true;
    }
  }
  
  get theme(){
    for(let value of ReaderView.themeNames){
      if(this.classList.contains(value)){
        return value
      }
    }
    return ""
  }
  
  set theme(themeName){
    if(!ReaderView.themeNames.includes(themeName)){
      return
    }
    let current = this.theme;
    this.classList.remove(current);
    this.classList.add(themeName);
    if(current){
      let b = this.outerbox.querySelector(`label.${current}`);
    }
    let node = this.outerbox.querySelector(`label.${themeName}`);
    if(node){
      node.parentNode.className = `radiogroup ${themeName}`;
      node.children[0].checked = true;
      ReaderView.DispatchSettingChanged(this,{
        theme: themeName
      });
    }
  }
  
  static themeNames = ["","pure","night","sepia"];
  static DispatchSettingChanged(target,eventinit){
    target.dispatchEvent(new CustomEvent("settingchange",{detail:eventinit}))
  }
  

  static CreateRadioGroup(desc){
    if(!desc || !desc.name || !Array.isArray(desc.values)){
      throw "radio-group description is not an object"
    }
    let box = ReaderView.DIV({
      class: `radiogroup ${desc.selected}`
    });
    for(let radioValue of desc.values){
      let label = ReaderView.LABEL(
        { class: `button ${radioValue}`, text: desc.text }
      );
      let node = ReaderView.INPUT(
        { type: "radio", name: desc.name, value: radioValue }
      );
      if(box.selected === radioValue){
        node.setAttribute("checked",true);
      }
      label.appendChild(node);
      box.appendChild(label);
    }
    return box
  }
  
  static CreateElement(type,obj,children){
    let el = document.createElement(type);
    for(let key of Object.keys(obj)){
      const value = obj[key];
      if(!value){
        continue
      }
      if(key === "text"){
        el.textContent = value
      }else{
        el.setAttribute(key,value)
      }
    }
    if(Array.isArray(children)){
      for(let n of children){
        el.appendChild(n)
      }
    }
    return el
  }
  
  static DIV(desc,elem){
    return ReaderView.CreateElement("div",desc,elem)
  }
  static INPUT(desc,elem){
    return ReaderView.CreateElement("input",desc,elem)
  }
  static H1(desc,elem){
    return ReaderView.CreateElement("h1",desc,elem)
  }
  static H2(desc,elem){
    return ReaderView.CreateElement("h2",desc,elem)
  }
  static LABEL(desc,elem){
    return ReaderView.CreateElement("label",desc,elem)
  }
  static LINK(desc,elem){
    return ReaderView.CreateElement("link",desc,elem)
  }
  static P(desc,elem){
    return ReaderView.CreateElement("p",desc,elem)
  }
  static SLOT(desc,elem){
    return ReaderView.CreateElement("slot",desc,elem)
  }
  
  static Fragment(){
    let frag = new DocumentFragment();
    frag.appendChild(
      ReaderView.LINK({
          as   : "style",
          type : "text/css",
          rel  : "preload prefetch stylesheet",
          href : "reader-view/reader-view.css"
        }
      )
    );
    frag.appendChild(ReaderView.DIV(
      { class : "outerbox", part : "outerbox" },
      [
        ReaderView.DIV(
          { part : "controls", class : "controls flex" },
          [
            ReaderView.LABEL(
              { for: "controlstoggle", text : "=" }
            ),
            ReaderView.INPUT(
              { type : "checkbox", id : "controlstoggle" }
            ),
            ReaderView.DIV(
              { class : "controlbar flex" },
              [
                ReaderView.DIV(
                  { class: "rangebox flex"},
                  [
                    ReaderView.DIV({ class: "button" }),
                    ReaderView.INPUT(
                      { type : "range", min : 1, max : 2, step : 0.1, value : 1.3 }
                    ),
                    ReaderView.DIV({ class: "button" })
                  ]
                ),
                ReaderView.CreateRadioGroup({
                  name: "texttype",
                  values: ["serif","sans"],
                  selected : "sans",
                  text : "Aa"
                }),
                ReaderView.CreateRadioGroup({
                  name: "theme",
                  values: ["sepia","pure","night"],
                  selected: "pure"
                })
              ]
            )
          ]
        ),
        ReaderView.DIV(
          { class : "innerbox", part : "innerbox" },
          [ ReaderView.SLOT({ "name" : "contentbox" }) ]
        )
      ]
      
    ));
    return frag
  }
  
  static async TryLoadFile(name){
    let response = await fetch(name);
    if(response.ok){
      let content = await response.text();
      return { content: content }
    }else{
      throw "no response"
    }
  }
}

customElements.define("reader-view",ReaderView);