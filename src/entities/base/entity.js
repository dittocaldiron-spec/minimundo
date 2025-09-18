const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

let NEXT_UID = 1;

export class Entity {
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
    } = options;

    if (!kind) throw new Error("Entity kind é obrigatório");

    this.kind = kind;
    this.id = `${kind}#${NEXT_UID++}`;
    this.labels = new Set(["entity", ...labels]);
    this.pos = { x, y };
    this.size = size;
    this.radius = radius;
    this.hp = hp;
    this.maxHp = hp ?? null;
    this.dead = false;
    this.tangible = tangible ?? (size === "small");
    this.metadata = options.metadata || {};
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

export function resetEntityIds() {
  NEXT_UID = 1;
}
