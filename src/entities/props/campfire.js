import { Prop } from "../base/prop.js";

const COOK_TIME_MS = 30000;
const COOK_MAP = {
  beef: "cookedbeef",
};

const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

export class Campfire extends Prop {
  constructor({ x = 0, y = 0 } = {}) {
    super({
      kind: "prop.campfire",
      x,
      y,
      size: "medium",
      radius: 16,
      hp: 14,
      labels: ["campfire"],
      tangible: true,
    });
    this.cooking = null;
  }

  isCooking() {
    return !!this.cooking;
  }

  canCook(itemId) {
    return !!COOK_MAP[itemId];
  }

  startCooking(itemId, context = {}) {
    if (!this.canCook(itemId) || this.isCooking()) return false;
    this.cooking = {
      itemId,
      doneAt: now() + COOK_TIME_MS,
    };
    context.emitter?.emit("ping", "Carne cozinhando (30s)");
    return true;
  }

  update(dt, context = {}) {
    if (!this.cooking) return;
    if (now() >= this.cooking.doneAt) {
      const cooked = COOK_MAP[this.cooking.itemId];
      context.spawnDrop?.(cooked, { x: this.x, y: this.y - 18, ttl: 240000 });
      context.emitter?.emit("ping", "Carne pronta!");
      this.cooking = null;
    }
  }

  break(context = {}) {
    if (!super.break(context)) return false;
    const { spawnDrop } = context;
    spawnDrop?.("coal", { x: this.x, y: this.y });
    spawnDrop?.("wood", { x: this.x, y: this.y });
    return true;
  }

  render(ctx, cam) {
    const x = this.x - cam.x;
    const y = this.y - cam.y;
    ctx.fillStyle = "#7c2d12";
    ctx.fillRect(x - 14, y - 6, 28, 12);

    const flicker = Math.sin((now() + this.x + this.y) * 0.01);
    const baseHeight = this.isCooking() ? 12 : 8;
    const height = baseHeight + flicker * 2;

    ctx.fillStyle = this.isCooking() ? "#fb923c" : "#f97316";
    ctx.beginPath();
    ctx.moveTo(x, y - height - 4);
    ctx.lineTo(x - 6, y + 2);
    ctx.lineTo(x + 6, y + 2);
    ctx.closePath();
    ctx.fill();

    if (this.isCooking()) {
      const gradient = ctx.createRadialGradient(x, y, 4, x, y, 36);
      gradient.addColorStop(0, "rgba(251,191,36,0.4)");
      gradient.addColorStop(1, "rgba(251,191,36,0)");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, 36, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
