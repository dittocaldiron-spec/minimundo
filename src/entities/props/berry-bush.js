import { Prop } from "../base/prop.js";

const COOLDOWN_MS = 20 * 60 * 1000;
const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

export class BerryBush extends Prop {
  constructor({ x = 0, y = 0 } = {}) {
    super({
      kind: "prop.berry-bush",
      x,
      y,
      size: "medium",
      radius: 18,
      hp: 10,
      labels: ["berry-bush"],
    });
    this.nextHarvestAt = 0;
  }

  interact(context = {}) {
    const time = now();
    if (time < this.nextHarvestAt) {
      const remaining = Math.max(0, this.nextHarvestAt - time);
      const minutes = Math.ceil(remaining / 60000);
      context.emitter?.emit(
        "ping",
        `A moita precisa repousar (~${minutes} min restantes)`
      );
      return;
    }
    const qty = 3 + Math.floor(Math.random() * 3);
    context.spawnDrop?.("berries", { x: this.x, y: this.y, qty });
    context.emitter?.emit("ping", `Colheu ${qty} berries!`);
    this.nextHarvestAt = time + COOLDOWN_MS;
  }

  break(context = {}) {
    if (!super.break(context)) return false;
    const { spawnDrop } = context;
    const qty = 2 + Math.floor(Math.random() * 2);
    spawnDrop?.("berries", { x: this.x, y: this.y, qty });
    if (Math.random() < 0.35) {
      spawnDrop?.("stick", { x: this.x, y: this.y });
    }
    return true;
  }

  render(ctx, cam) {
    const x = this.x - cam.x;
    const y = this.y - cam.y;
    ctx.fillStyle = "#166534";
    ctx.beginPath();
    ctx.arc(x, y, this.radius + 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f87171";
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI * 2 * i) / 6;
      const px = x + Math.cos(angle) * (this.radius - 4);
      const py = y + Math.sin(angle) * (this.radius - 4);
      ctx.beginPath();
      ctx.arc(px, py, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
