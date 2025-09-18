import { Entity } from "../base/entity.js";

const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

export class ItemDrop extends Entity {
  constructor(options) {
    const { itemId, qty = 1, meta = null, ttl = 300000, x = 0, y = 0 } = options || {};
    super({
      kind: "item.drop",
      x,
      y,
      size: "small",
      radius: 12,
      labels: ["drop", "item"],
      tangible: false,
    });
    this.itemId = itemId;
    this.qty = Math.max(1, qty);
    this.meta = meta;
    this.expiresAt = ttl ? now() + ttl : null;
  }

  update() {
    if (this.expiresAt && now() >= this.expiresAt) {
      this.dead = true;
    }
  }

  render(ctx, cam) {
    const x = this.x - cam.x;
    const y = this.y - cam.y;
    ctx.fillStyle = "#fde68a";
    ctx.beginPath();
    ctx.arc(x, y, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(30,64,175,.6)";
    ctx.stroke();
  }
}
