import { Prop } from "../base/prop.js";
import { hasTag } from "../../items.js";

export class Tree extends Prop {
  constructor({ x = 0, y = 0, hp = 5 } = {}) {
    super({
      kind: "prop.tree",
      x,
      y,
      size: "large",
      radius: 22,
      hp,
      labels: ["tree"],
      tangible: true,
    });
    this.taps = 0;
  }

  interact(context = {}) {
    const { toolId, spawnDrop, emitter } = context;
    const isChop = toolId && hasTag(toolId, "chop");
    if (isChop) {
      const remaining = Math.max(0, (this.hp ?? 5) - 1);
      this.hp = remaining;
      emitter?.emit("ping", `Machado na árvore: HP ${remaining}`);
      if (remaining <= 0) {
        for (let i = 0; i < 8; i++) {
          spawnDrop?.("wood", { x: this.x, y: this.y });
        }
        const saplings = Math.random() < 0.5 ? 1 : 3;
        for (let i = 0; i < saplings; i++) {
          spawnDrop?.("sapling", { x: this.x, y: this.y });
        }
        if (Math.random() < 0.4) {
          spawnDrop?.("stick", { x: this.x, y: this.y, qty: 2 });
        }
        this.break(context);
      }
    } else {
      this.taps = (this.taps || 0) + 1;
      if (this.taps % 10 === 0) {
        spawnDrop?.("stick", { x: this.x, y: this.y });
        emitter?.emit("ping", "Graveto conseguido!");
      } else {
        const remaining = 10 - (this.taps % 10);
        emitter?.emit("ping", `Continue batendo… faltam ${remaining} golpes`);
      }
    }
  }

  render(ctx, cam) {
    const x = this.x - cam.x;
    const y = this.y - cam.y;
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(x - 6, y, 12, this.radius);
    ctx.fillStyle = "#10b981";
    ctx.beginPath();
    ctx.arc(x, y, this.radius + 10, 0, Math.PI * 2);
    ctx.fill();
  }
}
