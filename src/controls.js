// src/controls.js
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

  const keys = {
    w: false,
    a: false,
    s: false,
    d: false,
    shift: false,
  };

  state.input = state.input || {
    w: false,
    a: false,
    s: false,
    d: false,
    shift: false,
    pointer: { sx: 0, sy: 0 },
    dir: { dx: 0, dy: 0 },
  };

  const toLower = (e) => (e.key || "").toLowerCase();

  function computeDir() {
    let dx = 0;
    let dy = 0;
    if (keys.w) dy -= 1;
    if (keys.s) dy += 1;
    if (keys.a) dx -= 1;
    if (keys.d) dx += 1;
    const len = Math.hypot(dx, dy) || 1;
    return { dx: dx / len, dy: dy / len, sprint: keys.shift };
  }

  function canvasPointFromEvent(e) {
    const rect = canvas.getBoundingClientRect();
    const sx = ((e.clientX - rect.left) * canvas.width) / rect.width;
    const sy = ((e.clientY - rect.top) * canvas.height) / rect.height;
    return { sx, sy };
  }

  function onKeyDown(e) {
    const k = toLower(e);
    if (k === "w") keys.w = state.input.w = true;
    if (k === "a") keys.a = state.input.a = true;
    if (k === "s") keys.s = state.input.s = true;
    if (k === "d") keys.d = state.input.d = true;
    if (k === "shift") keys.shift = state.input.shift = true;

    if (k === "e") emitter.emit("action:toggleInventory");
    if (k === "c") emitter.emit("action:toggleWallet");
    if (k === "escape") emitter.emit("action:esc");
    if (k === "q") emitter.emit("player:dropHandOne");
  }

  function onKeyUp(e) {
    const k = toLower(e);
    if (k === "w") keys.w = state.input.w = false;
    if (k === "a") keys.a = state.input.a = false;
    if (k === "s") keys.s = state.input.s = false;
    if (k === "d") keys.d = state.input.d = false;
    if (k === "shift") keys.shift = state.input.shift = false;
  }

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

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

    if (e.button === 0) emitter.emit("click:left", payload);
    else if (e.button === 2) emitter.emit("click:right", payload);
  }

  function onContextMenu(e) {
    e.preventDefault();
  }

  if (canvas) {
    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("mousedown", onMouseDown);
    canvas.addEventListener("contextmenu", onContextMenu);
  }

  let running = true;
  let rafId = 0;

  function tick() {
    if (!running) return;
    const dir = computeDir();
    state.input.dir = dir;
    emitter.emit("input:dir", dir);
    rafId = requestAnimationFrame(tick);
  }
  rafId = requestAnimationFrame(tick);

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

  if (typeof window !== "undefined") {
    window.__CONTROLS__ = { dispose, keys };
  }
}
