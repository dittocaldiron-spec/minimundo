// src/ui.js
import emitter from "./utils/events.js";
import { getName } from "./items.js";

/**
 * Helpers
 */
function $(sel, root = document) {
  return root.querySelector(sel);
}
function el(tag, attrs = {}, ...children) {
  const n = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => {
    if (k === "class") n.className = v;
    else if (k === "style") Object.assign(n.style, v);
    else if (k.startsWith("on") && typeof v === "function") n.addEventListener(k.slice(2), v);
    else if (v !== undefined && v !== null) n.setAttribute(k, v);
  });
  for (const c of children) {
    if (c == null) continue;
    n.append(c.nodeType ? c : document.createTextNode(c));
  }
  return n;
}
function labelSlot(s) {
  if (!s) return "";
  const base = getName(s.id);
  return s.qty > 1 ? `${base} x${s.qty}` : base;
}

/**
 * Cria a HUD fixa (dinheiro + dicas + painel rápido)
 */
function createHUD() {
  // A HUD assume que seu HTML/CSS já existe (styles.css). Se não, criamos aqui minimal.
  let hud = $(".hud");
  if (!hud) {
    const wrap = $(".wrap") || document.body;
    hud = el("div", { class: "hud" });
    wrap.appendChild(hud);
  }

  // Dinheiro
  let money = $(".money", hud);
  if (!money) {
    money = el(
      "div",
      { class: "money" },
      el("span", { class: "coin-dot" }),
      " $ ",
      el("span", { id: "moneyCount" }, "0")
    );
    hud.appendChild(money);
  }

  // Painel de ajuda
  let panel = $(".panel", hud);
  if (!panel) {
    panel = el(
      "div",
      { class: "panel" },
      el(
        "div",
        { style: "display:flex;gap:6px;flex-wrap:wrap" },
        el("span", { class: "badge" }, "WASD"),
        el("span", { class: "badge" }, "E inv"),
        el("span", { class: "badge" }, "C carteira"),
        el("span", { class: "badge" }, "ESQ interagir"),
        el("span", { class: "badge" }, "DIR colocar/abrir"),
        el("span", { class: "badge" }, "Alt+Clique: drop 1")
      ),
      el(
        "div",
        { style: "margin-top:6px;font-size:12px" },
        "Mão: ",
        el("strong", {
          id: "handInfo",
          title: "Clique para desequipar",
          style: "cursor:pointer",
        }, "(vazio)")
      )
    );
    hud.appendChild(panel);
  }

  // Dica
  let tip = $(".tip", hud);
  if (!tip) {
    tip = el(
      "div",
      { class: "tip" },
      "Baú: DIR abre, ESQ recolhe. Fogueira cozinha carne (30s). Pedras 50% carvão. Vaca foge ao ser atacada; dropa 5 carnes, 2 couros e 3 ossos."
    );
    hud.appendChild(tip);
  }

  return hud;
}

/**
 * Janela de Inventário + Crafting
 */
