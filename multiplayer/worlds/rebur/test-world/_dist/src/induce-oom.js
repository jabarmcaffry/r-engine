import{__name}from"../chunk-EHGQLVHU.js";import{Behavior}from"@rebur/engine";var InduceOOM=class extends Behavior{static{__name(this,"InduceOOM")}data={};onTickServer(){if(this.game.time.ticks>60){let buf1=new Uint8Array(64);for(;;)crypto.getRandomValues(buf1)}}};export{InduceOOM as default};
// built with <3 using rebur ^-^
//# sourceMappingURL=induce-oom.js.map
