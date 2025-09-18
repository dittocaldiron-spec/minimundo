// src/world.js
import { makeInventory } from "./state.js";
import {
  getName,
  hasTag,
  isPlaceable,
  getItem,
} from "./items.js";
import {
  Tree,
  Rock,
  Campfire,
  Chest,
  BerryBush,
  NutTree,
  DisplayProp,
  Cow,
  ItemDrop,
  Coin,
  HitParticles,
} from "./entities/index.js";
import {
  populateNaturalSpawns,
  updateNaturalSpawns,
} from "./systems/spawn.js";
import {
  initHunger,
  applyActionGroup,
  getHungerState,
  hasEffect,
  tick as hungerTick,
  getSprintMultiplier,
  applyFood,
} from "./systems/hunger.js";
import { STAMINA } from "./config/hunger.config.js";

const TILE = 32;
const PLAYER_RADIUS = 14;
const INTERACT_RANGE = 56;
const SLOW_MULTIPLIER = 0.7;
const SPRINT_MULTIPLIER = 1.55;
const COW_CHAIN_RADIUS = 220;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const randBetween = (min, max) => min + Math.random() * (max - min);

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
  player.moveDir = player.moveDir || { dx: 0, dy: 0, sprint: false };
  player.focusId = null;
}

function clampPosition(state, x, y) {
  return {
    x: clamp(x, PLAYER_RADIUS, state.world.w - PLAYER_RADIUS),
    y: clamp(y, PLAYER_RADIUS, state.world.h - PLAYER_RADIUS),
  };
}

function addEntity(state, entity) {
  if (!entity) return null;
  state.entities.push(entity);
  return entity;
}

function spawnDrop(state, itemId, options = {}) {
  const {
    qty = 1,
    meta = null,
    ttl = 300000,
    x = state.player.x,
    y = state.player.y,
  } = options;
  const drop = new ItemDrop({ itemId, qty, meta, ttl, x, y });
  addEntity(state, drop);
  return drop;
}

function spawnEffect(state, type, options = {}) {
  if (type === "hit") {
    const duration = 0.3 + Math.random() * 0.3;
    addEntity(state, new HitParticles({ ...options, duration }));
  }
}

function spawnCoin(state, x, y) {
  addEntity(state, new Coin({ x, y }));
}

function spawnCampfire(state, x, y) {
  addEntity(state, new Campfire({ x, y }));
}

function spawnChest(state, x, y, inventory) {
  addEntity(state, new Chest({ x, y, inventory }));
}

function spawnTree(state, x, y) {
  addEntity(state, new Tree({ x, y }));
}

function spawnRock(state, x, y) {
  addEntity(state, new Rock({ x, y }));
}

function spawnCow(state, x, y) {
  addEntity(state, new Cow({ x, y }));
}

function isBlocking(entity) {
  return !!entity && !entity.dead && entity.tangible;
}

