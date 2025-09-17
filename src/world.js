// src/world.js
import { makeInventory } from "./state.js";
import { getName, hasTag, placeSpec } from "./items.js";

const TILE = 32;
const PLAYER_RADIUS = 14;
const INTERACT_RANGE = 56;
const AUTOPICK_RADIUS = 32;

const rand = (min, max) => min + Math.random() * (max - min);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

let nextEntityId = 1;
const withId = (data) => ({ id: nextEntityId++, ...data });

function snapToTile(x, y) {
  return {
    x: Math.floor(x / TILE) * TILE + TILE / 2,
    y: Math.floor(y / TILE) * TILE + TILE / 2,
  };
}

function ensurePlayerDefaults(state) {
  const { player, world } = state;
  player.x = player.x ?? world.w / 2;
  player.y = player.y ?? world.h / 2;
  player.w = player.w ?? 26;
  player.h = player.h ?? 32;
  player.speed = player.speed ?? 210;
  player.hand = player.hand ?? null;
  player.moveDir = player.moveDir || { dx: 0, dy: 0 };
  player.focusId = null;
}

function isSolid(entity) {
  if (!entity || entity.dead) return false;
  if (entity.type === "placed") return !!entity.solid;
  return ["tree", "rock", "chest", "campfire", "cow"].includes(entity.type);
}

function collides(state, targetX, targetY) {
  for (const ent of state.entities) {
    if (!isSolid(ent)) continue;
    const radius = ent.r ?? 16;
    const dist = Math.hypot(ent.x - targetX, ent.y - targetY);
    if (dist < radius + PLAYER_RADIUS) return true;
  }
  return false;
}

function findNearest(state, predicate) {
  const { player } = state;
  let best = null;
  let bestDist = Infinity;
  for (const ent of state.entities) {
    if (ent.dead) continue;
    if (predicate && !predicate(ent)) continue;
    const dist = Math.hypot(ent.x - player.x, ent.y - player.y);
    if (dist < bestDist) {
      best = ent;
      bestDist = dist;
    }
  }
  return { entity: best, distance: bestDist };
}

function getInteractionTarget(state) {
  return findNearest(
    state,
    (ent) =>
      ent.type === "placed" ||
      ent.type === "campfire" ||
      ent.type === "chest" ||
      ent.type === "tree" ||
      ent.type === "rock" ||
      ent.type === "cow" ||
      (ent.type === "item" && !ent.picked) ||
      (ent.type === "coin" && !ent.picked)
  );
}

function spawnDrop(state, id, x, y, options = {}) {
  const { qty = 1, ttl = 300000, meta = null } = options;
  const count = Math.max(1, qty);
  for (let i = 0; i < count; i++) {
    state.entities.push(
      withId({
        type: "item",
        itemId: id,
        meta: meta && i === 0 ? meta : meta,
        x: x + (Math.random() * 14 - 7),
        y: y + (Math.random() * 10 - 5),
        r: 12,
        picked: 0,
        expiresAt: ttl ? performance.now() + ttl : null,
      })
    );
  }
}

function ensureCampfire(state, cx, cy) {
  state.entities.push(
    withId({
      type: "campfire",
      x: cx,
      y: cy,
      r: placeSpec("campfire").radius,
      cooking: 0,
      doneAt: 0,
    })
  );
}

