import { getItem } from "../items.js";
import { ACTION_COSTS } from "../config/action-costs.js";
import { DECAY, MACRO_EFFECTS, STAMINA, HUNGER_CONSTANTS } from "../config/hunger.config.js";

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const EPSILON = 0.0001;
const CALORIES_TO_HUNGER = 0.5;
const MACRO_KEYS = ["carbs", "protein", "fat"];
const MACRO_LABEL_ALIASES = {
  carb: "carbs",
  carbs: "carbs",
  protein: "protein",
  fat: "fat",
};
const MACRO_CALORIES = { carbs: 4, protein: 4, fat: 9 };

function roundToHundredth(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

function parseLabeledValue(labelWithValue) {
  if (typeof labelWithValue !== "string") return null;
  const match = labelWithValue.match(/^([^<]+)<([^>]+)>$/);
  if (!match) return null;
  const [, label, valueStr] = match;
  const value = Number.parseFloat(valueStr);
  if (!Number.isFinite(value)) return null;
  return { label: label.trim(), value };
}

const state = {
  macros: { carbs: 60, protein: 45, fat: 30 },
  hunger: 80,
  stamina: HUNGER_CONSTANTS.staminaMax,
  effects: new Set(),
};

let busRef = null;
let lastSnapshot = null;
let blurTimerMs = 0;
let blurVisible = false;

const activity = {
  running: false,
  moving: false,
  acted: false,
};

function cloneState() {
  return {
    macros: { ...state.macros },
    stamina: state.stamina,
    hunger: state.hunger,
    effects: new Set(state.effects),
  };
}

function emitStateChanged(force = false) {
  if (!busRef) return;
  const snapshot = cloneState();
  if (!force && lastSnapshot) {
    const prev = lastSnapshot;
    const diff =
      Math.abs(prev.hunger - snapshot.hunger) > EPSILON ||
      Math.abs(prev.stamina - snapshot.stamina) > EPSILON ||
      Math.abs(prev.macros.carbs - snapshot.macros.carbs) > EPSILON ||
      Math.abs(prev.macros.protein - snapshot.macros.protein) > EPSILON ||
      Math.abs(prev.macros.fat - snapshot.macros.fat) > EPSILON;
    if (!diff) return;
  }
  lastSnapshot = snapshot;
  busRef.emit("hunger:changed", { state: snapshot });
}

function emitEffectsChanged(prevEffects) {
  if (!busRef) return;
  const before = prevEffects ? [...prevEffects].sort().join(",") : "";
  const after = [...state.effects].sort().join(",");
  if (before === after) return;
  busRef.emit("effects:changed", { effects: new Set(state.effects) });
}

function computeFoodEffect(item) {
  if (!item) {
    return { macros: { carbs: 0, protein: 0, fat: 0 }, hunger: 0 };
  }

  const labelStrings = [];
  if (Array.isArray(item.labels)) {
    labelStrings.push(...item.labels);
  }
  if (Array.isArray(item.tags)) {
    for (const tag of item.tags) {
      if (typeof tag === "string" && tag.includes("<")) {
        labelStrings.push(tag);
      }
    }
  }
  if (!labelStrings.length) {
    return { macros: { carbs: 0, protein: 0, fat: 0 }, hunger: 0 };
  }

  const weights = { carbs: 0, protein: 0, fat: 0 };
  let portion = 0;
  for (const label of labelStrings) {
    const parsed = parseLabeledValue(label);
    if (!parsed) continue;
    const key = parsed.label.trim().toLowerCase();
    if (key === "portion") {
      if (parsed.value > 0) {
        portion += parsed.value;
      }
      continue;
    }
    const macroKey = MACRO_LABEL_ALIASES[key];
    if (macroKey && parsed.value > 0) {
      weights[macroKey] += parsed.value;
    }
  }

  portion = roundToHundredth(Math.max(0, portion));
  const totalWeight = MACRO_KEYS.reduce(
    (sum, key) => sum + Math.max(0, weights[key] || 0),
    0
  );
  if (portion <= 0 || totalWeight <= 0) {
    return { macros: { carbs: 0, protein: 0, fat: 0 }, hunger: 0 };
  }

  const macros = { carbs: 0, protein: 0, fat: 0 };
  const positiveEntries = MACRO_KEYS.filter((key) => (weights[key] || 0) > 0).map(
    (key) => ({ key, weight: weights[key] })
  );

  let remaining = portion;
  positiveEntries.forEach((entry, index) => {
    const { key, weight } = entry;
    if (index === positiveEntries.length - 1) {
      const value = roundToHundredth(Math.max(0, remaining));
      macros[key] = value;
      remaining = roundToHundredth(Math.max(0, remaining - value));
      return;
    }
    const raw = (portion * weight) / totalWeight;
    let value = roundToHundredth(raw);
    if (value > remaining) {
      value = roundToHundredth(remaining);
    }
    macros[key] = value;
    remaining = roundToHundredth(Math.max(0, remaining - value));
  });

  const calories = MACRO_KEYS.reduce(
    (sum, key) => sum + macros[key] * (MACRO_CALORIES[key] || 0),
    0
  );
  const hunger = roundToHundredth(calories * CALORIES_TO_HUNGER);

  return { macros, hunger };
}

function getMacroPercentage(macro) {
  return clamp(state.macros[macro] || 0, 0, Infinity);
}

function computeSprintMultiplier() {
  const carbs = getMacroPercentage("carbs");
  const [goodMin, goodMax] = MACRO_EFFECTS.carbs.good;
  if (carbs < goodMin || carbs > goodMax) return 1;
  const span = goodMax - goodMin || 1;
  const ratio = clamp((carbs - goodMin) / span, 0, 1);
  const bonus = (MACRO_EFFECTS.carbs.sprintBonusCap - 1) * ratio;
  return 1 + bonus;
}

function recalcEffects() {
  const prev = new Set(state.effects);
  state.effects.clear();

  const carbs = getMacroPercentage("carbs");
  const protein = getMacroPercentage("protein");
  const fat = getMacroPercentage("fat");

  if (carbs < MACRO_EFFECTS.carbs.slowBelow) {
    state.effects.add("slow");
    if (carbs < MACRO_EFFECTS.carbs.blurBelow) {
      state.effects.add("blur");
    }
  } else if (carbs < MACRO_EFFECTS.carbs.blurBelow) {
    state.effects.add("blur");
  }

  if (protein < MACRO_EFFECTS.protein.weakBelow) {
    state.effects.add("weakness");
    if (protein < MACRO_EFFECTS.protein.blurBelow) {
      state.effects.add("blur");
    }
  } else if (
    protein >= MACRO_EFFECTS.protein.good[0] &&
    protein <= MACRO_EFFECTS.protein.good[1] &&
    MACRO_EFFECTS.protein.strengthInGood
  ) {
    state.effects.add("strength");
  }

  if (fat > MACRO_EFFECTS.fat.slowAbove) {
    state.effects.add("slow");
  }
  if (
    fat >= MACRO_EFFECTS.fat.saturationRange[0] &&
    fat <= MACRO_EFFECTS.fat.saturationRange[1]
  ) {
    state.effects.add("saturation");
  }

  const starving = shouldStarve();
  if (starving) {
    state.effects.add("starving");
  }

  emitEffectsChanged(prev);
}

function shouldStarve() {
  const fat = getMacroPercentage("fat");
  if (fat > MACRO_EFFECTS.fat.starvingGuardAbove) return false;
  return (
    getMacroPercentage("carbs") === 0 ||
    getMacroPercentage("protein") === 0 ||
    getMacroPercentage("fat") === 0
  );
}

function updateBlur(dtMs) {
  if (!state.effects.has("blur")) {
    blurVisible = false;
    blurTimerMs = 0;
    return;
  }
  if (blurTimerMs > 0) {
    blurTimerMs -= dtMs;
    return;
  }
  blurVisible = !blurVisible;
  blurTimerMs = blurVisible
    ? HUNGER_CONSTANTS.blurFlashDurationMs
    : DECAY.blurIntervalMs;
}

function applyMacroDecay(dt) {
  const starving = shouldStarve();
  for (const macro of Object.keys(state.macros)) {
    const base = DECAY.macroDecayPerSecond[macro] || 0;
    let decay = base * dt;
    if (macro === "fat" && starving) {
      decay *= DECAY.fatExtraDecayWhenStarving;
    }
    state.macros[macro] = clamp(state.macros[macro] - decay, 0, Infinity);
  }
}

function applyHungerDecay(dt) {
  const fat = getMacroPercentage("fat");
  let decay = DECAY.hungerPerSecondBase;
  if (
    fat >= MACRO_EFFECTS.fat.saturationRange[0] &&
    fat <= MACRO_EFFECTS.fat.saturationRange[1]
  ) {
    decay *= DECAY.hungerDecayWithSaturation;
  }
  if (fat < MACRO_EFFECTS.fat.starvingGuardAbove) {
    decay *= DECAY.hungerDecayPenaltyLowFat;
  }
  if (state.effects.has("starving")) {
    decay += DECAY.starvingDamagePerSecond;
  }
  state.hunger = clamp(
    state.hunger - decay * dt,
    0,
    HUNGER_CONSTANTS.hungerMax
  );
}

function applyStaminaIdle(dt) {
  const loss = STAMINA.idleLossPerSec * dt;
  state.stamina = clamp(state.stamina - loss, 0, HUNGER_CONSTANTS.staminaMax);
  if (!activity.running) {
    state.stamina = clamp(
      state.stamina + STAMINA.regenPerSec * dt,
      0,
      HUNGER_CONSTANTS.staminaMax
    );
  }
}

function ensureBusListeners() {
  if (!busRef) return;
  busRef.off?.("player:consume", onPlayerConsume);
  busRef.on("player:consume", onPlayerConsume);
}

function onPlayerConsume({ foodId }) {
  applyFood(foodId);
}

export function initHunger(bus) {
  busRef = bus;
  ensureBusListeners();
  emitStateChanged(true);
  emitEffectsChanged(new Set());
}

export function getHungerState() {
  return cloneState();
}

export function getSprintMultiplier() {
  return computeSprintMultiplier();
}

export function hasEffect(effect) {
  return state.effects.has(effect);
}

export function isBlurActive() {
  return blurVisible;
}

export function applyFood(foodId) {
  const item = foodId ? getItem(foodId) : null;
  const effect = computeFoodEffect(item);
  if (!effect) return;
  let changed = false;
  for (const macro of MACRO_KEYS) {
    const delta = roundToHundredth(Math.max(0, effect.macros?.[macro] || 0));
    if (delta <= 0) continue;
    const updated = clamp(state.macros[macro] + delta, 0, Infinity);
    if (Math.abs(updated - state.macros[macro]) > EPSILON) {
      state.macros[macro] = updated;
      changed = true;
    }
  }
  const hungerDelta = roundToHundredth(Math.max(0, effect.hunger || 0));
  if (hungerDelta > 0) {
    const updated = clamp(
      state.hunger + hungerDelta,
      0,
      HUNGER_CONSTANTS.hungerMax
    );
    if (Math.abs(updated - state.hunger) > EPSILON) {
      state.hunger = roundToHundredth(updated);
      changed = true;
    }
  }
  if (changed) {
    recalcEffects();
    emitStateChanged(true);
  }
}

function parseCost(labelWithMod) {
  return parseLabeledValue(labelWithMod);
}

export function applyActionCost(labelWithMod, context = {}) {
  const parsed = parseCost(labelWithMod);
  if (!parsed) return;
  const { label } = parsed;
  let amount = parsed.value;
  const action = context.action;

  if (action === "run") {
    activity.running = true;
    const sprintBonus = computeSprintMultiplier();
    if (label === "stamina" && sprintBonus > 0) {
      amount /= sprintBonus;
    }
    if (
      label === "stamina" &&
      getMacroPercentage("carbs") < MACRO_EFFECTS.carbs.slowBelow
    ) {
      amount *= MACRO_EFFECTS.carbs.extraStaminaDrainBelow20;
    }
  }
  if (action === "walk") {
    activity.moving = true;
  }
  if (action && action !== "run" && action !== "walk") {
    activity.acted = true;
  }

  if (label === "hunger") {
    state.hunger = clamp(
      state.hunger - amount,
      0,
      HUNGER_CONSTANTS.hungerMax
    );
  } else if (label === "stamina") {
    state.stamina = clamp(
      state.stamina - amount,
      0,
      HUNGER_CONSTANTS.staminaMax
    );
  } else if (label.startsWith("macro.")) {
    const key = label.split(".")[1];
    if (key && state.macros[key] != null) {
      state.macros[key] = clamp(state.macros[key] - amount, 0, Infinity);
    }
  }
}

export function applyActionGroup(action, scale = 1) {
  const defs = ACTION_COSTS[action];
  if (!defs || !defs.length) return;
  for (const def of defs) {
    const parsed = parseCost(def);
    if (!parsed) continue;
    const scaled = `${parsed.label}<${parsed.value * scale}>`;
    applyActionCost(scaled, { action });
  }
}

export function tick(dtMs) {
  const dt = Math.max(0, dtMs) / 1000;
  if (!Number.isFinite(dt) || dt <= 0) {
    updateBlur(dtMs);
    return;
  }

  applyMacroDecay(dt);
  recalcEffects();
  applyHungerDecay(dt);
  applyStaminaIdle(dt);
  updateBlur(dtMs);
  emitStateChanged();

  activity.running = false;
  activity.moving = false;
  activity.acted = false;
}

