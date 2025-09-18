import { Entity } from "../base/entity.js";

const getTime = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

export class Coin extends Entity {
  constructor({ x = 0, y = 0 } = {}) {
    super({ kind: "item.coin", x, y, size: "small", radius: 10, labels: ["coin"] });
    this.tangible = false;
  }

  render(ctx, cam) {
    const t = getTime() / 400;
    const bob = Math.sin(t + (this.x + this.y) * 0.001) * 2;
    ctx.fillStyle = "#fbbf24";
    ctx.beginPath();
    ctx.arc(this.x - cam.x, this.y - cam.y + bob, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#a16207";
    ctx.stroke();
  }
}
