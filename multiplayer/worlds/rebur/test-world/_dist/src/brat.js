import{__name}from"../chunk-EHGQLVHU.js";import{Behavior,UIPanel}from"@rebur/engine";var Brat=class extends Behavior{static{__name(this,"Brat")}#ui=this.entity.cast(UIPanel);onInitialize(){this.game.isServer()||(this.#ui.globalTransform.scale.assign({x:2.5,y:4}),this.#ui.element.append(document.createTextNode("brat")),this.#ui.element.style.color="black")}};export{Brat as default};
// built with <3 using rebur ^-^
//# sourceMappingURL=brat.js.map