function createInventoryWindows() {
  const wrap = $(".wrap") || document.body;

  // Inventário principal
  let invOverlay = $("#inventory");
  if (!invOverlay) {
    invOverlay = el(
      "div",
      { class: "inventory", id: "inventory" },
      el(
        "div",
        { class: "inv-window" },
        el(
          "div",
          { class: "inv-header" },
          el("h3", null, "Inventário"),
          el(
            "div",
            { style: "display:flex;gap:6px" },
            el("button", { class: "btn", id: "toggleCraft" }, "Craft: ", el("span", { id: "craftState" }, "Fechado")),
            el("button", { class: "btn", id: "closeInv" }, "Fechar (E)")
          )
        ),
        el("div", { class: "grid", id: "invGrid" }),
        el(
          "div",
          { class: "craft hidden", id: "craftPanel" },
          el("div", { class: "craft-grid", id: "craftGrid" }),
          el("div", { class: "craft-in", id: "craftIn" }),
          el("div", { class: "craft-list", id: "craftList" }),
          el("small", null, "Deposite quando o painel estiver ", el("b", null, "aberto"), ". Fechado: clique equipa/desequipa; Alt+Clique dropa 1.")
        )
      )
    );
    wrap.appendChild(invOverlay);
  }

  // Baú
  let chestOverlay = $("#chestPanel");
  if (!chestOverlay) {
    chestOverlay = el(
      "div",
      { class: "inventory", id: "chestPanel" },
      el(
        "div",
        { class: "inv-window" },
        el(
          "div",
          { class: "inv-header" },
          el("h3", null, "Baú"),
          el("button", { class: "btn", id: "closeChest" }, "Fechar (ESC)")
        ),
        el("div", { class: "grid small", id: "chestGrid" }),
        el("h4", { style: "margin:8px 0 4px" }, "Seu Inventário"),
        el("div", { class: "grid", id: "invGridChest" })
      )
    );
    wrap.appendChild(chestOverlay);
  }

  // Carteira
  let walletOverlay = $("#wallet");
  if (!walletOverlay) {
    walletOverlay = el(
      "div",
      { class: "wallet", id: "wallet" },
      el(
        "div",
        { class: "wal-window" },
        el(
          "div",
          { class: "wal-header" },
          el("h3", null, "Carteira"),
          el("button", { class: "btn", id: "closeWal" }, "Fechar (C)")
        ),
        el("div", { class: "grid small", id: "walGrid" })
      )
    );
    wrap.appendChild(walletOverlay);
  }

  return { invOverlay, chestOverlay, walletOverlay };
}

/**
 * Render helpers (grids)
 */
function renderMoney(state) {
  const elCount = $("#moneyCount");
  if (elCount) {
    const coins = state.wallet.count ? state.wallet.count("coin") : 0;
    elCount.textContent = coins;
  }
}
function renderHand(state) {
  const h = $("#handInfo");
  if (!h) return;
  h.textContent = state.player.hand ? getName(state.player.hand) : "(vazio)";
}
function renderInventoryGrid(state, emitter) {
  const grid = $("#invGrid");
  if (!grid) return;
  grid.innerHTML = "";

  const craftOpen = !$("#craftPanel")?.classList.contains("hidden");

  state.inventory.slots.forEach((s, i) => {
    const d = el("div", { class: "slot" + (s ? " full" : "") }, s ? labelSlot(s) : "");
    d.title = craftOpen
      ? "Clique: mover 1 p/ crafting • Alt+Clique: dropar 1"
      : "Clique: equipar/desequipar • Alt+Clique: dropar 1";

    d.addEventListener("click", (e) => {
      if (!s) return;

      if (e.altKey) {
        // dropar 1 no chão (o world/controls deve ouvir e realizar o drop no mundo)
        emitter.emit("inventory:dropOne", { id: s.id });
        return;
      }

      if (craftOpen) {
        // mover 1 para crafting (só se crafting estiver aberto)
        const ok = state.inventory.remove(s.id, 1);
        if (ok) {
          state.crafting.deposit(s.id);
          emitter.emit("craft:changed");
          emitter.emit("inv:changed");
        }
        return;
      }

      // Equipar/desequipar na mão
      state.player.hand = state.player.hand === s.id ? null : s.id;
      renderHand(state);
      emitter.emit("ping", state.player.hand ? `${getName(s.id)} equipado` : `${getName(s.id)} desequipado`);
    });

    grid.appendChild(d);
  });
}
function renderWalletGrid(state) {
  const grid = $("#walGrid");
  if (!grid) return;
  grid.innerHTML = "";
  state.wallet.slots.forEach((s) => {
    const d = el("div", { class: "slot" + (s ? " full" : "") }, s ? labelSlot(s) : "");
    grid.appendChild(d);
  });
}
function renderCrafting(state, emitter) {
  const grid = $("#craftGrid");
  const pills = $("#craftIn");
  const list = $("#craftList");
  if (!grid || !pills || !list) return;

  // grid 2x2 (visual)
  grid.innerHTML = "";
  const entries = Object.entries(state.crafting.slots);
  for (let i = 0; i < 4; i++) {
    const sl = el("div", { class: "cslot" + (entries[i] ? " full" : "") }, entries[i] ? `${getName(entries[i][0])} x${entries[i][1]}` : "(vazio)");
    if (entries[i]) {
      const [id] = entries[i];
      sl.title = "Clique para devolver 1";
      sl.addEventListener("click", () => {
        state.crafting.withdraw(id);
        state.inventory.add(id, 1);
        emitter.emit("craft:changed");
        emitter.emit("inv:changed");
      });
    }
    grid.appendChild(sl);
  }

  // lista chips
  pills.innerHTML = "";
  entries.forEach(([id, q]) => {
    const chip = el("div", { class: "pill" }, `${getName(id)} x${q} `, el("button", null, "-"));
    chip.querySelector("button").addEventListener("click", () => {
      state.crafting.withdraw(id);
      state.inventory.add(id, 1);
      emitter.emit("craft:changed");
      emitter.emit("inv:changed");
    });
    pills.appendChild(chip);
  });

  // receitas possíveis — o filtro/listagem é responsabilidade de outro módulo (se houver).
  // Aqui mostramos placeholder; em projetos maiores você importa recipes e cruza com slots.
  list.innerHTML = ""; // você pode popular com receitas válidas aqui
}

