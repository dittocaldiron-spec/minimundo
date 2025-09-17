// src/worlds.js
import emitter from "./utils/events.js";
import { items, hasTag, getName, placeSpec } from "./items.js";

/* =========================
 * Helpers
 * =======================*/
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const TILE = 32;

function snapToTile(x, y) {
  return {
    x: Math.floor(x / TILE) * TILE + TILE / 2,
    y: Math.floor(y / TILE) * TILE + TILE / 2,
  };
}

// Inventário: pegar 1 item (prioriza itens com meta se existirem)
function invTakeOne(inv, id) {
  for (let i = 0; i < inv.slots.length; i++) {
    const s = inv.slots[i];
    if (!s || s.id !== id) continue;
    // meta: item único
    if (s.meta) {
      inv.slots[i] = null;
      return { id, qty: 1, meta: s.meta, slot: i };
    }
    // pilha
    s.qty -= 1;
    const ret = { id, qty: 1 };
    if (s.qty <= 0) inv.slots[i] = null;
    return ret;
  }
  return null;
}

// Inventário: inserir 1 item com meta em slot livre
function invPutMeta(inv, obj) {
  const i = inv.slots.findIndex((s) => !s);
  if (i < 0) return false;
  inv.slots[i] = { id: obj.id, qty: 1, meta: obj.meta };
  return true;
}

function isSolidEnt(e) {
  if (e.type === "placed") return !!e.solid;
  return e.type === "tree" || e.type === "rock" || e.type === "chest" || e.type === "campfire" || e.type === "cow";
}

function collide(state, x, y) {
  for (const e of state.entities) {
    if (e.dead) continue;
    if (!isSolidEnt(e)) continue;
    const r = e.r || 16;
    const d = Math.hypot(e.x - x, e.y - y);
    if (d < r + 14) return true;
  }
  return false;
}

function nearest(state, pred) {
  let best = null,
    bestD = 1e9;
  const p = state.player;
  for (const e of state.entities) {
    if (e.dead) continue;
    if (pred && !pred(e)) continue;
    const d = Math.hypot(e.x - p.x, e.y - p.y);
    if (d < bestD) {
      best = e;
      bestD = d;
    }
  }
  return { ent: best, dist: bestD };
}

function dropSpawn(state, id, x, y, lifeMs = 300000) {
  state.entities.push({
    type: "item",
    itemId: id,
    x: x + (Math.random() * 10 - 5),
    y: y + (Math.random() * 6 - 3),
    r: 12,
    picked: 0,
    exp: performance.now() + lifeMs,
  });
}

function mouseWorldFromScreen(state, sx, sy) {
  // Calcula a mesma câmera usada em render.js
  const canvas = document.getElementById("game");
  const camX = clamp(state.player.x - canvas.width / 2, 0, state.world.w - canvas.width);
  const camY = clamp(state.player.y - canvas.height / 2, 0, state.world.h - canvas.height);
  return { x: camX + sx, y: camY + sy };
}

/* =========================
 * Geração inicial
 * =======================*/
function generateWorld(state) {
  state.entities.length = 0;

  // Moedas
  for (let i = 0; i < 18; i++) {
    const p = snapToTile(rand(200, 2100), rand(200, 1500));
    state.entities.push({ type: "coin", x: p.x, y: p.y, r: 10, picked: 0 });
  }
  // Árvores
  for (let i = 0; i < 26; i++) {
    const p = snapToTile(rand(120, state.world.w - 120), rand(120, state.world.h - 120));
    state.entities.push({ type: "tree", x: p.x, y: p.y, r: 22, hp: 5, taps: 0 });
  }
  // Rochas
  for (let i = 0; i < 18; i++) {
    const p = snapToTile(rand(260, state.world.w - 260), rand(260, state.world.h - 260));
    state.entities.push({ type: "rock", x: p.x, y: p.y, r: 20, hp: 20 });
  }
  // Cows iniciais (poucas, sem rebanho)
  for (let i = 0; i < 5; i++) {
    const p = snapToTile(rand(160, state.world.w - 160), rand(160, state.world.h - 160));
    state.entities.push({ type: "cow", x: p.x, y: p.y, r: 14, hp: 3, fleeUntil: 0 });
  }
  // Machado no chão
  {
    const p = snapToTile(state.world.w / 2 - 120, state.world.h / 2);
    state.entities.push({ type: "item", itemId: "axe", x: p.x, y: p.y, r: 14, picked: 0, exp: performance.now() + 300000 });
  }
}

