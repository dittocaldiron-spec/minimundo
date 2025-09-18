// src/render.js
import emitter from "./utils/events.js";
import { getName } from "./items.js";
import { isBlurActive } from "./systems/hunger.js";

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

function drawFocus(ctx, ent, cam) {
  if (!ent) return;
  const x = ent.x - cam.x;
  const y = ent.y - cam.y;
  const radius = ent.radius ?? ent.r ?? 16;
  ctx.save();
  ctx.strokeStyle = "rgba(14,165,233,0.85)";
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.arc(x, y, radius + 6, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function entityLabel(ent) {
  if (!ent) return "";
  const kind = ent.kind || "";
  const labels = ent.labels || new Set();
  if (labels.has("effect") || kind.startsWith("effect.")) return "";

  if (kind === "item.coin" || labels.has("coin")) {
    return "Moeda";
  }
  if (kind === "item.drop" || labels.has("drop")) {
    const base = getName(ent.itemId);
    return ent.qty > 1 ? `${base} x${ent.qty}` : base;
  }
  if (kind === "prop.tree" || labels.has("tree")) return "Árvore";
  if (kind === "prop.nut-tree" || labels.has("nut-tree")) return "Nogueira";
  if (kind === "prop.berry-bush" || labels.has("berry-bush")) return "Moita de Berries";
  if (kind === "prop.rock" || labels.has("rock")) return "Rocha";
  if (kind === "prop.chest" || labels.has("chest")) return "Baú";
  if (kind === "prop.campfire" || labels.has("campfire")) {
    const cooking = typeof ent.isCooking === "function" && ent.isCooking();
    return cooking ? "Fogueira (cozinhando)" : "Fogueira";
  }
  if (kind.startsWith("prop.display")) return getName(ent.itemId);
  if (kind === "creature.cow" || labels.has("cow")) return "Vaca";
  return kind;
}

function drawFocusLabel(ctx, ent, canvas) {
  const name = entityLabel(ent);
  if (!name) return;
  ctx.save();
  const width = 280;
  const height = 32;
  const x = canvas.width / 2 - width / 2;
  const y = canvas.height - height - 16;
  ctx.fillStyle = "rgba(15,23,42,0.75)";
  ctx.fillRect(x, y, width, height);
  ctx.strokeStyle = "rgba(148,163,184,0.4)";
  ctx.strokeRect(x, y, width, height);
  ctx.fillStyle = "#e2e8f0";
  ctx.font = "13px system-ui,sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(name, canvas.width / 2, y + height / 2);
  ctx.restore();
}

function renderEntities(ctx, entities, cam, focusId) {
  let focusEntity = null;
  for (const ent of entities || []) {
    if (!ent || ent.dead) continue;
    if (focusId && ent.id === focusId) {
      focusEntity = ent;
    }
    if (typeof ent.render === "function") {
      ent.render(ctx, cam);
    }
  }
  return focusEntity;
}

let pulseT = 0;
let pulseMsg = "";

emitter.on("ping", (message) => {
  pulseMsg = message;
  pulseT = 1.5;
});

export function renderLoop(state, emitter, onTick) {
  const canvas = document.getElementById("game");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const cam = { x: 0, y: 0 };
  let last = performance.now();
  let lastBlur = null;

  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;

    if (typeof onTick === "function") {
      onTick(dt);
    }

    const { world, player } = state;
    const entities = state.entities || [];
    const width = canvas.width;
    const height = canvas.height;
    const maxX = Math.max(0, (world?.w || width) - width);
    const maxY = Math.max(0, (world?.h || height) - height);

    cam.x = clamp((player?.x || 0) - width / 2, 0, maxX);
    cam.y = clamp((player?.y || 0) - height / 2, 0, maxY);

    ctx.clearRect(0, 0, width, height);
    drawBG(ctx, cam, width, height, world?.tile || 32);

    const focusEntity = renderEntities(ctx, entities, cam, player?.focusId);

    if (player) {
      drawPlayer(ctx, player, cam);
    }
    drawFocus(ctx, focusEntity, cam);
    drawFocusLabel(ctx, focusEntity, canvas);

    if (pulseT > 0) {
      const alpha = Math.min(1, pulseT / 0.25);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = "rgba(10,15,25,.8)";
      ctx.fillRect(width / 2 - 180, 20, 360, 34);
      ctx.strokeStyle = "rgba(125,211,252,.5)";
      ctx.strokeRect(width / 2 - 180, 20, 360, 34);
      ctx.fillStyle = "#e2f4ff";
      ctx.font = "14px system-ui,sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(pulseMsg, width / 2, 37);
      ctx.restore();
      pulseT = Math.max(0, pulseT - dt);
    }

    const blurActive = isBlurActive();
    if (blurActive !== lastBlur) {
      canvas.classList.toggle("is-blur", blurActive);
      lastBlur = blurActive;
    }

    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}