/**
 * Baú (render + interações)
 */
function renderChest(state, chestEntity, emitter) {
  const chestGrid = $("#chestGrid");
  const invGrid = $("#invGridChest");
  if (!chestGrid || !invGrid) return;

  // baú -> jogador
  chestGrid.innerHTML = "";
  chestEntity.inv.slots.forEach((s, i) => {
    const d = el("div", { class: "slot" + (s ? " full" : "") }, s ? labelSlot(s) : "");
    d.addEventListener("click", () => {
      if (!s) return;
      // impedir "baú dentro de baú"
      const payload = { itemId: s.id, source: "chest", target: "player" };
      emitter.emit("container:beforePut", payload);
      if (payload.cancel) return;

      // mover do baú para inv
      let moved = true;
      if (s.meta) {
        // items com meta (ex.: chest com memória) — regra: não permitir mover chest pra outro chest
        moved = state.inventory.firstFreeSlot() >= 0 && state.inventory.add(s.id, 1);
        if (moved) chestEntity.inv.slots[i] = null;
      } else {
        moved = state.inventory.add(s.id, s.qty);
        if (moved) chestEntity.inv.slots[i] = null;
      }
      if (!moved) emitter.emit("toast", "Inventário cheio!");
      emitter.emit("inv:changed");
      emitter.emit("chest:changed");
      renderChest(state, chestEntity, emitter);
    });
    chestGrid.appendChild(d);
  });

  // jogador -> baú
  invGrid.innerHTML = "";
  state.inventory.slots.forEach((s, i) => {
    const d = el("div", { class: "slot" + (s ? " full" : "") }, s ? labelSlot(s) : "");
    d.addEventListener("click", () => {
      if (!s) return;
      // impedir "baú dentro de baú"
      const payload = { itemId: s.id, source: "player", target: "chest" };
      emitter.emit("container:beforePut", payload);
      if (payload.cancel) return;

      let moved = true;
      if (s.meta) {
        // não permitir chest (meta) virar "outro item" — mantém o mesmo id com meta
        const free = chestEntity.inv.firstFreeSlot();
        if (free >= 0) {
          chestEntity.inv.slots[free] = { id: s.id, qty: 1, meta: s.meta };
          state.inventory.slots[i] = null;
        } else moved = false;
      } else {
        // mover pilha inteira
        const ok = chestEntity.inv.add(s.id, s.qty);
        if (ok) state.inventory.slots[i] = null;
        else moved = false;
      }

      if (!moved) emitter.emit("toast", "Baú sem espaço!");
      emitter.emit("inv:changed");
      emitter.emit("chest:changed");
      renderChest(state, chestEntity, emitter);
    });
    invGrid.appendChild(d);
  });
}

/**
 * Abertura/fechamento das janelas e binding de botões
 */
