// src/state.js
import { getMaxStack } from "./items.js";

function createSlots(size) {
  return Array.from({ length: size }, () => null);
}

export function makeInventory(size = 24) {
  const slots = createSlots(size);

  return {
    slots,
    size,

    add(id, qty = 1, meta = null) {
      if (!id || qty <= 0) return true;
      const maxStack = getMaxStack(id);
      let remaining = qty;

      // Itens com metadata ou não empilháveis ocupam slots individuais
      if (meta || maxStack <= 1) {
        for (let i = 0; i < remaining; i++) {
          const idx = this.firstFreeSlot();
          if (idx === -1) return false;
          this.slots[idx] = { id, qty: 1, ...(meta ? { meta } : {}) };
        }
        return true;
      }

      // Primeiro, tenta empilhar em slots existentes
      for (let i = 0; i < this.slots.length && remaining > 0; i++) {
        const slot = this.slots[i];
        if (!slot || slot.id !== id || slot.meta) continue;
        const space = maxStack - slot.qty;
        if (space <= 0) continue;
        const add = Math.min(space, remaining);
        slot.qty += add;
        remaining -= add;
      }

      // Depois, usa slots vazios
      for (let i = 0; i < this.slots.length && remaining > 0; i++) {
        if (this.slots[i]) continue;
        const add = Math.min(maxStack, remaining);
        this.slots[i] = { id, qty: add };
        remaining -= add;
      }

      return remaining === 0;
    },

    remove(id, qty = 1) {
      if (!id || qty <= 0) return true;
      let remaining = qty;
      for (let i = 0; i < this.slots.length && remaining > 0; i++) {
        const slot = this.slots[i];
        if (!slot || slot.id !== id) continue;
        if (slot.meta) {
          this.slots[i] = null;
          remaining -= 1;
          continue;
        }
        const take = Math.min(slot.qty, remaining);
        slot.qty -= take;
        remaining -= take;
        if (slot.qty <= 0) this.slots[i] = null;
      }
      return remaining === 0;
    },

    takeOne(id) {
      if (!id) return null;
      for (let i = 0; i < this.slots.length; i++) {
        const slot = this.slots[i];
        if (!slot || slot.id !== id) continue;
        if (slot.meta) {
          this.slots[i] = null;
          return { id, qty: 1, meta: slot.meta };
        }
        slot.qty -= 1;
        const item = { id, qty: 1 };
        if (slot.qty <= 0) this.slots[i] = null;
        return item;
      }
      return null;
    },

    count(id) {
      if (!id) return 0;
      return this.slots.reduce((sum, slot) => {
        if (!slot || slot.id !== id) return sum;
        return sum + (slot.meta ? 1 : slot.qty);
      }, 0);
    },

    has(id, qty = 1) {
      return this.count(id) >= qty;
    },

    firstFreeSlot() {
      return this.slots.findIndex((slot) => !slot);
    },

    isFull() {
      return this.firstFreeSlot() === -1;
    },
  };
}

export function makeCrafting() {
  const slots = {};
  return {
    slots,
    deposit(id, qty = 1) {
      if (!id || qty <= 0) return 0;
      slots[id] = (slots[id] || 0) + qty;
      return slots[id];
    },
    withdraw(id, qty = 1) {
      if (!id || qty <= 0 || !slots[id]) return 0;
      const take = Math.min(qty, slots[id]);
      slots[id] -= take;
      if (slots[id] <= 0) delete slots[id];
      return take;
    },
    clear() {
      const snapshot = { ...slots };
      Object.keys(slots).forEach((key) => delete slots[key]);
      return snapshot;
    },
  };
}

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
      moveDir: { dx: 0, dy: 0 },
      focusId: null,
    },
    entities: [],
    inventory: makeInventory(20),
    wallet: makeInventory(8),
    crafting: makeCrafting(),
    input: {
      w: false,
      a: false,
      s: false,
      d: false,
      pointer: { sx: 0, sy: 0 },
      dir: { dx: 0, dy: 0 },
    },
  };
}
