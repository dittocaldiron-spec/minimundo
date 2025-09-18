// src/entities/index.js
import { hasTag, getName } from "../items.js";
import { makeInventory } from "../state.js";

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const getTime = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

let NEXT_UID = 1;

export class BaseEntity {
  constructor(options = {}) {
    const {
      kind,
      x = 0,
      y = 0,
      size = "medium",
      radius = 16,
      hp = null,
      tangible,
      labels = [],
      category = null,
      metadata = {},
    } = options;

    if (!kind) throw new Error("Entity kind é obrigatório");

    this.kind = kind;
    this.id = `${kind}#${NEXT_UID++}`;
    const baseLabels = ["entity"];
    if (category) baseLabels.push(category);
    this.labels = new Set([...baseLabels, ...labels]);
    this.pos = { x, y };
    this.size = size;
    this.radius = radius;
    this.hp = hp;
    this.maxHp = hp ?? null;
    this.dead = false;
    this.tangible = tangible ?? size === "small";
    this.metadata = metadata;
  }

  get x() {
    return this.pos.x;
  }

  set x(value) {
    this.pos.x = value;
  }

  get y() {
    return this.pos.y;
  }

  set y(value) {
    this.pos.y = value;
  }

  hasLabel(label) {
    return this.labels.has(label);
  }

  distanceTo(target) {
    const tx = target?.x ?? target?.pos?.x ?? 0;
    const ty = target?.y ?? target?.pos?.y ?? 0;
    return Math.hypot(this.x - tx, this.y - ty);
  }

  place(/* world, bus */) {}

  break(/* world, bus */) {
    this.dead = true;
  }

  heal(amount) {
    if (typeof amount !== "number" || !this.maxHp) return;
    this.hp = clamp((this.hp || 0) + amount, 0, this.maxHp);
  }

  damage(amount) {
    if (typeof amount !== "number") return;
    if (this.hp == null) return;
    this.hp = Math.max(0, this.hp - amount);
    if (this.hp === 0) this.break();
  }

  update(/* dt, world, bus */) {}

  render(/* ctx, cam */) {}
}