/* =========================
 * Regras de jogo
 * =======================*/
const RANGE = 56;

function pickEntityToInteract(state) {
  return nearest(
    state,
    (e) =>
      e.type === "placed" ||
      e.type === "chest" ||
      (e.type === "item" && !e.picked) ||
      (e.type === "coin" && !e.picked) ||
      e.type === "tree" ||
      (e.type === "rock" && e.hp > 0) ||
      e.type === "cow" ||
      e.type === "campfire"
  );
}

function breakTree(state, ent, usingToolId) {
  if (usingToolId && hasTag(usingToolId, "chop")) {
    ent.hp = Math.max(0, (ent.hp || 5) - 1);
    emitter.emit("ping", `Machado: HP ${ent.hp}`);
    if (ent.hp <= 0) {
      for (let i = 0; i < 10; i++) dropSpawn(state, "wood", ent.x, ent.y);
      const saplings = Math.random() < 0.5 ? 1 : 3;
      for (let i = 0; i < saplings; i++) dropSpawn(state, "sapling", ent.x, ent.y);
      const sticks = Math.floor(Math.random() * 3);
      for (let i = 0; i < sticks; i++) dropSpawn(state, "stick", ent.x, ent.y);
      ent.dead = 1;
    }
  } else {
    // soco não quebra árvore; a cada 10 cliques dropa 1 graveto
    ent.taps = (ent.taps || 0) + 1;
    const r = 10 - (ent.taps % 10);
    if (ent.taps % 10 === 0) {
      dropSpawn(state, "stick", ent.x, ent.y);
      emitter.emit("ping", "Graveto!");
    } else {
      emitter.emit("ping", `Soco… faltam ${r}`);
    }
  }
}

function breakRock(state, ent, usingToolId) {
  const dmg = usingToolId && hasTag(usingToolId, "mine") ? 5 : 2;
  ent.hp = Math.max(0, ent.hp - dmg);
  emitter.emit("ping", `Rocha HP ${ent.hp}`);
  if (ent.hp <= 0) {
    const n = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) dropSpawn(state, "rockshard", ent.x, ent.y);
    // regra: TODA pedra tem 50% de chance de dropar 1 carvão
    if (Math.random() < 0.5) dropSpawn(state, "coal", ent.x, ent.y);
    ent.dead = 1;
  }
}

function attackCow(state, ent, usingToolId) {
  // esquerda: atacar (qualquer item; mais sentido com espada)
  const dmg = usingToolId && hasTag(usingToolId, "weapon") ? 2 : 1;
  ent.hp = Math.max(0, (ent.hp || 3) - dmg);
  ent.fleeUntil = performance.now() + 6000; // foge por 6s
  if (ent.hp <= 0) {
    // drops: 5 carnes, 2 couros, 3 ossos
    for (let i = 0; i < 5; i++) dropSpawn(state, "beef", ent.x, ent.y);
    for (let i = 0; i < 2; i++) dropSpawn(state, "leather", ent.x, ent.y);
    for (let i = 0; i < 3; i++) dropSpawn(state, "bone", ent.x, ent.y);
    ent.dead = 1;
    emitter.emit("ping", "Vaca abatida");
  } else {
    emitter.emit("ping", "A vaca foge!");
  }
}

