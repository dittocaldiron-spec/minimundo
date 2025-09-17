// src/controls.js
import emitter from "./utils/events.js";

/**
 * Captura teclado e mouse, mantém um estado de input no `state`,
 * e emite eventos de alto nível que o mundo/UI consomem.
 *
 * Eventos emitidos:
 * - action:toggleInventory   (tecla E)
 * - action:toggleWallet      (tecla C)
 * - action:esc               (tecla ESC)
 * - player:dropHandOne       (tecla Q — dropa 1 do item na mão, se houver)
 * - pointer:move             ({ sx, sy }) - posição no canvas em coordenadas de tela
 * - click:left               ({ sx, sy, alt, shift, ctrl }) - clique esquerdo no canvas
 * - click:right              ({ sx, sy, alt, shift, ctrl }) - clique direito no canvas
 * - input:dir                ({ dx, dy }) - vetor de direção normalizado a cada frame
 */

export function setupControls(state, emitter) {
  const canvas = document.getElementById("game");
  if (!canvas) {
    console.warn("[controls] canvas #game não encontrado");
  }

  // =======================
  // Estado do input
  // =======================
  const keys = {
    w: false,
    a: false,
    s: false,
    d: false,
  };

  // Guardamos também no state para quem preferir ler direto
  state.input = state.input || {
    w: false,
    a: false,
    s: false,
    d: false,
    pointer: { sx: 0, sy: 0 },
  };

  // =======================
  // Utils
  // =======================
  const toLower = (e) => (e.key || "").toLowerCase();

  function computeDir() {
    let dx = 0,
      dy = 0;
    if (keys.w) dy -= 1;
    if (keys.s) dy += 1;
    if (keys.a) dx -= 1;
    if (keys.d) dx += 1;
    const len = Math.hypot(dx, dy) || 1;
    return { dx: dx / len, dy: dy / len };
  }

  function canvasPointFromEvent(e) {
    // coordenadas da posição do mouse relativas ao canvas (escala resolvida)
    const rect = canvas.getBoundingClientRect();
    const sx = ((e.clientX - rect.left) * canvas.width) / rect.width;
    const sy = ((e.clientY - rect.top) * canvas.height) / rect.height;
    return { sx, sy };
  }

  // =======================
  // Teclado
  // =======================
  function onKeyDown(e) {
    const k = toLower(e);
    // evita rolagem em setas/espaço se quiser
    // if ([" "].includes(k)) e.preventDefault();

    if (k === "w") keys.w = state.input.w = true;
    if (k === "a") keys.a = state.input.a = true;
    if (k === "s") keys.s = state.input.s = true;
    if (k === "d") keys.d = state.input.d = true;

    if (k === "e") {
      // toggle inventário e fechar baú (o main.js já liga isso)
      emitter.emit("action:toggleInventory");
    }
    if (k === "c") {
      emitter.emit("action:toggleWallet");
    }
    if (k === "escape") {
      emitter.emit("action:esc");
    }
    if (k === "q") {
      // dropa 1 do item atualmente na mão (se houver)
      emitter.emit("player:dropHandOne");
    }
  }

  function onKeyUp(e) {
    const k = toLower(e);
    if (k === "w") keys.w = state.input.w = false;
    if (k === "a") keys.a = state.input.a = false;
    if (k === "s") keys.s = state.input.s = false;
    if (k === "d") keys.d = state.input.d = false;
  }

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  // =======================
  // Mouse
  // =======================
  function onMouseMove(e) {
    if (!canvas) return;
    const { sx, sy } = canvasPointFromEvent(e);
    state.input.pointer.sx = sx;
    state.input.pointer.sy = sy;
    emitter.emit("pointer:move", { sx, sy });
  }

  function onMouseDown(e) {
    if (!canvas) return;
    const { sx, sy } = canvasPointFromEvent(e);
    const payload = {
      sx,
      sy,
      alt: e.altKey,
      shift: e.shiftKey,
      ctrl: e.ctrlKey,
    };

    if (e.button === 0) {
      // esquerdo = interagir/atacar/coletar
      emitter.emit("click:left", payload);
    } else if (e.button === 2) {
      // direito = colocar/abrir
      emitter.emit("click:right", payload);
    }
  }

  function onContextMenu(e) {
    // desabilita menu de contexto no canvas para usar botão direito
    e.preventDefault();
  }

  if (canvas) {
    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("mousedown", onMouseDown);
    canvas.addEventListener("contextmenu", onContextMenu);
  }

  // =======================
  // Loop de direção contínua
  // =======================
  let running = true;
  let rafId = 0;

  function tick() {
    if (!running) return;
    const dir = computeDir();
    // emite a direção atual a cada frame — o world.js pode usar para mover o player
    emitter.emit("input:dir", dir);
    rafId = requestAnimationFrame(tick);
  }
  rafId = requestAnimationFrame(tick);

  // =======================
  // Cleanup opcional (se um dia precisar descarregar o módulo)
  // =======================
  function dispose() {
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
    if (canvas) {
      canvas.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("mousedown", onMouseDown);
      canvas.removeEventListener("contextmenu", onContextMenu);
    }
  }

  // expõe para debug
  if (typeof window !== "undefined") {
    window.__CONTROLS__ = { dispose, keys };
  }
}