function bindInventoryOpenClose(state, emitter) {
  const inv = $("#inventory");
  const craftPanel = $("#craftPanel");
  const craftState = $("#craftState");
  const toggleCraft = $("#toggleCraft");
  const closeInv = $("#closeInv");

  let craftOpen = false;

  function refreshAll() {
    renderHand(state);
    renderInventoryGrid(state, emitter);
    if (craftOpen) renderCrafting(state, emitter);
  }

  emitter.on("ui:inventory:open", () => {
    inv.classList.add("open");
    emitter.emit("ui:inventory:opened");
    refreshAll();
  });
  emitter.on("ui:inventory:close", () => {
    inv.classList.remove("open");
    emitter.emit("ui:inventory:closed");
  });
  emitter.on("ui:inventory:toggle", () => {
    inv.classList.toggle("open");
    if (inv.classList.contains("open")) {
      emitter.emit("ui:inventory:opened");
      refreshAll();
    } else {
      emitter.emit("ui:inventory:closed");
    }
  });

  // botões
  if (toggleCraft) {
    toggleCraft.addEventListener("click", () => {
      craftOpen = !craftOpen;
      if (craftState) craftState.textContent = craftOpen ? "Aberto" : "Fechado";
      craftPanel?.classList.toggle("hidden", !craftOpen);
      refreshAll();
    });
  }
  if (closeInv) {
    closeInv.addEventListener("click", () => emitter.emit("ui:inventory:close"));
  }

  // refresh via eventos do jogo
  emitter.on("inv:changed", () => {
    renderInventoryGrid(state, emitter);
    renderMoney(state);
  });
  emitter.on("craft:changed", () => {
    if (!craftOpen) return;
    renderCrafting(state, emitter);
  });

  // clicar no texto da mão para desequipar
  const handInfo = $("#handInfo");
  if (handInfo) {
    handInfo.addEventListener("click", () => {
      if (state.player.hand) {
        const name = getName(state.player.hand);
        state.player.hand = null;
        renderHand(state);
        emitter.emit("ping", `${name} desequipado`);
      }
    });
  }
}

function bindWalletOpenClose(state, emitter) {
  const wal = $("#wallet");
  const closeWal = $("#closeWal");

  emitter.on("ui:wallet:open", () => {
    wal.classList.add("open");
    renderWalletGrid(state);
    renderMoney(state);
  });
  emitter.on("ui:wallet:close", () => {
    wal.classList.remove("open");
  });
  emitter.on("ui:wallet:toggle", () => {
    wal.classList.toggle("open");
    if (wal.classList.contains("open")) {
      renderWalletGrid(state);
      renderMoney(state);
    }
  });

  if (closeWal) closeWal.addEventListener("click", () => emitter.emit("ui:wallet:close"));

  emitter.on("wallet:changed", () => {
    renderWalletGrid(state);
    renderMoney(state);
  });
}

function bindChestOpenClose(state, emitter) {
  const chestOverlay = $("#chestPanel");
  const closeChest = $("#closeChest");
  let currentChest = null;

  emitter.on("chest:open", (entity) => {
    currentChest = entity || null;
    if (!currentChest) return;
    chestOverlay.classList.add("open");
    renderChest(state, currentChest, emitter);
  });

  function close() {
    chestOverlay.classList.remove("open");
    currentChest = null;
  }

  emitter.on("chest:close", () => close());
  if (closeChest) closeChest.addEventListener("click", () => close());

  emitter.on("chest:changed", () => {
    if (currentChest) renderChest(state, currentChest, emitter);
  });
}

/**
 * Toast simples (usando HUD)
 */
function bindToasts() {
  let toastEl = null;
  let tId = 0;
  emitter.on("toast", (msg) => {
    if (!toastEl) {
      toastEl = el("div", { class: "toast" });
      const hud = $(".hud") || document.body;
      hud.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.style.display = "block";
    const id = ++tId;
    setTimeout(() => {
      if (id === tId && toastEl) toastEl.style.display = "none";
    }, 2000);
  });

  // feedback (ping) também aparece como toast
  emitter.on("ping", (m) => emitter.emit("toast", m));
}

/**
 * API principal
 */
export function setupUI(state, emitter) {
  createHUD();
  createInventoryWindows();
  renderMoney(state);
  renderHand(state);
  renderInventoryGrid(state, emitter);

  bindInventoryOpenClose(state, emitter);
  bindWalletOpenClose(state, emitter);
  bindChestOpenClose(state, emitter);
  bindToasts();

  // Ajustes de foco/click-through:
  // garante que as janelas abertas ficam por cima do canvas e são clicáveis
  const canvas = document.getElementById("game");
  if (canvas && getComputedStyle(canvas).zIndex === "auto") {
    canvas.style.zIndex = "10";
  }
}
