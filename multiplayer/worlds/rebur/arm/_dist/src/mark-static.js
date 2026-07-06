import{__name}from"../chunk-XLUYARKG.js";import{Behavior,PixiEntity}from"@rebur/engine";var MarkStatic=class extends Behavior{static{__name(this,"MarkStatic")}onInitialize(){let queue=[...this.entity.children.values()];for(;queue.length>0;){let entity=queue.shift();queue.push(...entity.children.values()),entity instanceof PixiEntity&&(entity.static=!0)}}};export{MarkStatic as default};
// built with <3 using rebur ^-^
//# sourceMappingURL=mark-static.js.map
