import { Prop } from "../base/prop.js";
import { hasTag } from "../../items.js";

export class Rock extends Prop {
  constructor({ x = 0, y = 0, hp = 20 } = {}) {
    super({
      kind: "prop.rock",
      x,
      y,
      size: "large",
      radius: 20,
      hp,
      labels: ["rock"],
      tangible: true,
    });
  }

  interact(context = {}) {
    const { toolId, spawnDrop, emitter, damageMultiplier = 1 } = context;
    const dmg = toolId && hasTag(toolId, "mine") ? 5 : 2;
    const applied = Math.max(1, Math.floor(dmg * damageMultiplier));
    const remaining = Math.max(0, (this.hp ?? 20) - applied);
    this.hp = remaining;
    emitter?.emit("ping", `Rocha: HP ${remaining}`);
    if (remaining <= 0) {
      const shards = 1 + Math.floor(Math.random() * 3);
      spawnDrop?.("rockshard", { x: this.x, y: this.y, qty: shards });
      if (Math.random() < 0.5) {
        spawnDrop?.("coal", { x: this.x, y: this.y });
      }
      this.break(context);
    }
  }

  render(ctx, cam) {
    const x = this.x - cam.x;
    const y = this.y - cam.y;
    ctx.fillStyle = "#94a3b8";
    ctx.beginPath();
    ctx.arc(x, y, this.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}
