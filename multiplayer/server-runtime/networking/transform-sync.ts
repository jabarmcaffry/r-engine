import {
  ConnectionId,
  Entity,
  EntityDescendantSpawned,
  EntityExclusiveAuthorityChanged,
  EntityTransformUpdate,
  InternalGameTick,
  ITransform,
  Transform,
} from "@rebur/engine";
import * as internal from "@rebur/engine/internal";
import { transformFor, transformsEq } from "@rebur/proto/common/transform.ts";
import { PlayPacket } from "@rebur/proto/play.ts";
import { Simplify } from "@rebur/vendor/type-fest.ts";
import { ServerNetworkSetupRoutine } from "./net-manager.ts";

export const handleTransformSync: ServerNetworkSetupRoutine = (net, game) => {
  const ignoredEntityRefs = new Set<string>();
  const transformDirtyEntities = new Set<Entity>();

  const lastTransforms = new WeakMap<Entity, ITransform>();

  game.world.on(EntityDescendantSpawned, event => {
    const entity = event.descendant;
    entity.on(EntityTransformUpdate, ({ source, fromNetwork }) => {
      if (source !== entity) return;
      if (fromNetwork !== undefined) return;

      if (!ignoredEntityRefs.has(source.ref)) {
        transformDirtyEntities.add(entity);
      }
    });
  });

  type EntityTransformReports = Simplify<
    Omit<PlayPacket<"ReportEntityTransforms", "client">, "t">
  >;

  const entityTransformReports: EntityTransformReports = {
    ref: [],
    posX: [],
    posY: [],
    posZ: [],
    rotX: [],
    rotY: [],
    rotZ: [],
    rotW: [],
    sclX: [],
    sclY: [],
    sclZ: [],
    tp: [],
  };

  game.on(
    InternalGameTick,
    () => {
      for (const entity of transformDirtyEntities.values()) {
        // if (entity.authority !== undefined && entity.authority !== game.network.self) continue;

        if (entity.name.includes(".NoNetTransform")) {
          continue;
        }

        const currTransform = transformFor(entity);
        const lastTransform = lastTransforms.get(entity);
        if (!lastTransform || !transformsEq(lastTransform, currTransform)) {
          lastTransforms.set(entity, currTransform);

          const transform = entity.transform;
          entityTransformReports.ref.push(entity.ref);
          entityTransformReports.posX.push(transform.position.x);
          entityTransformReports.posY.push(transform.position.y);
          entityTransformReports.posZ.push(transform.position.z);
          entityTransformReports.rotX.push(transform.rotation.x);
          entityTransformReports.rotY.push(transform.rotation.y);
          entityTransformReports.rotZ.push(transform.rotation.z);
          entityTransformReports.rotW.push(transform.rotation.w);
          entityTransformReports.sclX.push(transform.scale.x);
          entityTransformReports.sclY.push(transform.scale.y);
          entityTransformReports.sclZ.push(transform.scale.z);
          entityTransformReports.tp.push(entity[internal.entityTeleportingThisTick]);
        }
      }

      if (entityTransformReports.ref.length > 0) {
        net.broadcast({
          t: "ReportEntityTransforms",
          ...entityTransformReports,
        });

        // clear arrays
        entityTransformReports.ref.length = 0;
        entityTransformReports.posX.length = 0;
        entityTransformReports.posY.length = 0;
        entityTransformReports.posZ.length = 0;
        entityTransformReports.rotX.length = 0;
        entityTransformReports.rotY.length = 0;
        entityTransformReports.rotZ.length = 0;
        entityTransformReports.rotW.length = 0;
        entityTransformReports.sclX.length = 0;
        entityTransformReports.sclY.length = 0;
        entityTransformReports.sclZ.length = 0;
        entityTransformReports.tp.length = 0;
      }

      transformDirtyEntities.clear();
    },
    { priority: -10 },
  );

  function announceAuthority(
    entity: Entity,
    clock: number,
    authority: ConnectionId | undefined,
  ) {
    const applyAuthority = (e: Entity) => {
      e[internal.entityForceAuthorityValues](authority, clock);
      for (const child of e.children.values()) applyAuthority(child);
    };
    applyAuthority(entity);

    net.broadcast({
      t: "AnnounceExclusiveAuthority",
      entity: entity.ref,
      clock,
      to: authority,
    });
  }

  game.on(EntityExclusiveAuthorityChanged, event => {
    announceAuthority(event.entity, event.clock, event.authority);
  });

  net.registerPacketHandler("RequestExclusiveAuthority", (from, packet) => {
    const entity = game.entities.lookupByRef(packet.entity);
    if (entity === undefined) {
      throw new Error("no such entity " + packet.entity);
    }

    const clock = entity[internal.entityAuthorityClock];

    if (
      packet.clock > clock ||
      (packet.clock === clock && entity.authority !== undefined && from! < entity.authority)
    ) {
      announceAuthority(entity, packet.clock, from);
    } else {
      net.send(from, {
        t: "DenyExclusiveAuthority",
        entity: entity.ref,
        clock: clock,
        current_authority: entity.authority,
      });
    }
  });

  net.registerPacketHandler("RelinquishExclusiveAuthority", (from, packet) => {
    const entity = game.entities.lookupByRef(packet.entity);
    if (entity === undefined) return;
    if (entity.authority !== from) return;

    const clock = entity[internal.entityAuthorityClock];
    announceAuthority(entity, clock + 1, undefined);
  });

  net.registerPacketHandler("ReportEntityTransforms", (from, packet) => {
    for (let i = 0; i < packet.ref.length; i++) {
      const entity = game.entities.lookupByRef(packet.ref[i]);
      if (entity === undefined) continue;
      if (entity.authority === undefined || from === entity.authority) {
        ignoredEntityRefs.add(entity.ref);
        entity[internal.transformFromNetwork](
          from,
          new Transform({
            position: {
              x: packet.posX[i],
              y: packet.posY[i],
              z: packet.posZ[i],
            },
            rotation: {
              x: packet.rotX[i],
              y: packet.rotY[i],
              z: packet.rotZ[i],
              w: packet.rotW[i],
            },
            scale: {
              x: packet.sclX[i],
              y: packet.sclY[i],
              z: packet.sclZ[i],
            },
          }),
          true,
        );
        ignoredEntityRefs.delete(entity.ref);
      }
    }

    net.broadcast({
      ...packet,
      from,
    });
  });
};