function generateWorld(state) {
  state.entities = [];

  // Coins scattered around the map
  for (let i = 0; i < 18; i++) {
    const pos = snapToTile(rand(160, state.world.w - 160), rand(160, state.world.h - 160));
    state.entities.push(withId({ type: "coin", x: pos.x, y: pos.y, r: 10, picked: 0 }));
  }

  // Trees
  for (let i = 0; i < 28; i++) {
    const pos = snapToTile(rand(120, state.world.w - 120), rand(120, state.world.h - 120));
    state.entities.push(withId({ type: "tree", x: pos.x, y: pos.y, r: 22, hp: 5, taps: 0 }));
  }

  // Rocks
  for (let i = 0; i < 20; i++) {
    const pos = snapToTile(rand(220, state.world.w - 220), rand(220, state.world.h - 220));
    state.entities.push(withId({ type: "rock", x: pos.x, y: pos.y, r: 20, hp: 20 }));
  }

  // Passive cows
  for (let i = 0; i < 6; i++) {
    const pos = snapToTile(rand(180, state.world.w - 180), rand(180, state.world.h - 180));
    state.entities.push(withId({ type: "cow", x: pos.x, y: pos.y, r: 16, hp: 3, fleeUntil: 0 }));
  }

  // A campfire near spawn so the player can cook early on
  const campfireSpot = snapToTile(state.world.w / 2 + 120, state.world.h / 2 + 100);
  ensureCampfire(state, campfireSpot.x, campfireSpot.y);

  // A chest already stocked with supplies
  const chestSpot = snapToTile(state.world.w / 2 + 200, state.world.h / 2 - 60);
  const starterChest = withId({
    type: "chest",
    x: chestSpot.x,
    y: chestSpot.y,
    r: placeSpec("chest").radius,
    inv: makeInventory(18),
  });
  starterChest.inv.add("wood", 10);
  starterChest.inv.add("rockshard", 6);
  starterChest.inv.add("coin", 12);
  state.entities.push(starterChest);

  // Starter axe on the ground
  const axeSpot = snapToTile(state.world.w / 2 - 100, state.world.h / 2);
  spawnDrop(state, "axe", axeSpot.x, axeSpot.y, { ttl: 600000 });

  // Few saplings to encourage planting
  for (let i = 0; i < 3; i++) {
    const pos = snapToTile(state.world.w / 2 - 80 + i * 22, state.world.h / 2 + 80);
    spawnDrop(state, "sapling", pos.x, pos.y, { ttl: 600000 });
  }
}

function pickupItem(state, entity, emitter) {
  if (entity.dead) return;
  const before = state.inventory.count(entity.itemId);
  const added = state.inventory.add(entity.itemId, 1, entity.meta || null);
  const after = state.inventory.count(entity.itemId);
  if (!added && after === before) {
    emitter.emit("toast", "Inventário cheio!");
    return;
  }
  entity.dead = true;
  emitter.emit("inv:changed");
  emitter.emit("ping", `Pegou ${getName(entity.itemId)}`);
}

function pickupCoin(state, entity, emitter) {
  if (entity.dead) return;
  const before = state.wallet.count("coin");
  const added = state.wallet.add("coin", 1);
  const after = state.wallet.count("coin");
  if (!added && after === before) {
    emitter.emit("toast", "Carteira cheia!");
    return;
  }
  entity.dead = true;
  emitter.emit("wallet:changed");
  emitter.emit("ping", "Moeda +1");
}

function pickupPlaced(state, entity, emitter) {
  if (!entity.placedId) return;
  const ok = state.inventory.add(entity.placedId, 1);
  if (!ok) {
    emitter.emit("toast", "Inventário cheio!");
    return;
  }
  entity.dead = true;
  emitter.emit("inv:changed");
  emitter.emit("ping", `${getName(entity.placedId)} recolhido`);
}

function pickupChest(state, entity, emitter) {
  const ok = state.inventory.add("chest", 1, { inv: entity.inv });
  if (!ok) {
    emitter.emit("toast", "Sem espaço para o baú");
    return;
  }
  entity.dead = true;
  emitter.emit("chest:close");
  emitter.emit("inv:changed");
  emitter.emit("ping", "Baú recolhido");
}

function breakTree(state, entity, emitter, toolId) {
  if (toolId && hasTag(toolId, "chop")) {
    entity.hp = Math.max(0, (entity.hp || 5) - 1);
    emitter.emit("ping", `Machado na árvore: HP ${entity.hp}`);
    if (entity.hp <= 0) {
      for (let i = 0; i < 8; i++) spawnDrop(state, "wood", entity.x, entity.y);
      const saplings = Math.random() < 0.5 ? 1 : 3;
      for (let i = 0; i < saplings; i++) spawnDrop(state, "sapling", entity.x, entity.y);
      if (Math.random() < 0.4) spawnDrop(state, "stick", entity.x, entity.y, { qty: 2 });
      entity.dead = true;
    }
  } else {
    entity.taps = (entity.taps || 0) + 1;
    if (entity.taps % 10 === 0) {
      spawnDrop(state, "stick", entity.x, entity.y);
      emitter.emit("ping", "Graveto conseguido!");
    } else {
      emitter.emit("ping", `Continue batendo… faltam ${10 - (entity.taps % 10)} golpes`);
    }
  }
}

