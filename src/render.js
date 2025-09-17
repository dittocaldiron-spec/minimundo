// src/render.js
import emitter from "./utils/events.js";
import { getName } from "./items.js";

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

let grassPattern = null;
function ensureGrass(ctx) {
  if (grassPattern) return;
  const p = document.createElement("canvas");
  p.width = p.height = 64;
  const g = p.getContext("2d");

  g.fillStyle = "#123b22";
  g.fillRect(0, 0, 64, 64);

  for (let i = 0; i < 60; i++) {
    g.fillStyle = `rgba(34,197,94,${0.06 + Math.random() * 0.08})`;
    const x = Math.random() * 64;
    const y = Math.random() * 64;
    const r = 1 + Math.random() * 2;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }

  grassPattern = ctx.createPattern(p, "repeat");
}

function drawBG(ctx, cam, w, h, tile) {
  ctx.save();
  ctx.translate(-cam.x, -cam.y);
  ensureGrass(ctx);
  ctx.fillStyle = grassPattern;
  ctx.fillRect(cam.x, cam.y, w, h);

  ctx.strokeStyle = "rgba(148,163,184,.25)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  const x0 = Math.floor(cam.x / tile) * tile;
  const y0 = Math.floor(cam.y / tile) * tile;
  for (let x = x0; x <= cam.x + w; x += tile) {
    ctx.moveTo(x, cam.y);
    ctx.lineTo(x, cam.y + h);
  }
  for (let y = y0; y <= cam.y + h; y += tile) {
    ctx.moveTo(cam.x, y);
    ctx.lineTo(cam.x + w, y);
  }
  ctx.stroke();
  ctx.restore();
}

