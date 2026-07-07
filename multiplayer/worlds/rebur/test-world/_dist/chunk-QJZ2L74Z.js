import{__name}from"./chunk-EHGQLVHU.js";import{Behavior,PlayerLeft}from"@rebur/engine";var CleanupOnLeaveBehavior=class extends Behavior{static{__name(this,"CleanupOnLeaveBehavior")}onInitialize(){this.game.isServer()&&this.game.on(PlayerLeft,({connection})=>{connection.id===this.entity.authority&&this.entity.destroy()})}};export{CleanupOnLeaveBehavior};
// built with <3 using rebur ^-^
//# sourceMappingURL=chunk-QJZ2L74Z.js.map
