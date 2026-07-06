import{__name}from"../chunk-N2LXI5YA.js";import{Behavior}from"@rebur/engine";var SPEED=1,SpinBehavior=class extends Behavior{static{__name(this,"SpinBehavior")}onTick(){if(!this.game.isServer())return;let tau=2*Math.PI;this.entity.globalTransform.rotation-=SPEED*tau*(this.game.time.delta/1e3)}};export{SpinBehavior as default};
// built with <3 using rebur ^-^
//# sourceMappingURL=spin.js.map
