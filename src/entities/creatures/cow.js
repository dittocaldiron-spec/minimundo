import { Creature } from "../base/creature.js";

const FLEE_DURATION = 6; // seconds
const WANDER_INTERVAL = [2, 5];
const WANDER_SPEED = 28;
const FLEE_SPEED = 120;

function randomInRange([min, max]) {
  return min + Math.random() * (max - min);
}

export class Cow extends Creature {
  constructor({ x = 0, y = 0 } = {}) {
    super({
      kind: "creature.cow",
      x,
      y,
      size: "large",
      radius: 16,
      hp: 20,
      labels: ["cow"],
      speed: 32,
    });
    this.wanderTimer = 0;
    this.wanderDir = { x: 0, y: 0 };
    this.fleeTimer = 0;
    this.fleeSource = { x, y };
  }

  triggerFlee(from) {
    this.fleeTimer = FLEE_DURATION;
    if (from) {
      this.fleeSource = { x: from.x ?? this.x, y: from.y ?? this.y };
    }
  }

  onHit(amount, source, context = {}) {
    const dir = {
      x: (source?.x ?? context.player?.x ?? this.x) - this.x,
      y: (source?.y ?? context.player?.y ?? this.y) - this.y,
    };
    this.applyKnockback(dir.x, dir.y, 260, 0.4);
    this.triggerFlee(source || context.player);
    context.spawnEffect?.("hit", { x: this.x, y: this.y });
    context.chainFear?.(this, source || context.player);
  }

  onDeath(source, context = {}) {
    context.spawnDrop?.("beef", { x: this.x, y: this.y, qty: 4 });
    context.spawnDrop?.("leather", { x: this.x, y: this.y, qty: 2 });
    context.spawnDrop?.("bone", { x: this.x, y: this.y, qty: 3 });
    context.emitter?.emit("ping", "Vaca abatida");
  }

  update(dt, context = {}) {
    this.updateKnockback(dt, (x, y) => context.clampPosition?.(x, y));

    if (this.knockback) {
      return;
    }

    if (this.fleeTimer > 0) {
      this.fleeTimer = Math.max(0, this.fleeTimer - dt);
      const src = this.fleeSource || { x: this.x, y: this.y };
      const ax = this.x - src.x;
      const ay = this.y - src.y;
      const L = Math.hypot(ax, ay) || 1;
      const speed = FLEE_SPEED * dt;
      const nextX = this.x + (ax / L) * speed;
      const nextY = this.y + (ay / L) * speed;
      const clamped = context.clampPosition?.(nextX, nextY) || { x: nextX, y: nextY };
      this.x = clamped.x;
      this.y = clamped.y;
      return;
    }

    this.wanderTimer -= dt;
    if (this.wanderTimer <= 0) {
      this.wanderTimer = randomInRange(WANDER_INTERVAL);
      const angle = Math.random() * Math.PI * 2;
      this.wanderDir = { x: Math.cos(angle), y: Math.sin(angle) };
    }
    const speed = WANDER_SPEED * dt;
    const nextX = this.x + this.wanderDir.x * speed;
    const nextY = this.y + this.wanderDir.y * speed;
    const clamped = context.clampPosition?.(nextX, nextY) || { x: nextX, y: nextY };
    this.x = clamped.x;
    this.y = clamped.y;
  }

  render(ctx, cam) {
    const t = (typeof performance !== "undefined" ? performance.now() : Date.now()) / 500;
    const bob = Math.sin(t + (this.x + this.y) * 0.002) * 1.5;
    const x = this.x - cam.x;
    const y = this.y - cam.y + bob;
    ctx.fillStyle = "#9ca3af";
    ctx.fillRect(x - 12, y - 10, 24, 16);
    ctx.fillStyle = "#6b7280";
    ctx.fillRect(x - 14, y - 8, 8, 6);
    ctx.fillRect(x + 6, y - 8, 8, 6);
  }
}
