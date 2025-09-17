// src/render.js
import emitter from "./utils/events.js";

// Utilidades
function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

// Grama cacheada
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
    const x = Math.random() * 64,
      y = Math.random() * 64,
      r = 1 + Math.random() * 2;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }

  grassPattern = ctx.createPattern(p, "repeat");
}

// Funções de desenho
function drawBG(ctx, cam, w, h, tile) {
  ctx.save();
  ctx.translate(-cam.x, -cam.y);
  ensureGrass(ctx);
  ctx.fillStyle = grassPattern;
  ctx.fillRect(cam.x, cam.y, w, h);

  ctx.strokeStyle = "rgba(148,163,184,.25)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  const x0 = Math.floor(cam.x / tile) * tile,
    y0 = Math.floor(cam.y / tile) * tile;
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

function drawPlayer(ctx, p, cam) {
  const x = p.x - cam.x,
    y = p.y - cam.y;
  ctx.fillStyle = "rgba(0,0,0,.35)";
  ctx.beginPath();
  ctx.ellipse(x, y + p.h / 2, 14, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = p.color || "#f0abfc";
  ctx.fillRect(x - p.w / 2, y - p.h / 2, p.w, p.h);
}

function drawTree(ctx, e, cam) {
  const x = e.x - cam.x,
    y = e.y - cam.y;
  ctx.fillStyle = "#1e293b";
  ctx.fillRect(x - 6, y, 12, e.r);
  ctx.fillStyle = "#10b981";
  ctx.beginPath();
  ctx.arc(x, y, e.r + 10, 0, Math.PI * 2);
  ctx.fill();
}

function drawRock(ctx, e, cam) {
  const x = e.x - cam.x,
    y = e.y - cam.y;
  ctx.fillStyle = "#94a3b8";
  ctx.beginPath();
  ctx.arc(x, y, e.r, 0, Math.PI * 2);
  ctx.fill();
}

function drawCoin(ctx, e, cam) {
  const t = performance.now() / 400,
    b = Math.sin(t + (e.x + e.y) * 0.001) * 2;
  ctx.fillStyle = "#fbbf24";
  ctx.beginPath();
  ctx.arc(e.x - cam.x, e.y - cam.y + b, e.r, 0, Math.PI * 2);
  ctx.fill();
}

function drawChest(ctx, e, cam) {
  const x = e.x - cam.x,
    y = e.y - cam.y;
  ctx.fillStyle = "#b45309";
  ctx.fillRect(x - 16, y - 12, 32, 24);
  ctx.strokeStyle = "#78350f";
  ctx.strokeRect(x - 16, y - 12, 32, 24);
}

function drawCampfire(ctx, e, cam) {
  const x = e.x - cam.x,
    y = e.y - cam.y;
  ctx.fillStyle = "#7c2d12";
  ctx.fillRect(x - 14, y - 6, 28, 12);
  ctx.fillStyle = "#ea580c";
  const t = performance.now() / 300,
    h = 8 + Math.sin(t + (x + y) * 0.01) * 2;
  ctx.beginPath();
  ctx.moveTo(x, y - h - 4);
  ctx.lineTo(x - 6, y + 2);
  ctx.lineTo(x + 6, y + 2);
  ctx.closePath();
  ctx.fill();
}

function drawCow(ctx, e, cam) {
  const t = performance.now() / 500,
    b = Math.sin(t + (e.x + e.y) * 0.002) * 1.5;
  const x = e.x - cam.x,
    y = e.y - cam.y + b;
  ctx.fillStyle = "#9ca3af";
  ctx.fillRect(x - 12, y - 10, 24, 16);
  ctx.fillStyle = "#6b7280";
  ctx.fillRect(x - 14, y - 8, 8, 6);
  ctx.fillRect(x + 6, y - 8, 8, 6);
}

// Mensagem de feedback
let pulseT = 0,
  pulseMsg = "";
emitter.on("ping", (m) => {
  pulseMsg = m;
  pulseT = 1.5;
});

// Loop principal
export function renderLoop(state, emitter) {
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");

  const cam = { x: 0, y: 0 };

  function draw() {
    const { world, player, entities } = state;

    // Update câmera
    cam.x = clamp(player.x - canvas.width / 2, 0, world.w - canvas.width);
    cam.y = clamp(player.y - canvas.height / 2, 0, world.h - canvas.height);

    // Fundo
    drawBG(ctx, cam, canvas.width, canvas.height, world.tile);

    // Entidades
    for (const e of entities) {
      if (e.dead) continue;
      switch (e.type) {
        case "tree":
          drawTree(ctx, e, cam);
          break;
        case "rock":
          drawRock(ctx, e, cam);
          break;
        case "coin":
          drawCoin(ctx, e, cam);
          break;
        case "chest":
          drawChest(ctx, e, cam);
          break;
        case "campfire":
          drawCampfire(ctx, e, cam);
          break;
        case "cow":
          drawCow(ctx, e, cam);
          break;
      }
    }

    // Player
    drawPlayer(ctx, player, cam);

    // Mensagens
    if (pulseT > 0) {
      const a = Math.min(1, pulseT / 0.25);
      ctx.globalAlpha = a;
      ctx.fillStyle = "rgba(10,15,25,.8)";
      ctx.fillRect(canvas.width / 2 - 180, 20, 360, 34);
      ctx.strokeStyle = "rgba(125,211,252,.5)";
      ctx.strokeRect(canvas.width / 2 - 180, 20, 360, 34);
      ctx.fillStyle = "#e2f4ff";
      ctx.font = "14px system-ui,sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(pulseMsg, canvas.width / 2, 37);
      ctx.globalAlpha = 1;
      pulseT -= 1 / 60;
    }

    requestAnimationFrame(draw);
  }

  draw();
}

