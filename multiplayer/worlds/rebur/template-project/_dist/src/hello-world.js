var __defProp=Object.defineProperty;var __name=(target,value)=>__defProp(target,"name",{value,configurable:!0});import{Behavior}from"@rebur/engine";var HelloWorld=class extends Behavior{static{__name(this,"HelloWorld")}onInitialize(){console.log("hello world!")}onTick(){this.game.isServer()&&(this.entity.transform.rotation+=.01)}};export{HelloWorld as default};
// built with <3 using rebur ^-^
//# sourceMappingURL=hello-world.js.map
