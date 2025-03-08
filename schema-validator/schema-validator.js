// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: Copyright 2025 MrOtherGuy

export class SchemaValidator{
  #schema;
  constructor(obj,safe){
    if(safe === SchemaValidator.#safeToken){
      this.#schema = obj
    }else{
      let json = JSON.parse(JSON.stringify(obj));
      SchemaValidator.#testSchema(json);
      this.#schema = json
    }
  }
  validate(obj){
    return SchemaValidator.#matchAgainst(this.#schema,obj)
  }
  static #safeToken = Symbol("safe-json");
  static #matchAgainst(ref,tested){
    if(ref.type === "array" && Array.isArray(tested)){
      for(let item of tested){
        SchemaValidator.#matchAgainst(ref.items,item)
      }
    }else{      
      const type = typeof tested;
      if(ref.type !== type){
        throw SchemaValidator.ValidationError(`Expected ${ref.type} but found ${type}`)
      }
      if(ref.type === "object"){
        if(ref.required){
          for(let prop of ref.required){
            if(!tested[prop]){
              throw SchemaValidator.ValidationError(`Expected required property ${prop} doesn't exist`)
            }
          }
        }
        if(ref.additionalProperties === true){
          for(let [key,val] of Object.entries(tested)){
            if(ref.properties[key]){
              SchemaValidator.#matchAgainst(ref.properties[key],val)
            }
          }
        }else{
          for(let [key,val] of Object.entries(tested)){
            if(!ref.properties[key]){
              throw SchemaValidator.ValidationError(`Unexpected property "${key}"`)
            }else{
              SchemaValidator.#matchAgainst(ref.properties[key],val)
            }
          }
        }
      }
      if(ref.type === "string" && ref.pattern){
        if(!RegExp(ref.pattern).test(tested)){
          throw SchemaValidator.ValidationError(`Value "${tested}" doesn't match pattern`)
        }
      }
    }
    return true
  }
  static #checkSchemaValidityForObject(obj,required){
    if(!obj.properties){
      throw SchemaValidator.InvalidError('Expected property "properties"')
    }
    if(!Object.getPrototypeOf(obj.properties).isPrototypeOf(Object)){
      throw SchemaValidator.InvalidError('Property "properties" is not an object')
    }
    for(let prop of required){
      if(!obj.properties[prop]){
        throw SchemaValidator.InvalidError(`Required property "${prop}" is not defined`)
      }
      SchemaValidator.#testSchema(obj.properties[prop])
    }
    return true
  }
  static #checkSchemaValidityForArray(obj){
    if(!obj.items){
      throw SchemaValidator.InvalidError('Expected property "items"')
    }
    if(!Object.getPrototypeOf(obj.items).isPrototypeOf(Object)){
      throw SchemaValidator.InvalidError('Property "items" is not an object')
    }
    return SchemaValidator.#testSchema(obj.items)
  }
  static async forSchemaFile(url){
    let res = await fetch(url);
    if(res.ok){
      let json = await res.json();
      SchemaValidator.#testSchema(json);
      return new SchemaValidator(json,SchemaValidator.#safeToken);
    }
    throw new Error("Schema could not be loaded")
  }
  static #testSchema(obj){
    let { type } = obj;
    
    if(type === "array"){
      SchemaValidator.#checkSchemaValidityForArray(obj)
    }else if(type === "object"){
      let required = obj.required || [];
      SchemaValidator.#checkSchemaValidityForObject(obj,required)
    }else if(!["string", "boolean","number"].includes(type)){
      throw SchemaValidator.InvalidError()
    }
    return true
  }
  static InvalidError(text = "invalid schema"){
    return new Error(text)
  }
  static ValidationError(text){
    return new Error(`Schema validation failed: ${text}`)
  }
}