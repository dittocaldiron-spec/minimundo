import { Entity } from "./entity.js";

export class Creature extends Entity {
  constructor(options = {}) {
    const labels = new Set(["creature", ...(options.labels || [])]);
    super({ ...options, labels: [...labels] });
    this.speed = options.speed ?? 0;
    this.aiState = options.aiState || {};
    this.velocity = { x: 0, y: 0 };
    this.knockback = null;
  }

  takeDamage(amount, source, context) {
    if (this.hp == null) return;
    this.hp = Math.max(0, (this.hp || 0) - amount);
    this.onHit(amount, source, context);
    if (this.hp <= 0) {
      this.dead = true;
      this.onDeath(source, context);
    }
  }

  onHit(/* amount, source, context */) {}

  onDeath(/* source, context */) {}

  applyKnockback(dx, dy, strength = 1, duration = 0.2) {
    const len = Math.hypot(dx, dy) || 1;
    const vx = (-dx / len) * strength;
    const vy = (-dy / len) * strength;
    this.knockback = {
      vx,
      vy,
      timer: duration,
    };
  }

  updateKnockback(dt, clampFn) {
    if (!this.knockback) return;
    this.knockback.timer -= dt;
    if (this.knockback.timer <= 0) {
      this.knockback = null;
      return;
    }
    this.x += this.knockback.vx * dt;
    this.y += this.knockback.vy * dt;
    if (typeof clampFn === "function") {
      const { x, y } = clampFn(this.x, this.y);
      this.x = x;
      this.y = y;
    }
  }
}