export class ActorEntity extends BaseEntity {
  constructor(options = {}) {
    const labels = new Set(["creature", ...(options.labels || [])]);
    super({ ...options, labels: [...labels], category: options.category ?? "fauna" });
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

export class StructureEntity extends BaseEntity {
  constructor(options = {}) {
    const labels = new Set(["structure", ...(options.labels || [])]);
    super({ ...options, labels: [...labels], category: options.category ?? "structure" });
    this.breakable = options.breakable ?? true;
    this.placeable = options.placeable ?? true;
    this.interactionCooldown = 0;
  }

  interact(/* world, player, emitter */) {}

  canInteract(now = getTime()) {
    return now >= this.interactionCooldown;
  }

  setInteractionCooldown(ms) {
    this.interactionCooldown = getTime() + ms;
  }

  break(world, bus) {
    if (!this.breakable) return false;
    super.break(world, bus);
    return true;
  }
}

export function resetEntityIds() {
  NEXT_UID = 1;
}

/* ------------ Specific entities ------------ */

const FLEE_DURATION = 6; // seconds
const WANDER_INTERVAL = [2, 5];
const WANDER_SPEED = 28;
const FLEE_SPEED = 120;

const randomInRange = ([min, max]) => min + Math.random() * (max - min);

export class Cow extends ActorEntity {
  constructor({ x = 0, y = 0 } = {}) {
    super({
      kind: "creature.cow",
      x,
      y,
      size: "large",
      radius: 16,
      hp: 20,
      speed: 32,
      labels: ["fauna", "passive"],
      category: "fauna",
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
    const t = getTime() / 500;
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

export class Tree extends StructureEntity {
  constructor({ x = 0, y = 0, hp = 5 } = {}) {
    super({
      kind: "prop.tree",
      x,
      y,
      size: "large",
      radius: 22,
      hp,
      labels: ["flora", "resource"],
      tangible: true,
      category: "flora",
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

export class Rock extends StructureEntity {
  constructor({ x = 0, y = 0, hp = 20 } = {}) {
    super({
      kind: "prop.rock",
      x,
      y,
      size: "large",
      radius: 20,
      hp,
      labels: ["mineral", "resource"],
      tangible: true,
      category: "mineral",
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

const COOK_TIME_MS = 30000;
const COOK_MAP = {
  beef: "cookedbeef",
};

export class Campfire extends StructureEntity {
  constructor({ x = 0, y = 0 } = {}) {
    super({
      kind: "prop.campfire",
      x,
      y,
      size: "medium",
      radius: 16,
      hp: 14,
      labels: ["utility", "craft"],
      tangible: true,
      category: "utility",
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
      doneAt: getTime() + COOK_TIME_MS,
    };
    context.emitter?.emit("ping", "Carne cozinhando (30s)");
    return true;
  }

  update(dt, context = {}) {
    if (!this.cooking) return;
    if (getTime() >= this.cooking.doneAt) {
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

    const flicker = Math.sin((getTime() + this.x + this.y) * 0.01);
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

const BERRY_COOLDOWN_MS = 20 * 60 * 1000;

export class BerryBush extends StructureEntity {
  constructor({ x = 0, y = 0 } = {}) {
    super({
      kind: "prop.berry-bush",
      x,
      y,
      size: "medium",
      radius: 18,
      hp: 10,
      labels: ["flora", "food-source"],
      category: "flora",
    });
    this.nextHarvestAt = 0;
  }

  interact(context = {}) {
    const time = getTime();
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
    this.nextHarvestAt = time + BERRY_COOLDOWN_MS;
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

const NUT_SHAKE_COOLDOWN_MS = 4500;

export class NutTree extends StructureEntity {
  constructor({ x = 0, y = 0, hp = 8 } = {}) {
    super({
      kind: "prop.nut-tree",
      x,
      y,
      size: "large",
      radius: 22,
      hp,
      labels: ["flora", "food-source"],
      tangible: true,
      category: "flora",
    });
    this.taps = 0;
    this.nextShakeAt = 0;
  }

  interact(context = {}) {
    const { toolId, spawnDrop, emitter } = context;
    const time = getTime();
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
    if (this.taps >= 10) {
      spawnDrop?.("nuts", { x: this.x, y: this.y });
      emitter?.emit("ping", "Uma noz caiu da árvore!");
      this.taps = 0;
      this.nextShakeAt = time + NUT_SHAKE_COOLDOWN_MS;
    } else {
      const remaining = 10 - this.taps;
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

export class Chest extends StructureEntity {
  constructor({ x = 0, y = 0, inventory } = {}) {
    super({
      kind: "prop.chest",
      x,
      y,
      size: "medium",
      radius: 18,
      hp: 12,
      labels: ["storage", "container"],
      tangible: true,
      category: "storage",
    });
    this.inventory = inventory || makeInventory(18);
  }

  break(context = {}) {
    if (!super.break(context)) return false;
    const { spawnDrop } = context;
    if (spawnDrop) {
      spawnDrop("chest", { x: this.x, y: this.y, meta: { inv: this.inventory } });
    }
    return true;
  }

  render(ctx, cam) {
    const x = this.x - cam.x;
    const y = this.y - cam.y;
    ctx.fillStyle = "#b45309";
    ctx.fillRect(x - 16, y - 12, 32, 24);
    ctx.strokeStyle = "#78350f";
    ctx.strokeRect(x - 16, y - 12, 32, 24);
    ctx.fillStyle = "#fcd34d";
    ctx.fillRect(x - 2, y - 2, 4, 4);
  }
}

export class DisplayProp extends StructureEntity {
  constructor({ x = 0, y = 0, itemId }) {
    super({
      kind: `prop.display.${itemId}`,
      x,
      y,
      size: "small",
      radius: 14,
      labels: ["decor"],
      tangible: false,
      hp: 4,
      category: "decor",
    });
    this.itemId = itemId;
  }

  render(ctx, cam) {
    const x = this.x - cam.x;
    const y = this.y - cam.y;
    ctx.fillStyle = "rgba(148,163,184,0.35)";
    ctx.beginPath();
    ctx.arc(x, y, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f8fafc";
    ctx.font = "10px system-ui";
    ctx.textAlign = "center";
    ctx.fillText(getName(this.itemId).slice(0, 3), x, y + 3);
  }
}

export class ItemDrop extends BaseEntity {
  constructor(options) {
    const { itemId, qty = 1, meta = null, ttl = 300000, x = 0, y = 0 } = options || {};
    super({
      kind: "item.drop",
      x,
      y,
      size: "small",
      radius: 12,
      labels: ["pickup", "item"],
      tangible: false,
      category: "pickup",
    });
    this.itemId = itemId;
    this.qty = Math.max(1, qty);
    this.meta = meta;
    this.expiresAt = ttl ? getTime() + ttl : null;
  }

  update() {
    if (this.expiresAt && getTime() >= this.expiresAt) {
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

export class Coin extends BaseEntity {
  constructor({ x = 0, y = 0 } = {}) {
    super({
      kind: "item.coin",
      x,
      y,
      size: "small",
      radius: 10,
      labels: ["pickup", "currency"],
      tangible: false,
      category: "pickup",
    });
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

export class HitParticles extends BaseEntity {
  constructor({ x = 0, y = 0, duration = 0.35 } = {}) {
    super({
      kind: "effect.hit",
      x,
      y,
      size: "small",
      radius: 0,
      labels: ["effect", "visual"],
      tangible: false,
      category: "effect",
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
