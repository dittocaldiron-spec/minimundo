import { Entity } from "./entity.js";

const getNow = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

export class Prop extends Entity {
  constructor(options = {}) {
    const labels = new Set(["prop", ...(options.labels || [])]);
    super({ ...options, labels: [...labels] });
    this.breakable = options.breakable ?? true;
    this.placeable = options.placeable ?? true;
    this.interactionCooldown = 0;
  }

  interact(/* world, player, emitter */) {}

  canInteract(now = getNow()) {
    return now >= this.interactionCooldown;
  }

  setInteractionCooldown(ms) {
    this.interactionCooldown = getNow() + ms;
  }

  break(world, bus) {
    if (!this.breakable) return false;
    super.break(world, bus);
    return true;
  }
}
