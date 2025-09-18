import { Prop } from "../base/prop.js";
import { hasTag } from "../../items.js";

const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());
const SHAKE_COOLDOWN_MS = 4500;

export class NutTree extends Prop {
  constructor({ x = 0, y = 0, hp = 8 } = {}) {
    super({
      kind: "prop.nut-tree",
      x,
      y,
      size: "large",
      radius: 22,
      hp,
      labels: ["nut-tree"],
      tangible: true,
    });
    this.taps = 0;
    this.nextShakeAt = 0;
  }

  interact(context = {}) {
    const { toolId, spawnDrop, emitter } = context;
    const time = now();
    const isChop = toolId && hasTag(toolId, "chop");
    if (isChop) {
      const dmg = 1;
      const remaining = Math.max(0, (this.hp ?? 8) - dmg);
      this.hp = remaining;
      emitter?.emit("ping", `Machado na nogueira: HP ${remaining}`);
      if (remaining <= 0) {
        spawnDrop?.("wood", { x: this.x, y: this.y, qty: 6 });
        spawnDrop?.("nuts", { x: this.x, y: this.y, qty: 3 });
        if (Math.random() < 0.35) {
          spawnDrop?.("stick", { x: this.x, y: this.y, qty: 2 });
        }
        this.break(context);
      }
      return;
    }

    if (time < this.nextShakeAt) {
      const remaining = Math.ceil((this.nextShakeAt - time) / 1000);
      emitter?.emit("ping", `A árvore está se recompondo (${remaining}s)`);
      return;
    }

    this.taps += 1;
    const progress = this.taps;
    if (progress >= 10) {
      spawnDrop?.("nuts", { x: this.x, y: this.y });
      emitter?.emit("ping", "Uma noz caiu da árvore!");
      this.taps = 0;
      this.nextShakeAt = time + SHAKE_COOLDOWN_MS;
    } else {
      const remaining = 10 - progress;
      emitter?.emit("ping", `Continue balançando… ${remaining} tapas`);
    }
  }

  render(ctx, cam) {
    const x = this.x - cam.x;
    const y = this.y - cam.y;
    ctx.fillStyle = "#1f2937";
    ctx.fillRect(x - 7, y, 14, this.radius);
    ctx.fillStyle = "#0f5132";
    ctx.beginPath();
    ctx.arc(x, y, this.radius + 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#facc15";
    for (let i = 0; i < 4; i++) {
      const angle = Math.PI / 2 + (i * Math.PI) / 2;
      const px = x + Math.cos(angle) * (this.radius - 6);
      const py = y + Math.sin(angle) * (this.radius - 6);
      ctx.beginPath();
      ctx.ellipse(px, py, 4, 6, angle, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