function openChest(state, ent) {
  emitter.emit("chest:open", ent);
}

function pickPlaced(state, ent) {
  // recolhe um "placed" (não baú): volta para inventário
  const ok = state.inventory.add(ent.placedId, 1);
  if (ok) {
    ent.dead = 1;
    emitter.emit("ping", `${getName(ent.placedId)} recolhido`);
    emitter.emit("inv:changed");
  } else {
    emitter.emit("toast", "Inventário cheio!");
  }
}

function pickChest(state, ent) {
  // recolhe baú com memória (meta)
  const ok = invPutMeta(state.inventory, { id: "chest", meta: { inv: ent.inv } });
  if (ok) {
    ent.dead = 1;
    emitter.emit("chest:close");
    emitter.emit("ping", "Baú recolhido");
    emitter.emit("inv:changed");
  } else {
    emitter.emit("toast", "Sem espaço para o baú");
  }
}

function pickDrop(state, ent) {
  ent.picked = 1;
  const ok = state.inventory.add(ent.itemId, 1);
  if (!ok) {
    ent.picked = 0;
    emitter.emit("toast", "Inventário cheio!");
  } else {
    emitter.emit("ping", `Pegou ${getName(ent.itemId)}`);
    emitter.emit("inv:changed");
  }
}

function pickCoin(state, ent) {
  ent.picked = 1;
  const ok = state.wallet.add ? state.wallet.add("coin", 1) : false;
  if (!ok) {
    ent.picked = 0;
    emitter.emit("toast", "Carteira cheia!");
  } else {
    emitter.emit("wallet:changed");
    emitter.emit("ping", "Moeda +1");
  }
}

function canPlaceHere(state, gx, gy) {
  // espaço livre (sem sólidos colidindo)
  return !state.entities.some(
    (ent) => !ent.dead && isSolidEnt(ent) && Math.hypot(ent.x - gx, ent.y - gy) < (ent.r || 14) + 2
  );
}

function placeFromHand(state, wx, wy) {
  const id = state.player.hand;
  if (!id) return;

  const g = snapToTile(wx, wy);
  const gx = clamp(g.x, 40, state.world.w - 40);
  const gy = clamp(g.y, 40, state.world.h - 40);

  if (!canPlaceHere(state, gx, gy)) {
    emitter.emit("toast", "Espaço ocupado!");
    return;
  }

  if (hasTag(id, "place")) {
    if (id === "sapling") {
      // vira árvore
      const taken = state.inventory.remove("sapling", 1);
      if (!taken) return emitter.emit("toast", "Sem muda");
      state.entities.push({ type: "tree", x: gx, y: gy, r: placeSpec("sapling").radius, hp: 5, taps: 0 });
      emitter.emit("ping", "Muda plantada");
    } else if (id === "chest") {
      const t = invTakeOne(state.inventory, "chest");
      if (!t) return emitter.emit("toast", "Sem baú");
      const inv = (t.meta && t.meta.inv) || makeInventory(12);
      state.entities.push({ type: "chest", x: gx, y: gy, r: placeSpec("chest").radius, inv });
      emitter.emit("ping", "Baú colocado");
    } else if (id === "campfire") {
      const t = invTakeOne(state.inventory, "campfire");
      if (!t) return emitter.emit("toast", "Sem fogueira");
      state.entities.push({ type: "campfire", x: gx, y: gy, r: placeSpec("campfire").radius, cooking: 0, doneAt: 0 });
      emitter.emit("ping", "Fogueira colocada");
    }
  } else {
    // colocar item "genérico" como placed decorativo
    const t = invTakeOne(state.inventory, id);
    if (!t) return emitter.emit("toast", "Você não tem esse item");
    const solid = hasTag(id, "solid");
    state.entities.push({ type: "placed", placedId: id, x: gx, y: gy, r: 14, solid });
    emitter.emit("ping", `${getName(id)} colocado`);
  }

  if (state.inventory.count && state.inventory.count(id) <= 0) {
    state.player.hand = null;
  }
  emitter.emit("inv:changed");
}

