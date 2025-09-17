// src/state.js
import _ from "lodash";

// Modelo de inventário: slots fixos, operações básicas
function makeInventory(size = 24) {
  return {
    slots: new Array(size).fill(null),

    add(id, qty = 1) {
      let left = qty;
      for (let i = 0; i < this.slots.length && left > 0; i++) {
        const s = this.slots[i];
        if (s && s.id === id && !s.meta) {
          s.qty += 1;
          left--;
        }
      }
      for (let i = 0; i < this.slots.length && left > 0; i++) {
        if (!this.slots[i]) {
          this.slots[i] = { id, qty: 1 };
          left--;
        }
      }
      return left === 0;
    },

    remove(id, qty = 1) {
      let left = qty;
      for (let i = 0; i < this.slots.length && left > 0; i++) {
        const s = this.slots[i];
        if (!s || s.id !== id) continue;
        const take = Math.min(s.qty, left);
        s.qty -= take;
        left -= take;
        if (s.qty <= 0) this.slots[i] = null;
      }
      return left === 0;
    },

    count(id) {
      return this.slots.reduce(
        (sum, s) => sum + (s && s.id === id ? s.qty : 0),
        0
      );
    },

    firstFreeSlot() {
      return this.slots.findIndex((s) => !s);
    },
  };
}

// Crafting grid temporária
function makeCrafting() {
  return {
    slots: {},
    deposit(id) {
      this.slots[id] = (this.slots[id] || 0) + 1;
    },
    withdraw(id) {
      if (this.slots[id]) {
        this.slots[id]--;
        if (this.slots[id] <= 0) delete this.slots[id];
      }
    },
    clear() {
      const back = { ...this.slots };
      this.slots = {};
      return back;
    },
  };
}

// Estado inicial do jogo
export function initState() {
  return {
    world: { w: 2400, h: 1800, tile: 32 },
    player: {
      x: 1200,
      y: 900,
      w: 26,
      h: 32,
      dir: "down",
      speed: 210,
      hand: null,
    },
    entities: [],

    // inventário principal (24 slots)
    inventory: makeInventory(16),

    // carteira (8 slots)
    wallet: makeInventory(6),

    // crafting grid
    crafting: makeCrafting(),
  };
}
