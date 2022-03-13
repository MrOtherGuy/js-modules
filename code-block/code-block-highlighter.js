'use strict';

class BaseHighlighter{
  constructor(){
    this.state = BaseHighlighter.createState();
  }
  reset(){
    this.state.reset();
  }
  parse(){
    if(!this.state.initialState){
      throw "This highlighter is not initialized";
    }
  }
  static createState(){
    return new (function(){
      this.token = "";
      let current = null;
      let previous = null;
      let initialState = null;
      this.set = (a) => {
        previous = current;
        current = a;
        return
      }
      this.now = () => current;
      this.previous = ()=> previous;
      this.initializeTo = (some) => { initialState = some }
      this.reset = () => {
        this.token = "";
        previous = initialState;
        current = initialState;
      }
    })();
  }
  static BaseState = Symbol("base");
}

class SimpleHighlighter extends BaseHighlighter{
  constructor(){
    super();
    this.state.initializeTo(BaseHighlighter.BaseState);
  }
  static State = {
    SingleQuote : Symbol("quote"),
    DoubleQuote : Symbol("quote")
  }
  
  parse(info,targetNode){
    if(info.content.length > 0){
      SimpleHighlighter.parseSimple(info,this.state,targetNode);
    }
    if(this.state.token){
      throw "simple token is not 0"
    }
    this.state.token = "";
  }
  
  static parseSimple(info,state,target){
    let pointer = 0;
    let currentState = state.now();
    const length = info.content.length;
    while(pointer < length){
      let character = info.content[pointer++];
      currentState = state.now();
      switch(currentState){
        case BaseHighlighter.BaseState:
          switch(character){
            case "\"":
              target.append(state.token);
              state.token = "\"";
              state.set(SimpleHighlighter.State.DoubleQuote);
              break;
            case "'":
              targetNode.append(state.token);
              state.token = "'";
              state.set(SimpleHighlighter.State.SingleQuote);
              break;
            default:
              state.token += character;
          }
          break;
        case SimpleHighlighter.State.SingleQuote:
          switch(character){
            case "'":
              target.appendChild(SimpleHighlighter.createQuote()).textContent = state.token + "'";
              state.token = "";
              state.set(BaseHighlighter.BaseState);
              break;
            default:
              state.token += character;
          }
          break;
        case SimpleHighlighter.State.DoubleQuote:
          switch(character){
            case "\"":
              target.appendChild(SimpleHighlighter.createQuote()).textContent = state.token + "\"";
              state.token = "";
              state.set(BaseHighlighter.BaseState);
              break;
            default:
              state.token += character;
          }
          break
      }
    }
    if(state.token.length > 0){
      if(currentState === BaseHighlighter.BaseState){
        target.append(state.token);
        state.token = "";
      }else{
        target.appendChild(SimpleHighlighter.createQuote()).textContent = state.token;
      }
    }
  }
  
  static createQuote(){
    let n = document.createElement("span");
    n.className = "quote";
    return n
  }
}

class CSSHighlighter extends BaseHighlighter{
  constructor(){
    super();
    this.state.initializeTo(CSSHighlighter.State.Selector);
    this.state.curly = false;
    this.state.fnLevel = 0;
    this.state.generateLinks = false;
  }
  
  reset(){
    this.state.reset();
    this.state.curly = false;
    this.state.fnLevel = 0;
  }
  
  parse(info,targetNode){
    if(info.content.length > 0){
      CSSHighlighter.parseCSS(info,this.state,targetNode);
    }
    if(this.state.token){
      throw "CSS token is not 0"
    }
    this.state.token = "";
  }
  
