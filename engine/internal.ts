export const internalEntity = Symbol.for("rebur.internal.internalEntity");
export const interpolationStartTick = Symbol.for("rebur.internal.interpolationStartTick");
export const applyNetworkInterpolation = Symbol.for(
  "rebur.internal.applyNetworkInterpolation",
);
export const interpolationStartFrame = Symbol.for("rebur.internal.interpolationStartFrame");
export const entityTickingOrder = Symbol.for("rebur.internal.entityTickingOrder");
export const entityTickingOrderDirty = Symbol.for("rebur.internal.entityTickingOrderDirty");
export const entityNotifyEnableChanged = Symbol.for(
  "rebur.internal.entityNotifyEnableChanged",
);
export const submitEntityTickingOrder = Symbol.for(
  "rebur.internal.submitEntityTickingOrder",
);
export const entitySetEnabledFromNetwork = Symbol.for(
  "rebur.internal.entitySetEnabledFromNetwork",
);
export const behaviorLoader = Symbol.for("rebur.internal.behaviorLoader");
export const behaviorSpawn = Symbol.for("rebur.internal.behaviorSpawn");
export const behaviorHotReloading = Symbol.for("rebur.internal.behaviorHotReloading");
export const vectorForceUpdate = Symbol.for("rebur.internal.vectorForceUpdate");
export const vectorOnChanged = Symbol.for("rebur.internal.vectorOnChanged");
export const transformOnChanged = Symbol.for("rebur.internal.transformOnChanged");
export const transformForceUpdate = Symbol.for("rebur.internal.transformForceUpdate");
export const transformFromNetwork = Symbol.for("rebur.internal.transformFromNetwork");
export const timeTick = Symbol.for("rebur.internal.timeTick");
export const timeIncrement = Symbol.for("rebur.internal.timeIncrement");
export const timeSetMode = Symbol.for("rebur.internal.timeSetMode");
export const inputsRegisterHandlers = Symbol.for("rebur.internal.inputsRegisterHandlers");
export const inputsShutdownFn = Symbol.for("rebur.internal.inputsShutdownFn");
export const actionSetHeld = Symbol.for("rebur.internal.actionSetHeld");
export const uiInit = Symbol.for("rebur.internal.uiInit");
export const uiDestroy = Symbol.for("rebur.internal.uiDestroy");
export const entityForceAuthorityValues = Symbol.for(
  "rebur.internal.entityForceAuthorityValues",
);
export const entityAuthorityClock = Symbol.for("rebur.internal.entityAuthorityClock");
export const entitySpawn = Symbol.for("rebur.internal.entitySpawn");
export const entitySpawnFinalize1 = Symbol.for("rebur.internal.entitySpawnFinalize1");
export const entitySpawnFinalize2 = Symbol.for("rebur.internal.entitySpawnFinalize2");
export const entityDoneSpawning = Symbol.for("rebur.internal.entityDoneSpawning");
export const entityDestroy = Symbol.for("rebur.internal.entityDestroy");
export const entityStoreRegister = Symbol.for("rebur.internal.entityStoreRegister");
export const entityStoreRegisterRoot = Symbol.for("rebur.internal.entityStoreRegisterRoot");
export const entityStoreUnregister = Symbol.for("rebur.internal.entityStoreUnregister");
export const entityTypeRegistry = Symbol.for("rebur.internal.entityTypeRegistry");
export const entityOwnEnabled = Symbol.for("rebur.internal.entityOwnEnabled");
export const entityTeleportingThisTick = Symbol.for(
  "rebur.internal.entityTeleportingThisTick",
);
export const entityApplyPhysicsUpdate = Symbol.for(
  "rebur.internal.entityApplyPhysicsUpdate",
);
export const entityPreparePhysicsUpdate = Symbol.for(
  "rebur.internal.entityPreparePhysicsUpdate",
);
export const entityFireEnabledSignals = Symbol.for(
  "rebur.internal.entityFireEnabledSignals",
);
export const entityGenerateDefinition = Symbol.for(
  "rebur.internal.entityGenerateDefinition",
);
export const entitySerializedData = Symbol.for("rebur.internal.entitySerializedData");
export const entityGenerateBehaviorDefinition = Symbol.for(
  "rebur.internal.entityGenerateBehaviorDefinition",
);
export const valueRelatedEntity = Symbol.for("rebur.internal.valueRelatedEntity");
export const valueApplyUpdate = Symbol.for("rebur.internal.valueApplyUpdate");
export const defineValuesProperties = Symbol.for("rebur.internal.defineValuesProperties");
export const implicitSetup = Symbol.for("rebur.internal.implicitBehaviorSetup");
export const clickableTeardownGame = Symbol.for("rebur.internal.clickableTeardownGame");
export const rendererInit = Symbol.for("rebur.internal.rendererInit");
export const rendererRender = Symbol.for("rebur.internal.rendererRender");
export const randomBoxMuller = Symbol.for("rebur.internal.randomBoxMuller");
export const colliderReparentBody = Symbol.for("rebur.internal.colliderReparentBody");
export const syncedObjectContainerObjectsField = Symbol.for(
  "rebur.internal.syncedObjectContainerObjectsField",
);
export const syncedObjectContainerReadyField = Symbol.for(
  "rebur.internal.syncedObjectContainerReadyField",
);
export const preloadInfo = Symbol.for("rebur.internal.preloadInfo");
export const emitCharacterControllerCollisions = Symbol.for(
  "rebur.internal.emitCharacterControllerCollisions",
);
export const httpAPIHandle = Symbol.for("rebur.internal.httpAPIHandle");

export { preload } from "./preload.ts";