function drawPlayer(ctx, player, cam) {
  const x = player.x - cam.x;
  const y = player.y - cam.y;
  ctx.fillStyle = "rgba(0,0,0,.35)";
  ctx.beginPath();
  ctx.ellipse(x, y + player.h / 2, 14, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = player.color || "#f0abfc";
  ctx.fillRect(x - player.w / 2, y - player.h / 2, player.w, player.h);
}

function drawTree(ctx, ent, cam) {
  const x = ent.x - cam.x;
  const y = ent.y - cam.y;
  ctx.fillStyle = "#1e293b";
  ctx.fillRect(x - 6, y, 12, ent.r);
  ctx.fillStyle = "#10b981";
  ctx.beginPath();
  ctx.arc(x, y, ent.r + 10, 0, Math.PI * 2);
  ctx.fill();
}

function drawRock(ctx, ent, cam) {
  const x = ent.x - cam.x;
  const y = ent.y - cam.y;
  ctx.fillStyle = "#94a3b8";
  ctx.beginPath();
  ctx.arc(x, y, ent.r, 0, Math.PI * 2);
  ctx.fill();
}

function drawCoin(ctx, ent, cam) {
  const t = performance.now() / 400;
  const bob = Math.sin(t + (ent.x + ent.y) * 0.001) * 2;
  ctx.fillStyle = "#fbbf24";
  ctx.beginPath();
  ctx.arc(ent.x - cam.x, ent.y - cam.y + bob, ent.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#a16207";
  ctx.stroke();
}

function drawItem(ctx, ent, cam) {
  const x = ent.x - cam.x;
  const y = ent.y - cam.y;
  ctx.fillStyle = "#fde68a";
  ctx.beginPath();
  ctx.arc(x, y, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(30,64,175,.6)";
  ctx.stroke();
}

function drawChest(ctx, ent, cam) {
  const x = ent.x - cam.x;
  const y = ent.y - cam.y;
  ctx.fillStyle = "#b45309";
  ctx.fillRect(x - 16, y - 12, 32, 24);
  ctx.strokeStyle = "#78350f";
  ctx.strokeRect(x - 16, y - 12, 32, 24);
}

function drawCampfire(ctx, ent, cam) {
  const x = ent.x - cam.x;
  const y = ent.y - cam.y;
  ctx.fillStyle = "#7c2d12";
  ctx.fillRect(x - 14, y - 6, 28, 12);
  ctx.fillStyle = "#ea580c";
  const t = performance.now() / 300;
  const h = 8 + Math.sin(t + (x + y) * 0.01) * 2;
  ctx.beginPath();
  ctx.moveTo(x, y - h - 4);
  ctx.lineTo(x - 6, y + 2);
  ctx.lineTo(x + 6, y + 2);
  ctx.closePath();
  ctx.fill();
}

function drawCow(ctx, ent, cam) {
  const t = performance.now() / 500;
  const bob = Math.sin(t + (ent.x + ent.y) * 0.002) * 1.5;
  const x = ent.x - cam.x;
  const y = ent.y - cam.y + bob;
  ctx.fillStyle = "#9ca3af";
  ctx.fillRect(x - 12, y - 10, 24, 16);
  ctx.fillStyle = "#6b7280";
  ctx.fillRect(x - 14, y - 8, 8, 6);
  ctx.fillRect(x + 6, y - 8, 8, 6);
}

function drawFocus(ctx, ent, cam) {
  if (!ent) return;
  const x = ent.x - cam.x;
  const y = ent.y - cam.y;
  ctx.save();
  ctx.strokeStyle = "rgba(14,165,233,0.85)";
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.arc(x, y, (ent.r || 16) + 6, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function entityLabel(ent) {
  if (!ent) return "";
  switch (ent.type) {
    case "item":
      return getName(ent.itemId);
    case "placed":
      return getName(ent.placedId);
    case "coin":
      return "Moeda";
    case "tree":
      return "Árvore";
    case "rock":
      return "Rocha";
    case "cow":
      return "Vaca";
    case "campfire":
      return "Fogueira";
    case "chest":
      return "Baú";
    default:
      return ent.type;
  }
}

function drawFocusLabel(ctx, ent, canvas) {
  if (!ent) return;
  const name = entityLabel(ent);
  ctx.save();
  ctx.fillStyle = "rgba(15,23,42,0.75)";
  ctx.fillRect(canvas.width / 2 - 140, canvas.height - 48, 280, 32);
  ctx.strokeStyle = "rgba(148,163,184,0.4)";
  ctx.strokeRect(canvas.width / 2 - 140, canvas.height - 48, 280, 32);
  ctx.fillStyle = "#e2e8f0";
  ctx.font = "13px system-ui,sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(name, canvas.width / 2, canvas.height - 32);
  ctx.restore();
}

let pulseT = 0;
let pulseMsg = "";
emitter.on("ping", (message) => {
  pulseMsg = message;
  pulseT = 1.5;
});

export function renderLoop(state, emitter, onTick) {
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const cam = { x: 0, y: 0 };
  let last = performance.now();

  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;

    if (typeof onTick === "function") {
      onTick(dt);
    }

    const { world, player, entities } = state;

    cam.x = clamp(player.x - canvas.width / 2, 0, world.w - canvas.width);
    cam.y = clamp(player.y - canvas.height / 2, 0, world.h - canvas.height);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawBG(ctx, cam, canvas.width, canvas.height, world.tile);

    let focusEntity = null;

    for (const ent of entities) {
      if (ent.dead) continue;
      if (player.focusId && ent.id === player.focusId) focusEntity = ent;
      switch (ent.type) {
        case "tree":
          drawTree(ctx, ent, cam);
          break;
        case "rock":
          drawRock(ctx, ent, cam);
          break;
        case "coin":
          drawCoin(ctx, ent, cam);
          break;
        case "item":
          drawItem(ctx, ent, cam);
          break;
        case "chest":
          drawChest(ctx, ent, cam);
          break;
        case "campfire":
          drawCampfire(ctx, ent, cam);
          break;
        case "cow":
          drawCow(ctx, ent, cam);
          break;
        case "placed":
          drawItem(ctx, ent, cam);
          break;
      }
    }

    drawPlayer(ctx, player, cam);
    drawFocus(ctx, focusEntity, cam);
    drawFocusLabel(ctx, focusEntity, canvas);

    if (pulseT > 0) {
      const alpha = Math.min(1, pulseT / 0.25);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = "rgba(10,15,25,.8)";
      ctx.fillRect(canvas.width / 2 - 180, 20, 360, 34);
      ctx.strokeStyle = "rgba(125,211,252,.5)";
      ctx.strokeRect(canvas.width / 2 - 180, 20, 360, 34);
      ctx.fillStyle = "#e2f4ff";
      ctx.font = "14px system-ui,sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(pulseMsg, canvas.width / 2, 37);
      ctx.restore();
      pulseT = Math.max(0, pulseT - dt);
    }

    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}
