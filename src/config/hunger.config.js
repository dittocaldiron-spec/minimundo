export const MACRO_EFFECTS = {
  carbs: {
    good: [40, 60],
    slowBelow: 20,
    blurBelow: 5,
    sprintBonusCap: 1.5,
    extraStaminaDrainBelow20: 1.35,
  },
  protein: {
    good: [40, 50],
    weakBelow: 20,
    blurBelow: 5,
    strengthInGood: true,
  },
  fat: {
    saturationRange: [15, 20],
    slowAbove: 60,
    starvingGuardAbove: 5,
  },
};

export const DECAY = {
  hungerPerSecondBase: 0.02,
  macroDecayPerSecond: { carbs: 0.01, protein: 0.008, fat: 0.006 },
  hungerDecayWithSaturation: 0.8,
  hungerDecayPenaltyLowFat: 1.25,
  starvingDamagePerSecond: 2.0,
  blurIntervalMs: 20000,
  fatExtraDecayWhenStarving: 2.0,
};

export const STAMINA = {
  idleLossPerSec: 0.5,
  runLossPerSec: 8,
  regenPerSec: 4,
  minToStartSprint: 3,
};

export const HUNGER_CONSTANTS = {
  blurFlashDurationMs: 600,
  hungerMax: 100,
  staminaMax: 100,
};