/* =========================
 * Fogueira
 * =======================*/
function cookOnCampfire(state, camp) {
  if (camp.cooking) return emitter.emit("toast", "Já cozinhando");
  const ok = state.inventory.remove("beef", 1);
  if (!ok) return emitter.emit("toast", "Precisa de 1 carne crua");
  camp.cooking = 1;
  camp.doneAt = performance.now() + 30000; // 30s
  emitter.emit("ping", "Cozinhando… (30s)");
}

/* =========================
 * Inventário auxiliar
 * =======================*/
function makeInventory(size = 12) {
  return {
    slots: new Array(size).fill(null),
    add(id, qty = 1) {
      let left = qty;
      // empilhar
      for (let i = 0; i < this.slots.length && left > 0; i++) {
        const s = this.slots[i];
        if (s && s.id === id && !s.meta) {
          s.qty += 1;
          left--;
        }
      }
      // slots livres
      for (let i = 0; i < this.slots.length && left > 0; i++) {
        if (!this.slots[i]) {
          this.slots[i] = { id, qty: 1 };
          left--;
        }
      }
      return left === 0;
    },
    count(id) {
      return this.slots.reduce((a, s) => a + (s && s.id === id ? s.qty : 0), 0);
    },
    firstFreeSlot() {
      return this.slots.findIndex((s) => !s);
    },
  };
}

/* =========================
 * Loop do mundo (movimento, IA, timers)
 * =======================*/
