import { GameRender, SolidColor, Text } from "@dreamlab/engine";

export const color = game.local.spawn({
  type: SolidColor,
  name: SolidColor.name,
  values: { color: "#8ace00ff" },
  transform: { position: { x: 1, y: 1 } },
});

export const text = color.spawn({
  type: Text,
  name: Text.name,
  values: { text: "brat", color: "black", align: "center", buffer: 0.4 },
  transform: { z: 10 },
});

game.on(GameRender, () => {
  color.globalTransform.rotation += game.time.delta / 1000;
  color.globalTransform.scale.x = (Math.sin(game.time.now / 1200) + 1.5) / 2;
  color.globalTransform.scale.y = (Math.cos(game.time.now / 700) + 1.5) / 2;
});