function breakRock(state, entity, emitter, toolId) {
  const dmg = toolId && hasTag(toolId, "mine") ? 5 : 2;
  entity.hp = Math.max(0, (entity.hp || 20) - dmg);
  emitter.emit("ping", `Rocha: HP ${entity.hp}`);
  if (entity.hp <= 0) {
    const shards = 1 + Math.floor(Math.random() * 3);
    spawnDrop(state, "rockshard", entity.x, entity.y, { qty: shards });
    if (Math.random() < 0.5) spawnDrop(state, "coal", entity.x, entity.y);
    entity.dead = true;
  }
}

function attackCow(state, entity, emitter, toolId) {
  const dmg = toolId && hasTag(toolId, "weapon") ? 2 : 1;
  entity.hp = Math.max(0, (entity.hp || 3) - dmg);
  entity.fleeUntil = performance.now() + 6000;
  if (entity.hp <= 0) {
    spawnDrop(state, "beef", entity.x, entity.y, { qty: 4 });
    spawnDrop(state, "leather", entity.x, entity.y, { qty: 2 });
    spawnDrop(state, "bone", entity.x, entity.y, { qty: 3 });
    entity.dead = true;
    emitter.emit("ping", "Vaca abatida");
  } else {
    emitter.emit("ping", "A vaca foge!");
  }
}

function canPlace(state, gx, gy) {
  return !state.entities.some(
    (ent) =>
      isSolid(ent) && Math.hypot(ent.x - gx, ent.y - gy) < (ent.r || 14) + 4
  );
}

function placeFromHand(state, emitter, worldX, worldY) {
  const id = state.player.hand;
  if (!id) return;
  const snapped = snapToTile(worldX, worldY);
  const gx = clamp(snapped.x, 40, state.world.w - 40);
  const gy = clamp(snapped.y, 40, state.world.h - 40);

  if (!canPlace(state, gx, gy)) {
    emitter.emit("toast", "Espaço ocupado");
    return;
  }

  const item = state.inventory.takeOne(id);
  if (!item) {
    emitter.emit("toast", "Você não possui este item");
    state.player.hand = null;
    emitter.emit("inv:changed");
    return;
  }

  if (id === "sapling") {
    state.entities.push(
      withId({ type: "tree", x: gx, y: gy, r: placeSpec("sapling").radius, hp: 5, taps: 0 })
    );
    emitter.emit("ping", "Muda plantada");
  } else if (id === "chest") {
    const inventory = item.meta?.inv || makeInventory(18);
    state.entities.push(
      withId({ type: "chest", x: gx, y: gy, r: placeSpec("chest").radius, inv: inventory })
    );
    emitter.emit("ping", "Baú posicionado");
  } else if (id === "campfire") {
    state.entities.push(
      withId({
        type: "campfire",
        x: gx,
        y: gy,
        r: placeSpec("campfire").radius,
        cooking: 0,
        doneAt: 0,
      })
    );
    emitter.emit("ping", "Fogueira montada");
  } else {
    const solid = hasTag(id, "solid");
    state.entities.push(
      withId({ type: "placed", placedId: id, solid, x: gx, y: gy, r: 14 })
    );
    emitter.emit("ping", `${getName(id)} colocado`);
  }

  if (state.inventory.count(id) <= 0) {
    state.player.hand = null;
  }
  emitter.emit("inv:changed");
}

function cookOnCampfire(state, emitter, campfire) {
  if (campfire.cooking) {
    emitter.emit("toast", "A fogueira já está cozinhando");
    return;
  }
  const ok = state.inventory.remove("beef", 1);
  if (!ok) {
    emitter.emit("toast", "Precisa de 1 carne crua");
    return;
  }
  campfire.cooking = 1;
  campfire.doneAt = performance.now() + 30000;
  emitter.emit("ping", "Carne cozinhando (30s)");
  if (state.inventory.count("beef") <= 0 && state.player.hand === "beef") {
    state.player.hand = null;
  }
  emitter.emit("inv:changed");
}

