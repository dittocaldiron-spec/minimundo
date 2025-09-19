import { getItem } from "../items.js";
import { ACTION_COSTS } from "../config/action-costs.js";
import { DECAY, MACRO_EFFECTS, STAMINA, HUNGER_CONSTANTS } from "../config/hunger.config.js";

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const EPSILON = 0.0001;
const CALORIES_TO_HUNGER = 0.5;

const state = {
  macros: { carbs: 60, protein: 45, fat: 30 },
  hunger: 80,
  stamina: HUNGER_CONSTANTS.staminaMax,
  effects: new Set(),
  staminaCooldownMs: 0,
  sprintDrainAccumulator: 0,
};

let busRef = null;
let lastSnapshot = null;
let blurTimerMs = 0;
let blurVisible = false;
let lastFatigueEvent = { active: false, remainingMs: 0, remainingSec: 0 };

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
    staminaCooldownMs: Math.max(0, state.staminaCooldownMs),
    fatigue: {
      active: isStaminaOnCooldown(),
      remainingMs: Math.max(0, state.staminaCooldownMs),
      remainingSec: Math.max(0, state.staminaCooldownMs) / 1000,
    },
  };
}

function emitStateChanged(force = false) {
  if (!busRef) return;
  const snapshot = cloneState();
  if (!force && lastSnapshot) {
    const prev = lastSnapshot;
    const prevFatigue = prev.fatigue || { active: false, remainingMs: 0 };
    const nextFatigue = snapshot.fatigue || { active: false, remainingMs: 0 };
    const diff =
      Math.abs(prev.hunger - snapshot.hunger) > EPSILON ||
      Math.abs(prev.stamina - snapshot.stamina) > EPSILON ||
      Math.abs(prev.macros.carbs - snapshot.macros.carbs) > EPSILON ||
      Math.abs(prev.macros.protein - snapshot.macros.protein) > EPSILON ||
      Math.abs(prev.macros.fat - snapshot.macros.fat) > EPSILON ||
      Math.abs((prev.staminaCooldownMs || 0) - (snapshot.staminaCooldownMs || 0)) >
        EPSILON ||
      prevFatigue.active !== nextFatigue.active ||
      Math.abs(prevFatigue.remainingMs - nextFatigue.remainingMs) > EPSILON;
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

function getCooldownPayload() {
  const remainingMs = Math.max(0, state.staminaCooldownMs);
  return {
    active: remainingMs > EPSILON,
    remainingMs,
    remainingSec: remainingMs / 1000,
  };
}

function emitFatigueChanged(force = false) {
  if (!busRef) return;
  const payload = getCooldownPayload();
  if (
    !force &&
    lastFatigueEvent.active === payload.active &&
    Math.abs(lastFatigueEvent.remainingMs - payload.remainingMs) < 1
  ) {
    return;
  }
  lastFatigueEvent = { ...payload };
  busRef.emit("stamina:fatigue", payload);
}

function startStaminaCooldown() {
  const durationSec = STAMINA.cooldownDurationSec ?? 0;
  const durationMs = Math.max(0, durationSec * 1000);
  if (durationMs <= 0) return;
  state.staminaCooldownMs = durationMs;
  state.sprintDrainAccumulator = 0;
  emitFatigueChanged(true);
}

function updateStaminaCooldown(dtMs) {
  if (state.staminaCooldownMs <= 0) {
    if (lastFatigueEvent.active) {
      emitFatigueChanged();
    }
    return;
  }
  state.staminaCooldownMs = Math.max(0, state.staminaCooldownMs - dtMs);
  if (state.staminaCooldownMs <= 0) {
    state.sprintDrainAccumulator = 0;
  }
  emitFatigueChanged();
}

function decaySprintAccumulator(dt) {
  if (state.sprintDrainAccumulator <= 0) return;
  if (isStaminaOnCooldown()) return;
  if (activity.running) return;
  const rate = STAMINA.sprintDrainDecayPerSec || 0;
  if (rate <= 0) return;
  state.sprintDrainAccumulator = Math.max(
    0,
    state.sprintDrainAccumulator - rate * dt
  );
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

  if (isStaminaOnCooldown()) {
    state.effects.add("fatigued");
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
  state.staminaCooldownMs = 0;
  state.sprintDrainAccumulator = 0;
  lastFatigueEvent = { active: false, remainingMs: 0, remainingSec: 0 };
  emitFatigueChanged(true);
  emitStateChanged(true);
  emitEffectsChanged(new Set());
}

export function getHungerState() {
  return cloneState();
}

export function getSprintMultiplier() {
  return computeSprintMultiplier();
}

export function isStaminaOnCooldown() {
  return state.staminaCooldownMs > EPSILON;
}

export function hasEffect(effect) {
  return state.effects.has(effect);
}

export function isBlurActive() {
  return blurVisible;
}

export function applyFood(foodId) {
  const item = foodId ? getItem(foodId) : null;
  const meta = item?.meta || {};
  let changed = false;
  for (const macro of ["carbs", "protein", "fat"]) {
    if (typeof meta[macro] === "number") {
      state.macros[macro] = clamp(
        state.macros[macro] + meta[macro],
        0,
        Infinity
      );
      changed = true;
    }
  }
  if (typeof meta.calories === "number") {
    state.hunger = clamp(
      state.hunger + meta.calories * CALORIES_TO_HUNGER,
      0,
      HUNGER_CONSTANTS.hungerMax
    );
    changed = true;
  }
  if (changed) {
    recalcEffects();
    emitStateChanged(true);
  }
}

function parseCost(labelWithMod) {
  if (typeof labelWithMod !== "string") return null;
  const match = labelWithMod.match(/^([^<]+)<([^>]+)>$/);
  if (!match) return null;
  const [, label, valueStr] = match;
  const value = Number.parseFloat(valueStr);
  if (!Number.isFinite(value)) return null;
  return { label: label.trim(), value };
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
    const previous = state.stamina;
    state.stamina = clamp(
      state.stamina - amount,
      0,
      HUNGER_CONSTANTS.staminaMax
    );
    const drained = previous - state.stamina;
    if (drained > EPSILON) {
      if (previous > EPSILON && state.stamina <= EPSILON) {
        startStaminaCooldown();
      } else if (
        action === "run" &&
        !isStaminaOnCooldown() &&
        (STAMINA.significantSprintDrain || 0) > 0
      ) {
        state.sprintDrainAccumulator += drained;
        if (state.sprintDrainAccumulator >= STAMINA.significantSprintDrain) {
          startStaminaCooldown();
        }
      }
    }
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
  const safeDtMs = Number.isFinite(dtMs) ? Math.max(0, dtMs) : 0;
  const dt = safeDtMs / 1000;
  updateStaminaCooldown(safeDtMs);
  if (dt <= 0) {
    updateBlur(dtMs);
    return;
  }

  applyMacroDecay(dt);
  recalcEffects();
  applyHungerDecay(dt);
  applyStaminaIdle(dt);
  decaySprintAccumulator(dt);
  updateBlur(dtMs);
  emitStateChanged();

  activity.running = false;
  activity.moving = false;
  activity.acted = false;
}

