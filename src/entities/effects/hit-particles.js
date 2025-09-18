import { Entity } from "../base/entity.js";

export class HitParticles extends Entity {
  constructor({ x = 0, y = 0, duration = 0.35 } = {}) {
    super({
      kind: "effect.hit",
      x,
      y,
      size: "small",
      radius: 0,
      labels: ["effect"],
      tangible: false,
    });
    this.life = duration;
    this.total = duration;
    this.particles = Array.from({ length: 6 }, () => ({
      ox: (Math.random() - 0.5) * 18,
      oy: (Math.random() - 0.5) * 18,
      size: 2 + Math.random() * 2,
    }));
  }

  update(dt) {
    this.life -= dt;
    if (this.life <= 0) {
      this.dead = true;
    }
  }

  render(ctx, cam) {
    const alpha = Math.max(0, this.life / this.total);
    ctx.fillStyle = `rgba(248,113,113,${alpha})`;
    for (const p of this.particles) {
      const px = this.x + p.ox - cam.x;
      const py = this.y + p.oy - cam.y;
      ctx.fillRect(px, py, p.size, p.size);
    }
  }
}
