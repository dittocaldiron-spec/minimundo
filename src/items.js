// src/items.js

// Definições de itens (id -> meta)
export const items = {
  // Moeda / materiais
  coin:        { name: "Moeda",          maxStack: 100, tags: ["currency", "noSolid"] },
  wood:        { name: "Madeira",        maxStack: 100, tags: ["material", "noSolid"] },
  stick:       { name: "Graveto",        maxStack: 100, tags: ["material", "noSolid"] },
  rockshard:   { name: "Estilhaço",      maxStack: 100, tags: ["material", "noSolid"] },
  coal:        { name: "Carvão",         maxStack: 100, tags: ["material", "noSolid"] },

  // Alimentos
  beef: {
    name: "Carne",
    maxStack: 100,
    tags: ["food", "noSolid"],
    labels: ["portion<24>", "carb<0>", "protein<14>", "fat<10>"],
  },
  cookedbeef: {
    name: "Carne Cozida",
    maxStack: 100,
    tags: ["food", "noSolid"],
    labels: ["portion<30>", "carb<0>", "protein<18>", "fat<12>"],
  },
  berries: {
    name: "Frutas Silvestres",
    maxStack: 100,
    tags: ["food", "noSolid"],
    labels: ["portion<21>", "carb<18>", "protein<2>", "fat<1>"],
  },
  nuts: {
    name: "Nozes",
    maxStack: 100,
    tags: ["food", "noSolid"],
    labels: ["portion<35>", "carb<8>", "protein<7>", "fat<20>"],
  },

  // Drops de mob
  leather:     { name: "Couro",          maxStack: 100, tags: ["material", "noSolid"] },
  bone:        { name: "Osso",           maxStack: 100, tags: ["material", "noSolid"] },

  // Ferramentas
  axe:         { name: "Machado",        maxStack: 1,   tags: ["tool", "chop"] },
  pickaxe:     { name: "Picareta",       maxStack: 1,   tags: ["tool", "mine"] },
  sword:       { name: "Espada",         maxStack: 1,   tags: ["tool", "weapon"] },

  // Colocáveis (placeables)
  sapling:     { name: "Muda",           maxStack: 100, tags: ["place", "solid", "plant"],    // vira árvore no mundo
                 place: { radius: 22 } },
  chest:       { name: "Baú",            maxStack: 1,   tags: ["place", "solid", "container"], // tem inv próprio (meta)
                 place: { radius: 18 } },
  campfire:    { name: "Fogueira",       maxStack: 1,   tags: ["place", "solid", "campfire"],  // cozinha carne
                 place: { radius: 16 } },
};

// -----------------------------------------
// Helpers utilitários
// -----------------------------------------

export function getItem(id) {
  return items[id] || null;
}

export function getName(id) {
  return (items[id] && items[id].name) || id;
}

export function getMaxStack(id) {
  return (items[id] && items[id].maxStack) || 1;
}

export function hasTag(id, tag) {
  const it = items[id];
  return !!(it && it.tags && it.tags.includes(tag));
}

export function isStackable(id) {
  return getMaxStack(id) > 1;
}

export function isPlaceable(id) {
  return hasTag(id, "place");
}

export function placeSpec(id) {
  const it = items[id];
  // padrão: sólido com raio 14 se não especificado
  return it && it.place
    ? { radius: it.place.radius ?? 14, solid: hasTag(id, "solid") }
    : { radius: 14, solid: hasTag(id, "solid") };
}
