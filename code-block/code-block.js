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
      (data) => this.consumeData(data,CodeBlock.InsertMode.Replace),
      (e) => this.consumeData({content:this.textContent},CodeBlock.InsertMode.Replace)
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
    
    if(this.copyable){
      CodeBlock.addClipboardListenerTo(this);
    }
    
    if(this.highlighter.empty && this.dataset.highlight){
      CodeBlock.addHighlighterTo(this);
      return
    }

    this.determineAndLoadContent();
  }
  
  get copyable(){
    return this.classList.contains("copy-able")
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
  
  static addClipboardListenerTo(aBlock){
    let copyButton = aBlock.copyButton;
    if(copyButton){
      return
    }
    copyButton = aBlock.shadowRoot.querySelector(".copy-button");
    aBlock.copyButton = copyButton;
   
    copyButton.addEventListener("click",(e) => {
      e.preventDefault();
      try{
        let writing = navigator.clipboard.writeText(aBlock.value);
        writing.then(()=>{
          copyButton.classList.add("copy-success");
          setTimeout(()=>copyButton.classList.remove("copy-success"),2000);
        });
        
      }catch(e){
        console.error("couldn't copy content to clipboard");
      }
      
    });
    aBlock.copyButton.removeAttribute("hidden");
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
      this.consumeData(res,CodeBlock.InsertMode.Replace);
    }
    return { ok: res.ok }
  }
  
  get src(){
    return this.getAttribute("src")
  }
  set src(some){
    this.setSource(some);
  }
  async consumeData(some,insertMode){
    const re = /.*\r?\n/g;
    if(typeof some.content !== "string"){
      some.content = some.content.toString();
    }
    this.textContent = "";
    
    const fragment = new DocumentFragment();
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
        fragment.appendChild(CodeBlock.RowFragment.cloneNode(true));
        this.highlighter.fn.parse(
          payload,
          fragment.lastElementChild.lastChild
        );
        payload.linkChanged = false;
        lastIdx = (payload.match.index + payload.match[0].length);
        payload.match = re.exec(some.content);
      }
      // Handle case where the content does not end with newline
      fragment.appendChild(CodeBlock.RowFragment.cloneNode(true));
      if(lastIdx < some.content.length){
        payload.match = [some.content.slice(lastIdx)];
        this.highlighter.fn.parse(
          payload,
          fragment.lastElementChild.lastChild
        );
      }
    }else{
      let match = re.exec(some.content);
      let counter = 0;
      let lastIdx = 0;
      
      while(match && (counter++ < LIMIT)){
        fragment.appendChild(CodeBlock.RowFragment.cloneNode(true));
        fragment.lastElementChild.lastChild.textContent = match[0];
        lastIdx = (match.index + match[0].length);
        match = re.exec(some.content);
      }
      // Handle case where the content does not end with newline
      fragment.appendChild(CodeBlock.RowFragment.cloneNode(true));
      if(lastIdx < some.content.length){
        fragment.lastElementChild.lastChild.textContent = some.content.slice(lastIdx);
      }
    }
    let innerbox = this.codeBox;
    
    switch(insertMode){
      case CodeBlock.InsertMode.Prepend:
        innerbox.insertBefore(fragment,innerbox.firstChild);
        break;
      case CodeBlock.InsertMode.Replace:
        this.clearContent();
      case CodeBlock.InsertMode.Append:
        // Push the first "line" of new fragment to the last line of old content, if old content exists
        if(innerbox.lastElementChild){
          let first = fragment.firstChild.lastElementChild;
          for(let one of Array.from(first.childNodes)){
            innerbox.lastElementChild.lastChild.appendChild(one)
          }
          fragment.firstChild.remove();
        }
        innerbox.appendChild(fragment);
        break;
      default:
        console.warn("unimplemented insertMode")
    }
    
  }
  get codeBox(){
    return this.shadowRoot.querySelector("tbody");
  }
  get value(){
    return this.codeBox.textContent
  }
  
  set value(thing){
    if(typeof thing === "string"){
      this.consumeData({content:thing},CodeBlock.InsertMode.Replace);
    }else if("content" in thing){
      this.consumeData(thing,CodeBlock.InsertMode.Replace);
    }else{
      this.consumeData({content: thing.toString()},CodeBlock.InsertMode.Replace);
    }
  }
  
  appendContent(thing){
    if(typeof thing === "string"){
      this.consumeData({content:thing},CodeBlock.InsertMode.Append);
    }else if("content" in thing){
      this.consumeData(thing,CodeBlock.InsertMode.Append);
    }else{
      this.consumeData({content: thing.toString()},CodeBlock.InsertMode.Append);
    }
  }
  
  prependContent(thing){
    if(typeof thing === "string"){
      this.consumeData({content:thing},CodeBlock.InsertMode.Prepend);
    }else if("content" in thing){
      this.consumeData(thing,CodeBlock.InsertMode.Prepend);
    }else{
      this.consumeData({content: thing.toString()},CodeBlock.InsertMode.Prepend);
    }
  }
  
  static InsertMode = {
    Replace : Symbol("replace"),
    Append : Symbol("append"),
    Prepend : Symbol("prepend")
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
    let outerBox = frag.appendChild(document.createElement("div"));
    outerBox.setAttribute("part","outerBox");
    outerBox.className = "outerBox";
    let copyButton = outerBox.appendChild(document.createElement("div"));
    copyButton.setAttribute("part","copyButton");
    copyButton.className = "copy-button";
    copyButton.textContent = "Copy";
    copyButton.setAttribute("hidden",true);
    copyButton.setAttribute("role","button");
    let table = document.createElement("table");
    let caption = table.appendChild(document.createElement("caption"));
    caption.setAttribute("part","title");
    let content = table.appendChild(document.createElement("tbody"));
    content.setAttribute("part","content");
    outerBox.appendChild(table)

    return frag
  }
}

customElements.define("code-block",CodeBlock);
