// interactions.js
import emitter from "./events.js";
import { items, hasTag } from "./items.js"; // supondo que tenha separado definição dos itens
import { dropSpawn } from "./world.js";     // função util para spawnar drops

// ==== Funções de interação ====

/**
 * Quebrar árvore
 */
export function chopTree(player, treeEntity) {
  if (player.hand && hasTag(player.hand, "chop")) {
    treeEntity.hp = Math.max(0, (treeEntity.hp || 5) - 1);
    emitter.emit("log", `Machado usado na árvore, HP = ${treeEntity.hp}`);
    if (treeEntity.hp <= 0) {
      for (let i = 0; i < 10; i++) dropSpawn("wood", treeEntity.x, treeEntity.y);
      const saplings = Math.random() < 0.5 ? 1 : 3;
      for (let i = 0; i < saplings; i++) dropSpawn("sapling", treeEntity.x, treeEntity.y);
      const sticks = Math.floor(Math.random() * 3);
      for (let i = 0; i < sticks; i++) dropSpawn("stick", treeEntity.x, treeEntity.y);
      treeEntity.dead = true;
    }
  } else {
    treeEntity.taps = (treeEntity.taps || 0) + 1;
    if (treeEntity.taps % 10 === 0) {
      dropSpawn("stick", treeEntity.x, treeEntity.y);
      emitter.emit("log", "Graveto dropado!");
    }
  }
}

/**
 * Quebrar pedra
 */
export function mineRock(player, rockEntity) {
  const dmg = (player.hand && hasTag(player.hand, "mine")) ? 5 : 2;
  rockEntity.hp = Math.max(0, rockEntity.hp - dmg);
  emitter.emit("log", `Rocha HP = ${rockEntity.hp}`);
  if (rockEntity.hp <= 0) {
    dropSpawn("rockshard", rockEntity.x, rockEntity.y);
    if (Math.random() < 0.5) dropSpawn("coal", rockEntity.x, rockEntity.y); // 50%
    rockEntity.dead = true;
  }
}

/**
 * Atacar vaca
 */
export function hitCow(player, cowEntity) {
  cowEntity.hp = Math.max(0, (cowEntity.hp || 3) - 1);
  cowEntity.flee = true;
  cowEntity.until = performance.now() + 6000;
  if (cowEntity.hp <= 0) {
    for (let i = 0; i < 5; i++) dropSpawn("beef", cowEntity.x, cowEntity.y);
    for (let i = 0; i < 2; i++) dropSpawn("leather", cowEntity.x, cowEntity.y);
    for (let i = 0; i < 3; i++) dropSpawn("bone", cowEntity.x, cowEntity.y);
    cowEntity.dead = true;
    emitter.emit("log", "Vaca abatida");
  }
}

/**
 * Cozinhar carne em fogueira
 */
export function cookAtCampfire(player, campfireEntity) {
  if (campfireEntity.cooking) {
    emitter.emit("log", "Fogueira já está cozinhando");
    return;
  }
  // consumir carne crua do inventário
  if (!player.inv.remove("beef", 1)) {
    emitter.emit("log", "Precisa de 1 carne crua");
    return;
  }
  campfireEntity.cooking = true;
  campfireEntity.done = performance.now() + 30000; // 30s
  emitter.emit("log", "Carne cozinhando (30s)...");
}

/**
 * Coleta de drops (item ou moeda no chão)
 */
export function pickupDrop(player, entity, inv, wallet) {
  if (entity.type === "item") {
    if (inv.add(entity.itemId, 1)) {
      entity.dead = true;
      emitter.emit("log", `Pegou ${items[entity.itemId].name}`);
    } else {
      emitter.emit("log", "Inventário cheio!");
    }
  }
  if (entity.type === "coin") {
    if (wallet.add("coin", 1)) {
      entity.dead = true;
      emitter.emit("log", "Moeda +1");
    } else {
      emitter.emit("log", "Carteira cheia!");
    }
  }
}

/**
 * Interação com baú
 */
export function openChest(chestEntity) {
  emitter.emit("chest:open", chestEntity);
}
export function closeChest() {
  emitter.emit("chest:close");
}
