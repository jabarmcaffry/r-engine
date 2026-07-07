import {
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
import { ClientNetworkSetupRoutine } from "./net-connection.ts";

export const handleTransformSync: ClientNetworkSetupRoutine = (conn, game) => {
  const ignoredEntityRefs = new Set<string>();
  const transformDirtyEntities = new Set<Entity>();

  const lastTransforms = new WeakMap<Entity, ITransform>();

  game.world.on(EntityDescendantSpawned, event => {
    const entity = event.descendant;
    entity.on(EntityTransformUpdate, event => {
      if (event.source !== entity) return;
      if (event.fromNetwork !== undefined) return;

      if (!ignoredEntityRefs.has(event.source.ref)) {
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
        if (entity.name.includes(".NoNetTransform")) {
          continue;
        }

        if (entity.authority !== undefined && entity.authority !== game.network.self) continue;

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
        conn.send({
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

  game.on(EntityExclusiveAuthorityChanged, event => {
    const entity = event.entity;
    if (event.authority === conn.id) {
      conn.send({
        t: "RequestExclusiveAuthority",
        entity: entity.ref,
        clock: event.clock,
      });
    } else if (entity.authority === conn.id) {
      conn.send({
        t: "RelinquishExclusiveAuthority",
        entity: entity.ref,
      });
    }
  });

  conn.registerPacketHandler("ReportEntityTransforms", packet => {
    if (packet.from === conn.id) return;
    for (let i = 0; i < packet.ref.length; i++) {
      const entity = game.entities.lookupByRef(packet.ref[i]);
      if (entity === undefined) continue;
      if (entity.authority === conn.id && packet.from !== undefined) continue;

      ignoredEntityRefs.add(entity.ref);
      entity[internal.transformFromNetwork](
        packet.from ?? "server",
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
        packet.tp[i],
      );
      ignoredEntityRefs.delete(entity.ref);
    }
  });

  conn.registerPacketHandler("AnnounceExclusiveAuthority", packet => {
    const entity = game.entities.lookupByRef(packet.entity);
    if (entity === undefined) return;

    const applyAuthority = (e: Entity) => {
      e[internal.entityForceAuthorityValues](packet.to, packet.clock);
      for (const child of e.children.values()) applyAuthority(child);
    };
    applyAuthority(entity);
  });

  conn.registerPacketHandler("DenyExclusiveAuthority", packet => {
    const entity = game.entities.lookupByRef(packet.entity);
    if (entity === undefined) return;
    entity[internal.entityForceAuthorityValues](packet.current_authority, packet.clock);
  });
};
