import { Prop } from "../base/prop.js";
import { makeInventory } from "../../state.js";

export class Chest extends Prop {
  constructor({ x = 0, y = 0, inventory } = {}) {
    super({
      kind: "prop.chest",
      x,
      y,
      size: "medium",
      radius: 18,
      hp: 12,
      labels: ["chest"],
      tangible: true,
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