function mouseWorldFromScreen(state, sx, sy) {
  const canvas = document.getElementById("game");
  if (!canvas) return { x: state.player.x, y: state.player.y };
  const camX = clamp(state.player.x - canvas.width / 2, 0, state.world.w - canvas.width);
  const camY = clamp(state.player.y - canvas.height / 2, 0, state.world.h - canvas.height);
  return { x: camX + sx, y: camY + sy };
}

function dropFromHand(state, emitter) {
  const id = state.player.hand;
  if (!id) return;
  const item = state.inventory.takeOne(id);
  if (!item) return;
  spawnDrop(state, id, state.player.x, state.player.y, { meta: item.meta || null });
  emitter.emit("ping", `${getName(id)} dropado`);
  if (state.inventory.count(id) <= 0) state.player.hand = null;
  emitter.emit("inv:changed");
}

function dropFromInventory(state, emitter, id) {
  const item = state.inventory.takeOne(id);
  if (!item) {
    emitter.emit("toast", "Você não tem esse item");
    return;
  }
  spawnDrop(state, id, state.player.x, state.player.y, { meta: item.meta || null });
  emitter.emit("ping", `${getName(id)} dropado`);
  if (state.player.hand === id && state.inventory.count(id) <= 0) state.player.hand = null;
  emitter.emit("inv:changed");
}

function handlePrimaryAction(state, emitter) {
  const { entity, distance } = getInteractionTarget(state);
  if (!entity || distance > INTERACT_RANGE) return;

  if (entity.type === "item") return pickupItem(state, entity, emitter);
  if (entity.type === "coin") return pickupCoin(state, entity, emitter);
  if (entity.type === "placed") return pickupPlaced(state, entity, emitter);
  if (entity.type === "chest") return pickupChest(state, entity, emitter);
  if (entity.type === "tree") return breakTree(state, entity, emitter, state.player.hand);
  if (entity.type === "rock") return breakRock(state, entity, emitter, state.player.hand);
  if (entity.type === "cow") return attackCow(state, entity, emitter, state.player.hand);
  if (entity.type === "campfire") {
    if (!entity.cooking) {
      emitter.emit("toast", "Use o botão direito com carne crua equipada");
    }
  }
}

function handleSecondaryAction(state, emitter, payload) {
  const chestNear = findNearest(state, (ent) => ent.type === "chest");
  if (chestNear.entity && chestNear.distance <= INTERACT_RANGE) {
    emitter.emit("chest:open", chestNear.entity);
    return;
  }

  if (state.player.hand === "beef") {
    const fire = findNearest(state, (ent) => ent.type === "campfire");
    if (fire.entity && fire.distance <= INTERACT_RANGE) {
      cookOnCampfire(state, emitter, fire.entity);
      return;
    }
  }

  if (!state.player.hand) return;
  const { sx = 0, sy = 0 } = payload || {};
  const worldPos = mouseWorldFromScreen(state, sx, sy);
  placeFromHand(state, emitter, worldPos.x, worldPos.y);
}

function updateFocus(state) {
  const { entity, distance } = getInteractionTarget(state);
  state.player.focusId = entity && distance <= INTERACT_RANGE ? entity.id : null;
}

function autopickNearby(state, emitter) {
  const { player } = state;
  for (const ent of state.entities) {
    if (ent.dead) continue;
    const dist = Math.hypot(ent.x - player.x, ent.y - player.y);
    if (dist > AUTOPICK_RADIUS) continue;
    if (ent.type === "item") pickupItem(state, ent, emitter);
    if (ent.type === "coin") pickupCoin(state, ent, emitter);
  }
}

