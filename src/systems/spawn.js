import { BerryBush } from "../entities/props/berry-bush.js";
import { NutTree } from "../entities/props/nut-tree.js";

const SPAWN_DEFINITIONS = [
  {
    id: "prop.nut-tree",
    target: 14,
    respawnMs: 7 * 60 * 1000,
    minSpacing: 120,
    create: (pos) => new NutTree(pos),
  },
  {
    id: "prop.berry-bush",
    target: 18,
    respawnMs: 8 * 60 * 1000,
    minSpacing: 100,
    create: (pos) => new BerryBush(pos),
  },
];

function ensureSpawnState(state) {
  if (!state.spawnSystem) {
    state.spawnSystem = SPAWN_DEFINITIONS.map((def) => ({
      def,
      timer: def.respawnMs,
    }));
  }
  return state.spawnSystem;
}

export function populateNaturalSpawns(state, helpers) {
  const entries = ensureSpawnState(state);
  for (const entry of entries) {
    const { def } = entry;
    let attempts = 0;
    while (helpers.count(def.id) < def.target && attempts < def.target * 5) {
      const pos = helpers.findSpot(def.minSpacing);
      if (!pos) break;
      helpers.spawn(def.create(pos));
      attempts += 1;
    }
  }
}

export function updateNaturalSpawns(state, dtMs, helpers) {
  const entries = ensureSpawnState(state);
  const dt = dtMs;
  for (const entry of entries) {
    const { def } = entry;
    if (helpers.count(def.id) >= def.target) {
      entry.timer = def.respawnMs;
      continue;
    }
    entry.timer -= dt;
    if (entry.timer > 0) continue;
    const pos = helpers.findSpot(def.minSpacing);
    if (pos) {
      helpers.spawn(def.create(pos));
    }
    entry.timer = def.respawnMs;
  }
}