  static parseCSS(info,state,targetNode){
    let pointer = 0;
    state.generateLinks = (info.linkMatcher instanceof RegExp) && (typeof info.linkGenerator === "function");
    
    if(state.generateLinks && info.linkChanged){
      if (info.linkGenerator != state.linkGenerator){
        state.linkGenerator = info.linkGenerator;
      }
      if (info.linkMatcher != state.linkMatcher){
        state.linkMatcher = info.linkMatcher;
      }
    }
    
    const curlyRE = /[{}]/;
    let currentState;
    const length = info.content.length;
    while(pointer < length){
      let character = info.content[pointer];
      
      currentState = state.now();
      state.curly = currentState !== CSSHighlighter.State.Comment && curlyRE.test(character);
      if(!state.curly){
        state.token+=character;
      }
      switch(currentState){
      
        case CSSHighlighter.State.Selector:
          switch(character){
            case "/":
              if(info.content[pointer+1] === "*"){
                state.set(CSSHighlighter.State.Comment);
                if(state.token.length > 1){
                  state.token = state.token.slice(0,-1);
                  CSSHighlighter.createElementFromToken(state,CSSHighlighter.State.Selector,targetNode);
                  state.token += "/"
                }
              }
              break;
            case "{":
              state.set(CSSHighlighter.State.Property);
              CSSHighlighter.createElementFromToken(state,CSSHighlighter.State.Selector,targetNode);
              break;
            case "}":
              CSSHighlighter.createElementFromToken(state,CSSHighlighter.State.Text,targetNode);
              break;
            case "@":
              state.set(CSSHighlighter.State.AtRule);
          }
          
          break;
      
        case CSSHighlighter.State.Comment:
          switch(character){
            case "*":
              if(info.content[pointer+1] === "/"){
                state.token += "/";
                pointer++;
                state.set(state.previous());
                CSSHighlighter.createElementFromToken(state,CSSHighlighter.State.Comment,targetNode);
              }
          }
          break;

        case CSSHighlighter.State.Property:
          switch(character){
            case "/":
              if(info.content[pointer+1] === "*"){
                state.set(CSSHighlighter.State.Comment);
              }
              break;
            case ":":
              CSSHighlighter.createElementFromToken(state,CSSHighlighter.State.Property,targetNode);
              state.set(CSSHighlighter.State.Value);
              break;
            case "}":
              CSSHighlighter.createElementFromToken(state,CSSHighlighter.State.Text,targetNode);
              state.set(CSSHighlighter.State.Selector);
          }
          break;
        case CSSHighlighter.State.Value:
          switch(character){
            case ";":
              CSSHighlighter.createElementFromToken(state,CSSHighlighter.State.Value,targetNode);
              state.set(CSSHighlighter.State.Property);
              break;
            case "}":
              CSSHighlighter.createElementFromToken(state,CSSHighlighter.State.Value,targetNode);
              state.set(CSSHighlighter.State.Selector);
              break;
            case "(":
              CSSHighlighter.createElementFromToken(state,CSSHighlighter.State.Value,targetNode);
              state.fnLevel++;
              state.set(CSSHighlighter.State.Function);
          }
          break;
        case CSSHighlighter.State.AtRule:
          switch(character){
            case " ":
              CSSHighlighter.createElementFromToken(state,CSSHighlighter.State.AtRule,targetNode);
              state.set(CSSHighlighter.State.AtValue);
          }
          break;
        case CSSHighlighter.State.AtValue:
          switch(character){
            case ";":
            case "{":
              CSSHighlighter.createElementFromToken(state,CSSHighlighter.State.AtValue,targetNode);
              state.set(CSSHighlighter.State.Selector);
          }
          break
        case CSSHighlighter.State.Function:
          switch(character){
            case ")":
              state.fnLevel--;
              if(state.fnLevel === 0){
                CSSHighlighter.createElementFromToken(state,CSSHighlighter.State.Function,targetNode);
                state.token = ")";
                state.set(CSSHighlighter.State.Value);
              }
              break;
            case "}":
              state.fnLevel = 0;
              state.set(CSSHighlighter.State.Selector)
          }
        default:
          false
      }
      if(state.curly){
        CSSHighlighter.createElementFromToken(state,CSSHighlighter.State.Curly,targetNode,character);
      }
      pointer++
    }
    if(state.token.length){
      CSSHighlighter.createElementFromToken(state,currentState,targetNode)
    }
  }
  
  static State = {
    Selector: Symbol("selector"),
    Text:     Symbol("text"),
    Comment:  Symbol("comment"),
    Property: Symbol("property"),
    Value:    Symbol("value"),
    AtRule:   Symbol("atrule"),
    AtValue:  Symbol("atvalue"),
    Function: Symbol("function"),
    Curly:    Symbol("curly")
  }
  
  static selectorToClassMap = new Map([
    [":","pseudo"],
    ["#","id"],
    [".","class"],
    ["[","attribute"]
  ]);
  
  static createElementFromToken(state,type,targetNode,c){
    if(state.token.length === 0 && !c){
      return
    }
    let n = document.createElement("span");
    switch(type){
      case CSSHighlighter.State.Selector:
      // This isn't exactly correct, but it works because parser treats \r\n sequences that follow a closed comment as "selector"
        //rulesetUnderConstruction = createNewRuleset();
        let parts = state.token.split(/([\.#:\[]\w[\w-_"'=\]]*|\s\w[\w-_"'=\]]*)/);
      
        for(let part of parts){
          if(part.length === 0){
            continue
          }
          let character = part[0];
          switch (character){
            case ":":
            case "#":
            case "[":
            case ".":
              let p = n.appendChild(document.createElement("span"));
              p.className = CSSHighlighter.selectorToClassMap.get(character);
              p.textContent = part;
              break;
            default:
              n.append(part);
          }
        }
        break
      case CSSHighlighter.State.Comment:
        if(state.generateLinks){
          let linksToFile = state.token.match(state.linkMatcher);
          if(linksToFile && linksToFile.length){
            const transformed = linksToFile.map(state.linkGenerator);
            n.append(CSSHighlighter.createLinksFromMatchingToken(linksToFile,transformed,state));
            break;
          }
        }
        n.textContent = c || state.token;
        break;
      case CSSHighlighter.State.Value:
        let startImportant = state.token.indexOf("!");
        if(startImportant === -1){
          n.textContent = c || state.token;
        }else{
          n.textContent = state.token.substr(0,startImportant);
          let importantTag = document.createElement("span");
          importantTag.className = "important-tag";
          importantTag.textContent = "!important";
          n.appendChild(importantTag);
          if(state.token.length > (9 + startImportant)){
            n.append(";")
          }
        }
        break;
      case CSSHighlighter.State.Function:
        n.textContent = c || state.token.slice(0,-1);
        break
      default:
        n.textContent = c || state.token;
    }
    
    n.className = (`token ${type.description}`);
    state.token = "";
    targetNode.appendChild(n);
    return
  }
  static createLinksFromMatchingToken(parts,transformed,state){
    let frag = new DocumentFragment();
    let linkIdx = 0;
    let fromIdx = 0;
    while(linkIdx < parts.length){
      let part = parts[linkIdx];
      let idx = state.token.indexOf(part);
      frag.append(state.token.substring(fromIdx,idx));
      let link = document.createElement("a");
      link.textContent = part;
      link.href = transformed[linkIdx++];
      link.target = "_blank";
      frag.appendChild(link);
      fromIdx = idx + part.length;
    }
    frag.append(state.token.substring(fromIdx));
    return frag
  }
}

export { CSSHighlighter,SimpleHighlighter }