function updateEntities(state, dt, emitter) {
  const now = performance.now();
  const { player } = state;

  for (const ent of state.entities) {
    if (ent.dead) continue;

    if (ent.type === "item" && ent.expiresAt && now > ent.expiresAt) {
      ent.dead = true;
      continue;
    }

    if (ent.type === "campfire" && ent.cooking && now >= ent.doneAt) {
      ent.cooking = 0;
      spawnDrop(state, "cookedbeef", ent.x, ent.y - 18, { ttl: 240000 });
      emitter.emit("ping", "Carne pronta!");
    }

    if (ent.type === "cow") {
      if (now < (ent.fleeUntil || 0)) {
        const ax = ent.x - player.x;
        const ay = ent.y - player.y;
        const L = Math.hypot(ax, ay) || 1;
        const speed = 120 * dt;
        ent.x = clamp(ent.x + (ax / L) * speed, 24, state.world.w - 24);
        ent.y = clamp(ent.y + (ay / L) * speed, 24, state.world.h - 24);
      } else if (Math.random() < 0.02) {
        ent.x = clamp(ent.x + (Math.random() * 2 - 1) * 30 * dt, 24, state.world.w - 24);
        ent.y = clamp(ent.y + (Math.random() * 2 - 1) * 30 * dt, 24, state.world.h - 24);
      }
    }
  }

  autopickNearby(state, emitter);
  updateFocus(state);
  state.entities = state.entities.filter((ent) => !ent.dead);
}

function movePlayer(state, dt) {
  const { player, world } = state;
  const dir = player.moveDir || { dx: 0, dy: 0 };
  const speed = player.speed || 210;
  const vx = (dir.dx || 0) * speed * dt;
  const vy = (dir.dy || 0) * speed * dt;

  const nextX = clamp(player.x + vx, PLAYER_RADIUS, world.w - PLAYER_RADIUS);
  const nextY = clamp(player.y + vy, PLAYER_RADIUS, world.h - PLAYER_RADIUS);

  if (!collides(state, nextX, player.y)) player.x = nextX;
  if (!collides(state, player.x, nextY)) player.y = nextY;

  if (Math.abs(vx) > Math.abs(vy)) {
    if (vx > 0) player.dir = "right";
    else if (vx < 0) player.dir = "left";
  } else if (Math.abs(vy) > 0.001) {
    player.dir = vy > 0 ? "down" : "up";
  }
}

function bindWorldEvents(state, emitter) {
  if (state.__worldBound) return;
  state.__worldBound = true;

  emitter.on("input:dir", (dir) => {
    const next = dir || { dx: 0, dy: 0 };
    state.player.moveDir = next;
    if (state.input) state.input.dir = next;
  });

  emitter.on("click:left", () => handlePrimaryAction(state, emitter));
  emitter.on("click:right", (payload) => handleSecondaryAction(state, emitter, payload));
  emitter.on("player:dropHandOne", () => dropFromHand(state, emitter));
  emitter.on("inventory:dropOne", ({ id }) => dropFromInventory(state, emitter, id));
  emitter.on("world:drop", ({ id, qty = 1, meta = null }) => {
    spawnDrop(state, id, state.player.x, state.player.y, { qty, meta });
  });
}

export function spawnInitialWorld(state, emitter) {
  ensurePlayerDefaults(state);
  generateWorld(state);
  bindWorldEvents(state, emitter);
}

export function updateWorld(state, dt, emitter) {
  const frameDt = Math.min(dt || 0, 0.05);
  movePlayer(state, frameDt);
  updateEntities(state, frameDt, emitter);
}

export function returnCraftingToInventory(state, emitter) {
  const restored = state.crafting.clear();
  const ids = Object.keys(restored);
  if (!ids.length) return;

  let dropped = false;
  for (const id of ids) {
    const qty = restored[id];
    const before = state.inventory.count(id);
    const success = state.inventory.add(id, qty);
    const after = state.inventory.count(id);
    const inserted = after - before;
    const leftover = qty - inserted;
    if (!success && leftover > 0) {
      spawnDrop(state, id, state.player.x, state.player.y, { qty: leftover });
      dropped = true;
    }
  }

  emitter.emit("craft:changed");
  emitter.emit("inv:changed");
  emitter.emit(dropped ? "toast" : "ping", dropped ? "Inventário cheio — itens dropados" : "Itens devolvidos ao inventário");
}

export { spawnDrop };
