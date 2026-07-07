import{__name}from"../chunk-EHGQLVHU.js";import{Behavior,BehaviorDestroyed}from"@rebur/engine";var LogRepeatedly=class _LogRepeatedly extends Behavior{static{__name(this,"LogRepeatedly")}message="Hello, world!";onInitialize(){if(this.defineValue(_LogRepeatedly,"message"),!this.game.isServer())return;let interval=setInterval(()=>{console.log(this.message)},2500);this.on(BehaviorDestroyed,()=>{clearInterval(interval)})}};export{LogRepeatedly as default};
// built with <3 using rebur ^-^
//# sourceMappingURL=log-repeatedly.js.map