function collides(state, targetX, targetY) {
  for (const entity of state.entities) {
    if (!isBlocking(entity)) continue;
    const dist = Math.hypot(entity.x - targetX, entity.y - targetY);
    if (dist < (entity.radius || 16) + PLAYER_RADIUS) return true;
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

function isPickup(entity) {
  return entity instanceof ItemDrop || entity instanceof Coin;
}

function getInteractionTarget(state) {
  return findNearest(
    state,
    (ent) =>
      ent instanceof ItemDrop ||
      ent instanceof Coin ||
      ent instanceof Tree ||
      ent instanceof Rock ||
      ent instanceof Cow ||
      ent instanceof Chest ||
      ent instanceof Campfire ||
      ent instanceof BerryBush ||
      ent instanceof NutTree ||
      ent instanceof DisplayProp
  );
}

function pickupItem(state, drop, emitter) {
  if (drop.dead) return;
  const qty = drop.qty || 1;
  const added = state.inventory.add(drop.itemId, qty, drop.meta || null);
  if (!added) {
    emitter.emit("toast", "Inventário cheio!");
    return;
  }
  drop.dead = true;
  emitter.emit("inv:changed");
  emitter.emit("ping", `Pegou ${getName(drop.itemId)}${qty > 1 ? ` x${qty}` : ""}`);
}

function pickupCoin(state, coin, emitter) {
  if (coin.dead) return;
  const ok = state.wallet.add("coin", 1);
  if (!ok) {
    emitter.emit("toast", "Carteira cheia!");
    return;
  }
  coin.dead = true;
  emitter.emit("wallet:changed");
  emitter.emit("ping", "Moeda +1");
}

function pickupChest(state, chest, emitter) {
  const ok = state.inventory.add("chest", 1, { inv: chest.inventory });
  if (!ok) {
    emitter.emit("toast", "Sem espaço para o baú");
    return;
  }
  chest.dead = true;
  emitter.emit("chest:close");
  emitter.emit("inv:changed");
  emitter.emit("ping", "Baú recolhido");
}

function damageMultiplier() {
  const effects = getHungerState().effects;
  let mult = 1;
  if (effects.has("strength")) mult *= 1.25;
  if (effects.has("weakness")) mult *= 0.7;
  return mult;
}

function handleTreeInteraction(state, tree, emitter, toolId) {
  applyActionGroup("break", 1);
  tree.interact({
    toolId,
    spawnDrop: (id, opts) => spawnDrop(state, id, opts),
    emitter,
  });
}

function handleRockInteraction(state, rock, emitter, toolId) {
  applyActionGroup("break", 1);
  rock.interact({
    toolId,
    spawnDrop: (id, opts) => spawnDrop(state, id, opts),
    emitter,
    damageMultiplier: damageMultiplier(),
  });
}

function chainFear(state, source, threat) {
  for (const ent of state.entities) {
    if (ent === source || ent.dead) continue;
    if (!(ent instanceof Cow)) continue;
    const dist = Math.hypot(ent.x - source.x, ent.y - source.y);
    if (dist <= COW_CHAIN_RADIUS) {
      ent.triggerFlee(threat);
    }
  }
}

function attackCow(state, cow, emitter, toolId) {
  applyActionGroup("attack", 1);
  const base = toolId && hasTag(toolId, "weapon") ? 2 : 1;
  const dmg = Math.max(1, Math.round(base * damageMultiplier()));
  cow.takeDamage(dmg, { x: state.player.x, y: state.player.y }, {
    emitter,
    spawnDrop: (id, opts) => spawnDrop(state, id, opts),
    spawnEffect: (type, opts) => spawnEffect(state, type, opts),
    player: state.player,
    chainFear: (src, threat) => chainFear(state, src, threat),
  });
  if (!cow.dead) {
    emitter.emit("ping", "A vaca foge!");
  }
}

function handleCampfireInteraction(campfire, emitter) {
  if (!campfire.isCooking()) {
    emitter.emit("toast", "Use o botão direito com carne crua equipada");
  }
}

function placeFromHand(state, emitter, worldX, worldY) {
  const id = state.player.hand;
  if (!id) return;
  if (!isPlaceable(id)) {
    emitter.emit("toast", "Este item não pode ser colocado");
    return;
  }

  const snapped = snapToTile(worldX, worldY);
  const { x, y } = clampPosition(state, snapped.x, snapped.y);
  if (collides(state, x, y)) {
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

  let placed = null;
  if (id === "sapling") {
    placed = new Tree({ x, y, hp: 5 });
  } else if (id === "campfire") {
    placed = new Campfire({ x, y });
  } else if (id === "chest") {
    placed = new Chest({ x, y, inventory: item.meta?.inv || makeInventory(18) });
  } else {
    placed = new DisplayProp({ x, y, itemId: id });
  }

  if (placed) {
    addEntity(state, placed);
    emitter.emit("ping", `${getName(id)} colocado`);
  }

  if (state.inventory.count(id) <= 0) {
    state.player.hand = null;
  }
  emitter.emit("inv:changed");
}

function mouseWorldFromScreen(state, sx, sy) {
  const canvas = document.getElementById("game");
  if (!canvas) return { x: state.player.x, y: state.player.y };
  const camX = clamp(
    state.player.x - canvas.width / 2,
    0,
    state.world.w - canvas.width
  );
  const camY = clamp(
    state.player.y - canvas.height / 2,
    0,
    state.world.h - canvas.height
  );
  return { x: camX + sx, y: camY + sy };
}

function consumeFromHand(state, emitter) {
  const id = state.player.hand;
  if (!id) return false;
  const item = getItem(id);
  if (!item || !(item.tags || []).includes("food")) return false;
  const taken = state.inventory.takeOne(id);
  if (!taken) return false;
  emitter.emit("player:consume", { foodId: id });
  applyFood(id);
  emitter.emit("ping", `${getName(id)} consumido`);
  if (state.inventory.count(id) <= 0) {
    state.player.hand = null;
  }
  emitter.emit("inv:changed");
  return true;
}

function cookOnCampfire(state, emitter, campfire) {
  if (!campfire.canCook("beef")) {
    emitter.emit("toast", "Nada para cozinhar");
    return;
  }
  if (campfire.isCooking()) {
    emitter.emit("toast", "A fogueira já está cozinhando");
    return;
  }
  const ok = state.inventory.remove("beef", 1);
  if (!ok) {
    emitter.emit("toast", "Precisa de 1 carne crua");
    return;
  }
  if (state.inventory.count("beef") <= 0 && state.player.hand === "beef") {
    state.player.hand = null;
  }
  campfire.startCooking("beef", {
    emitter,
  });
  emitter.emit("inv:changed");
}

function dropFromHand(state, emitter) {
  const id = state.player.hand;
  if (!id) return;
  const item = state.inventory.takeOne(id);
  if (!item) return;
  spawnDrop(state, id, { x: state.player.x, y: state.player.y, meta: item.meta || null });
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
  spawnDrop(state, id, { x: state.player.x, y: state.player.y, meta: item.meta || null });
  emitter.emit("ping", `${getName(id)} dropado`);
  if (state.player.hand === id && state.inventory.count(id) <= 0) state.player.hand = null;
  emitter.emit("inv:changed");
}

function handlePrimaryAction(state, emitter) {
  const { entity, distance } = getInteractionTarget(state);
  if (!entity || distance > INTERACT_RANGE) return;
  if (entity instanceof ItemDrop) return pickupItem(state, entity, emitter);
  if (entity instanceof Coin) return pickupCoin(state, entity, emitter);
  if (entity instanceof Chest) return pickupChest(state, entity, emitter);
  if (entity instanceof Tree) return handleTreeInteraction(state, entity, emitter, state.player.hand);
  if (entity instanceof Rock) return handleRockInteraction(state, entity, emitter, state.player.hand);
  if (entity instanceof Cow) return attackCow(state, entity, emitter, state.player.hand);
  if (entity instanceof Campfire) {
    const toolId = state.player.hand;
    if (toolId && (hasTag(toolId, "chop") || hasTag(toolId, "mine") || hasTag(toolId, "weapon"))) {
      applyActionGroup("break", 1);
      const broken = entity.break({
        spawnDrop: (id, opts) => spawnDrop(state, id, opts),
        emitter,
      });
      if (broken) emitter.emit("ping", "Fogueira desmontada");
      return;
    }
    return handleCampfireInteraction(entity, emitter);
  }
  if (entity instanceof BerryBush || entity instanceof NutTree) {
    entity.interact({
      toolId: state.player.hand,
      spawnDrop: (id, opts) => spawnDrop(state, id, opts),
      emitter,
    });
  }
}

function handleSecondaryAction(state, emitter, payload) {
  const chestNear = findNearest(state, (ent) => ent instanceof Chest);
  if (chestNear.entity && chestNear.distance <= INTERACT_RANGE) {
    emitter.emit("chest:open", chestNear.entity);
    return;
  }

  const handId = state.player.hand;
  if (handId === "beef") {
    const fire = findNearest(state, (ent) => ent instanceof Campfire);
    if (fire.entity && fire.distance <= INTERACT_RANGE) {
      cookOnCampfire(state, emitter, fire.entity);
      return;
    }
  }

  if (handId) {
    const consumed = consumeFromHand(state, emitter);
    if (consumed) return;
  }

  if (!handId) return;
  const { sx = 0, sy = 0 } = payload || {};
  const worldPos = mouseWorldFromScreen(state, sx, sy);
  placeFromHand(state, emitter, worldPos.x, worldPos.y);
}

function updateFocus(state) {
  const { entity, distance } = getInteractionTarget(state);
  state.player.focusId = entity && distance <= INTERACT_RANGE ? entity.id : null;
}

function countEntities(state, kind) {
  return state.entities.filter((ent) => !ent.dead && ent.kind === kind).length;
}

function findSpawnSpot(state, minSpacing = 96) {
  for (let i = 0; i < 40; i++) {
    const x = randBetween(120, state.world.w - 120);
    const y = randBetween(120, state.world.h - 120);
    let ok = true;
    for (const ent of state.entities) {
      if (ent.dead) continue;
      const radius = (ent.radius || 16) + minSpacing;
      if (Math.hypot(ent.x - x, ent.y - y) < radius) {
        ok = false;
        break;
      }
    }
    if (ok) return snapToTile(x, y);
  }
  return null;
}

function updateEntities(state, dt, emitter) {
  const context = {
    clampPosition: (x, y) => clampPosition(state, x, y),
    spawnDrop: (id, opts) => spawnDrop(state, id, opts),
    spawnEffect: (type, opts) => spawnEffect(state, type, opts),
    emitter,
    player: state.player,
    chainFear: (src, threat) => chainFear(state, src, threat),
  };

  for (const ent of state.entities) {
    if (ent.dead || typeof ent.update !== "function") continue;
    ent.update(dt, context);
  }

  state.entities = state.entities.filter((ent) => !ent.dead);
}

function applyMovementCosts(state, moved, running, dt) {
  if (!moved) return;
  if (running) {
    applyActionGroup("run", dt);
  } else {
    applyActionGroup("walk", dt);
  }
}

function movePlayer(state, dt) {
  const { player } = state;
  const dir = player.moveDir || { dx: 0, dy: 0, sprint: false };
  const magnitude = Math.hypot(dir.dx || 0, dir.dy || 0);
  if (magnitude <= 0.001) return { moved: false, running: false };

  let speed = player.speed || 210;
  if (hasEffect("slow")) {
    speed *= SLOW_MULTIPLIER;
  }

  let running = false;
  const hunger = getHungerState();
  if ((dir.sprint || state.input?.dir?.sprint) && hunger.stamina >= STAMINA.minToStartSprint) {
    running = true;
    speed *= SPRINT_MULTIPLIER * getSprintMultiplier();
  }

  const vx = (dir.dx || 0) * speed * dt;
  const vy = (dir.dy || 0) * speed * dt;

  let nextX = player.x + vx;
  let nextY = player.y + vy;
  const clamped = clampPosition(state, nextX, nextY);
  nextX = clamped.x;
  nextY = clamped.y;

  if (!collides(state, nextX, player.y)) player.x = nextX;
  if (!collides(state, player.x, nextY)) player.y = nextY;

  if (Math.abs(vx) > Math.abs(vy)) {
    if (vx > 0) player.dir = "right";
    else if (vx < 0) player.dir = "left";
  } else if (Math.abs(vy) > 0.001) {
    player.dir = vy > 0 ? "down" : "up";
  }

  return { moved: true, running };
}

function populateWorld(state) {
  state.entities = [];
  const { world } = state;

  for (let i = 0; i < 18; i++) {
    const pos = snapToTile(randBetween(160, world.w - 160), randBetween(160, world.h - 160));
    spawnCoin(state, pos.x, pos.y);
  }

  for (let i = 0; i < 28; i++) {
    const pos = snapToTile(randBetween(120, world.w - 120), randBetween(120, world.h - 120));
    spawnTree(state, pos.x, pos.y);
  }

  for (let i = 0; i < 20; i++) {
    const pos = snapToTile(randBetween(220, world.w - 220), randBetween(220, world.h - 220));
    spawnRock(state, pos.x, pos.y);
  }

  for (let i = 0; i < 6; i++) {
    const pos = snapToTile(randBetween(180, world.w - 180), randBetween(180, world.h - 180));
    spawnCow(state, pos.x, pos.y);
  }

  const campfireSpot = snapToTile(world.w / 2 + 120, world.h / 2 + 100);
  spawnCampfire(state, campfireSpot.x, campfireSpot.y);

  const chestSpot = snapToTile(world.w / 2 + 200, world.h / 2 - 60);
  const chestInventory = makeInventory(18);
  chestInventory.add("wood", 10);
  chestInventory.add("rockshard", 6);
  chestInventory.add("coin", 12);
  spawnChest(state, chestSpot.x, chestSpot.y, chestInventory);

  const axeSpot = snapToTile(world.w / 2 - 100, world.h / 2);
  spawnDrop(state, "axe", { x: axeSpot.x, y: axeSpot.y, ttl: 600000 });

  for (let i = 0; i < 3; i++) {
    const pos = snapToTile(world.w / 2 - 80 + i * 22, world.h / 2 + 80);
    spawnDrop(state, "sapling", { x: pos.x, y: pos.y, ttl: 600000 });
  }

  populateNaturalSpawns(state, {
    spawn: (entity) => addEntity(state, entity),
    count: (kind) => countEntities(state, kind),
    findSpot: (spacing) => findSpawnSpot(state, spacing),
  });
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
    spawnDrop(state, id, { qty, meta, x: state.player.x, y: state.player.y });
  });
}

export function spawnInitialWorld(state, emitter) {
  ensurePlayerDefaults(state);
  initHunger(emitter);
  populateWorld(state);
  bindWorldEvents(state, emitter);
}

export function updateWorld(state, dt, emitter) {
  const frameDt = Math.min(dt || 0, 0.05);
  applyActionGroup("time:tick", frameDt);
  const movement = movePlayer(state, frameDt);
  applyMovementCosts(state, movement.moved, movement.running, frameDt);
  updateEntities(state, frameDt, emitter);
  updateFocus(state);
  updateNaturalSpawns(state, frameDt * 1000, {
    spawn: (entity) => addEntity(state, entity),
    count: (kind) => countEntities(state, kind),
    findSpot: (spacing) => findSpawnSpot(state, spacing),
  });
  hungerTick(frameDt * 1000);
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
      spawnDrop(state, id, { qty: leftover, x: state.player.x, y: state.player.y });
      dropped = true;
    }
  }

  emitter.emit("craft:changed");
  emitter.emit("inv:changed");
  emitter.emit(
    dropped ? "toast" : "ping",
    dropped ? "Inventário cheio — itens dropados" : "Itens devolvidos ao inventário"
  );
}

export { spawnDrop };
