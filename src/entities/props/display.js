import { Prop } from "../base/prop.js";
import { getName } from "../../items.js";

export class DisplayProp extends Prop {
  constructor({ x = 0, y = 0, itemId }) {
    super({
      kind: `prop.display.${itemId}`,
      x,
      y,
      size: "small",
      radius: 14,
      labels: ["display"],
      tangible: false,
      hp: 4,
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
