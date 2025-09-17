// src/main.js
import { initState } from "./state.js";
import { setupUI } from "./ui.js";
import { renderLoop } from "./render.js";
import { setupControls } from "./controls.js";
import {
  spawnInitialWorld,
  updateWorld,
  returnCraftingToInventory, // precisa existir no world.js
} from "./world.js";
import emitter from "./utils/events.js";

/**
 * Util: checagem do canvas para evitar "getContext of null"
 */
function waitCanvasReady(id = "game") {
  return new Promise((resolve, reject) => {
    const tryGet = () => {
      const c = document.getElementById(id);
      if (c && c.getContext) return resolve(c);
      // aguarda próximo frame (útil em ambientes online)
      requestAnimationFrame(tryGet);
    };
    tryGet();
    setTimeout(() => reject(new Error(`#${id} não encontrado`)), 8000);
  });
}

/**
 * Conecta os sinais entre módulos (UI, controles, mundo).
 * Mantém a “orquestração” centralizada aqui (main.js).
 */
function wireEvents(state) {
  // --- Tecla E: toggle inventário; também fecha baú se aberto
  emitter.on("action:toggleInventory", () => {
    emitter.emit("ui:inventory:toggle");
    // se um baú estiver aberto, fecha
    emitter.emit("chest:close");
  });

  // --- Tecla C: toggle carteira
  emitter.on("action:toggleWallet", () => {
    emitter.emit("ui:wallet:toggle");
  });

  // --- ESC sempre fecha baú e janelas modais
  emitter.on("action:esc", () => {
    emitter.emit("chest:close");
    emitter.emit("ui:inventory:close");
    emitter.emit("ui:wallet:close");
  });

  // --- Quando o inventário FECHAR, devolve tudo da grade de crafting
  emitter.on("ui:inventory:closed", () => {
    // mover todos os itens depositados na crafting UI de volta pro inventário
    // a função returnCraftingToInventory deve cuidar das regras de empilhamento e UI refresh
    returnCraftingToInventory(state, emitter);
  });

  // --- Previne baú dentro de baú: se UI tentar mover para container e for chest, bloqueia
  emitter.on("container:beforePut", (payload) => {
    // payload: { itemId, source, target }
    if (payload?.itemId === "chest") {
      emitter.emit("toast", "Não é possível guardar um baú dentro de outro baú.");
      payload.cancel = true;
    }
  });

  // --- Garantir que 'E' também FECHA o baú (além do toggle do inventário)
  emitter.on("ui:inventory:opened", () => {
    emitter.emit("chest:close");
  });

  // --- Logs úteis pra debug (ligue/desligue conforme preciso)
  // emitter.on("log", (m) => console.debug("[LOG]", m));
  // emitter.on("toast", (m) => console.info("[TOAST]", m));
}

/**
 * Loop principal do jogo — delega o update ao world.js e o desenho ao render.js.
 * renderLoop(state, emitter, onTick) deve chamar onTick(dt) a cada frame.
 */
function startLoops(state) {
  renderLoop(state, emitter, (dt) => {
    updateWorld(state, dt, emitter);
  });
}

/**
 * Inicialização geral
 */
async function boot() {
  // 1) Espera o canvas existir (evita erros de getContext)
  await waitCanvasReady("game");

  // 2) Cria estado base
  const state = initState();

  // (opcional) expõe para debug
  if (typeof window !== "undefined") window.__STATE__ = state;

  // 3) Spawna mundo inicial (árvores, pedras, vacas, drops, etc.)
  spawnInitialWorld(state, emitter);

  // 4) Sobe UI (HUD, inventário/baú/carteira, crafting)
  setupUI(state, emitter);

  // 5) Liga eventos entre módulos
  wireEvents(state);

  // 6) Ativa controles (WASD, mouse esq/dir, E/C/ESC)
  setupControls(state, emitter);

  // 7) Inicia loops (update + render)
  startLoops(state);

  // 8) Sanidade: avisa se canvas não estiver clicável (ajuda no diagnóstico de CSS)
  const canvas = document.getElementById("game");
  if (getComputedStyle(canvas).pointerEvents === "none") {
    console.warn(
      "[aviso] canvas #game está com pointer-events:none; verifique o CSS."
    );
  }
}

// DOM pronto
window.addEventListener("DOMContentLoaded", () => {
  boot().catch((err) => {
    console.error("[boot] falhou:", err);
    alert("Falha ao iniciar o jogo: " + err.message);
  });
});

