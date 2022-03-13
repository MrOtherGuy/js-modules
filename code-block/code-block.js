'use strict';

class CodeBlock extends HTMLElement{
  constructor(){
    super();
    let template = document.getElementById("code-block-template");
    let templateContent = template ? template.content : CodeBlock.Fragment();
    let cloned = templateContent.cloneNode(true);
    const shadowRoot = this.attachShadow({mode: 'open'})
    .appendChild(cloned);
    this.highlighter = {
      ready: false,
      waiting: false,
      fn: null,
      failed: false, 
      type: null,
      empty: true,
      linkGenerator: null,
      linkMatcher: null
    };
  }
  
  determineAndLoadContent(){
    CodeBlock.getSource(this.src)
    .then(
      (data) => this.consumeData(data),
      (e) => this.consumeData({content:this.textContent})
    );
    
  }
  
  get name(){
    return this.dataset.name;
  }
  set name(some){
    this.dataset.name = some;
    this.shadowRoot.querySelector("caption").textContent = some;
  }
  
  connectedCallback(){
    if(!this.isConnected || this.initialized){
      return
    }
    if(this.dataset.matchlinks){
      let parts = this.dataset.matchlinks.split(" -> ");
      // this is kinda sketchy
      if(parts.length === 2){
        try{
          this.highlighter.linkMatcher = new RegExp(parts[0],"g");
          this.highlighter.linkGenerator = (a) => (parts[1].replace("%s",a));
        }catch(e){
          console.warn(e);
          this.highlighter.linkMatcher = null;
          this.highlighter.linkGenerator = null;
        }
      }
    }
    if(this.dataset.name){
      this.name = this.dataset.name
    }
    this.initialized = true;
    if(this.highlighter.empty && this.dataset.highlight){
      CodeBlock.addHighlighterTo(this);
      return
    }
    this.determineAndLoadContent();
  }
  
  static addHighlighterTo(elem){
    if(elem instanceof CodeBlock){
      elem.highlighter.empty = false;
      switch(elem.dataset.highlight){
        case "css":
        case "simple":
          elem.highlighter.type = elem.dataset.highlight;
          elem.highlighter.waiting = true;
          break;
        default:
          console.warn("invalid highlighter");
          elem.determineAndLoadContent();
          return
      }
      import("./code-block-highlighter.js")
      .then(it => {
        switch(elem.highlighter.type){
          case "css":
            elem.highlighter.fn = new it.CSSHighlighter();
            break;
          case "simple":
            elem.highlighter.fn = new it.SimpleHighlighter();
        }
        elem.highlighter.ready = true;
        elem.highlighter.waiting = false;
        elem.determineAndLoadContent()
      })
      .catch(e => {
        console.error(e);
        elem.highlighter.failed = true;
        ele.highlighter.waiting = false;
        elem.determineAndLoadContent()
      })
    }
  }
  
  clearContent(){
    let innerbox = this.codeBox;
    while(innerbox.children.length){
      innerbox.children[0].remove();
    }
  }
  static getSource(some){
    return new Promise((res, rej) => {
      if(some && typeof some === "string"){
        CodeBlock.TryLoadFile(some)
        .then(res)
        .catch((e)=>{
          console.error(e);
          rej(e)
        })
      }else{
        setTimeout(()=>rej("argument must be a string"));
      }
    })
  }
  
  async setSource(some){
    this.clearContent();
    let res = await CodeBlock.getSource(some);
    if(res.ok){
      this.consumeData(res);
    }
    return { ok: res.ok }
  }
  
  get src(){
    return this.getAttribute("src")
  }
  set src(some){
    this.setSource(some);
  }
  
  async consumeData(some){
    const re = /.*\r?\n/g;
    let didAddNL = false;
    if(typeof some.content !== "string"){
      some.content = some.content.toString();
    }
    this.textContent = "";
    
    let innerbox = this.codeBox;
    const hasHighlighter = this.highlighter.ready;
    const LIMIT = 10000; // Arbitrary limit of 10k lines
    
    if(hasHighlighter){
      this.highlighter.fn.reset();
      const payload = {
        "match" : re.exec(some.content),
        "linkMatcher": this.highlighter.linkMatcher,
        "linkGenerator": this.highlighter.linkGenerator,
        "linkChanged": true,
      };
      Object.defineProperty(payload,"content",{get:()=>payload.match[0]});
      let counter = 0;
      let lastIdx = 0;
      
      while(payload.match && (counter++ < LIMIT)){
        innerbox.appendChild(CodeBlock.RowFragment.cloneNode(true));
        this.highlighter.fn.parse(
          payload,
          innerbox.lastElementChild.lastChild
        );
        payload.linkChanged = false;
        lastIdx = (payload.match.index + payload.match[0].length);
        payload.match = re.exec(some.content);
      }
      // Handle case where the content does not end with newline
      innerbox.appendChild(CodeBlock.RowFragment.cloneNode(true));
      if(lastIdx < some.content.length){
        payload.match = [some.content.slice(lastIdx)];
        this.highlighter.fn.parse(
          payload,
          innerbox.lastElementChild.lastChild
        );
      }
    }else{
      let match = re.exec(some.content);
      let counter = 0;
      let lastIdx = 0;
      
      while(match && (counter++ < LIMIT)){
        innerbox.appendChild(CodeBlock.RowFragment.cloneNode(true));
        innerbox.lastElementChild.lastChild.textContent = match[0];
        lastIdx = (match.index + match[0].length);
        match = re.exec(some.content);
      }
      // Handle case where the content does not end with newline
      innerbox.appendChild(CodeBlock.RowFragment.cloneNode(true));
      if(lastIdx < some.content.length){
        innerbox.lastElementChild.lastChild.textContent = some.content.slice(lastIdx);
      }
    }
  }
  get codeBox(){
    return this.shadowRoot.querySelector("tbody");
  }
  get value(){
    return this.codeBox.textContent
  }
  
  set value(thing){
    this.clearContent();
    if (typeof thing === "string"){
      this.consumeData({content:thing});
    }else if("content" in thing){
      this.consumeData(thing);
    }else{
      this.consumeData({content: thing.toString()})
    }
  }
  
  appendContent(thing){
    if(typeof thing === "string"){
      this.consumeData({content:thing});
    }else if("content" in thing){
      this.consumeData(thing);
    }else{
      this.consumeData({content: thing.toString()})
    }
  }
  
  static async TryLoadFile(name){
    let response = await fetch(name);
    if(response.ok){
      let content = await response.text();
      return { content: content, ok: true }
    }else{
      throw {error: "no response", ok: false }
    }
  }
  
  static RowFragment = (() => {
    let frag = new DocumentFragment();
    let tr = frag.appendChild(document.createElement("tr"));
    tr.appendChild(document.createElement("td"));
    tr.firstChild.setAttribute("class","line-number");
    tr.appendChild(document.createElement("td"));
    return frag
  })();
  
  static Fragment(){
    let frag = new DocumentFragment();
    let link = document.createElement("link");
    link.setAttribute("as","style");
    link.setAttribute("type","text/css");
    link.setAttribute("rel","preload prefetch stylesheet");
    link.setAttribute("href","code-block/code-block.css");
    frag.appendChild(link);
    let table = document.createElement("table");
    table.appendChild(document.createElement("caption"));
    table.appendChild(document.createElement("tbody"));
    frag.appendChild(table)

    return frag
  }
}

customElements.define("code-block",CodeBlock);