export function initWorld(state, emitter) {
  // player base
  state.player.x = state.player.x || state.world.w / 2;
  state.player.y = state.player.y || state.world.h / 2;
  state.player.w = state.player.w || 26;
  state.player.h = state.player.h || 32;
  state.player.speed = state.player.speed || 210;
  state.player.hand = state.player.hand || null;

  generateWorld(state);

  // Direção contínua
  let last = performance.now();
  let dir = { dx: 0, dy: 0 };

  emitter.on("input:dir", (d) => {
    dir = d || { dx: 0, dy: 0 };
  });

  // Clique esquerdo = interagir/atacar/quebrar/coletar
  emitter.on("click:left", () => {
    const { ent, dist } = pickEntityToInteract(state);
    if (!ent || dist > RANGE) return;

    if (ent.type === "placed") return pickPlaced(state, ent);
    if (ent.type === "chest") return pickChest(state, ent);
    if (ent.type === "item" && !ent.picked) return pickDrop(state, ent);
    if (ent.type === "coin" && !ent.picked) return pickCoin(state, ent);

    if (ent.type === "tree") return breakTree(state, ent, state.player.hand);
    if (ent.type === "rock") return breakRock(state, ent, state.player.hand);
    if (ent.type === "cow") return attackCow(state, ent, state.player.hand);
  });

  // Clique direito = colocar item / abrir baú / cozinhar
  emitter.on("click:right", ({ sx, sy }) => {
    // abrir baú se perto
    const nearChest = nearest(state, (e) => e.type === "chest");
    if (nearChest.ent && nearChest.dist <= RANGE) {
      return openChest(state, nearChest.ent);
    }
    // cozinhar se carne na mão e perto de fogueira
    if (state.player.hand === "beef") {
      const nearFire = nearest(state, (e) => e.type === "campfire");
      if (nearFire.ent && nearFire.dist <= RANGE) {
        return cookOnCampfire(state, nearFire.ent);
      }
    }
    // colocar no mundo
    const { x: wx, y: wy } = mouseWorldFromScreen(state, sx, sy);
    if (!state.player.hand) return;
    placeFromHand(state, wx, wy);
  });

  // Drop 1 do item na mão (tecla Q)
  emitter.on("player:dropHandOne", () => {
    const id = state.player.hand;
    if (!id) return;
    const taken = invTakeOne(state.inventory, id);
    if (!taken) return;
    dropSpawn(state, id, state.player.x, state.player.y);
    emitter.emit("ping", `${getName(id)} dropado`);
    if (state.inventory.count && state.inventory.count(id) <= 0) state.player.hand = null;
    emitter.emit("inv:changed");
  });

  // UI toggles
  emitter.on("action:toggleInventory", () => {
    // Fechar baú ao abrir/fechar inventário
    emitter.emit("chest:close");
    emitter.emit("ui:inventory:toggle");
  });
  emitter.on("action:toggleWallet", () => {
    emitter.emit("ui:wallet:toggle");
  });
  emitter.on("action:esc", () => {
    emitter.emit("chest:close");
  });

  // Impedir baú dentro de baú
  emitter.on("container:beforePut", (payload) => {
    if (payload.itemId === "chest" && payload.target === "chest") {
      payload.cancel = true;
      emitter.emit("toast", "Não é possível guardar um baú dentro de outro baú.");
    }
  });

  // Crafting volta ao inventário quando inventário fechar
  emitter.on("ui:inventory:closed", () => {
    const entries = Object.entries(state.crafting.slots);
    for (const [id, q] of entries) {
      for (let i = 0; i < q; i++) state.inventory.add(id, 1);
    }
    state.crafting.slots = {};
    emitter.emit("craft:changed");
    emitter.emit("inv:changed");
  });

  // UI pede drop One (Alt+Clique em slot)
  emitter.on("inventory:dropOne", ({ id }) => {
    const t = invTakeOne(state.inventory, id);
    if (!t) return;
    dropSpawn(state, id, state.player.x, state.player.y);
    emitter.emit("ping", `${getName(id)} dropado`);
    if (state.inventory.count && state.inventory.count(id) <= 0 && state.player.hand === id) {
      state.player.hand = null;
    }
    emitter.emit("inv:changed");
  });

  // Loop do mundo
  function tick(now) {
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;

    // mover player
    const p = state.player;
    const speed = p.speed || 210;
    const vx = (dir.dx || 0) * speed * dt;
    const vy = (dir.dy || 0) * speed * dt;
    const nx = clamp(p.x + vx, p.w / 2, state.world.w - p.w / 2);
    const ny = clamp(p.y + vy, p.h / 2, state.world.h - p.h / 2);
    if (!collide(state, nx, p.y)) p.x = nx;
    if (!collide(state, p.x, ny)) p.y = ny;
    if (Math.abs(vx) > Math.abs(vy)) p.dir = vx > 0 ? "right" : "left";
    else if (Math.abs(vy) > 0.001) p.dir = vy > 0 ? "down" : "up";

    // timers/IA
    const t = performance.now();
    for (const e of state.entities) {
      if (e.dead) continue;
      if (e.type === "item" && e.exp && t > e.exp) e.dead = 1;
      if (e.type === "campfire" && e.cooking && t > e.doneAt) {
        e.cooking = 0;
        dropSpawn(state, "cookedbeef", e.x, e.y - 18);
        emitter.emit("ping", "Carne pronta!");
      }
      if (e.type === "cow") {
        if (t < (e.fleeUntil || 0)) {
          // fugir do player
          const ax = e.x - p.x;
          const ay = e.y - p.y;
          const L = Math.hypot(ax, ay) || 1;
          const sp = 120 * dt;
          e.x = clamp(e.x + (ax / L) * sp, 16, state.world.w - 16);
          e.y = clamp(e.y + (ay / L) * sp, 16, state.world.h - 16);
        } else if (Math.random() < 0.02) {
          // vagar
          e.x = clamp(e.x + (Math.random() * 2 - 1) * 30 * dt, 16, state.world.w - 16);
          e.y = clamp(e.y + (Math.random() * 2 - 1) * 30 * dt, 16, state.world.h - 16);
        }
      }
    }

    requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
}
