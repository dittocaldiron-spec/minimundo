import { HUD_HUNGER } from "../config/hunger.config.js";

const DEFAULT_MACROS = [
  { key: "carbs", className: "carbs", label: "Carboidratos" },
  { key: "protein", className: "protein", label: "Proteínas" },
  { key: "fat", className: "fat", label: "Gorduras" },
];

const DEFAULT_EFFECT_BADGES = {
  slow: { text: "Lento", className: "effect-slow" },
  strength: { text: "Força", className: "effect-strength" },
  weakness: { text: "Fraco", className: "effect-weakness" },
  saturation: { text: "Saciado", className: "effect-saturation" },
  starving: { text: "Faminto", className: "effect-starving" },
  fatigued: { text: "Cansado", className: "effect-fatigue" },
};

function normalizeMacros(configMacros = []) {
  if (!Array.isArray(configMacros) || !configMacros.length) return DEFAULT_MACROS;
  return configMacros.map((macro, index) => {
    if (!macro || typeof macro !== "object") return DEFAULT_MACROS[index] || DEFAULT_MACROS[0];
    const key = macro.key || macro.id || DEFAULT_MACROS[index]?.key || `macro-${index}`;
    return {
      key,
      className: macro.className || macro.variant || key,
      label: macro.label || macro.text || DEFAULT_MACROS[index]?.label || key,
    };
  });
}

function normalizeEffectBadges(configBadges = {}) {
  const merged = { ...DEFAULT_EFFECT_BADGES };
  if (!configBadges || typeof configBadges !== "object") {
    return merged;
  }
  for (const [key, value] of Object.entries(configBadges)) {
    if (!value) continue;
    if (typeof value === "string") {
      merged[key] = {
        text: value,
        className: DEFAULT_EFFECT_BADGES[key]?.className || `effect-${key}`,
      };
      continue;
    }
    if (typeof value === "object") {
      merged[key] = {
        text: value.text || DEFAULT_EFFECT_BADGES[key]?.text || key,
        className: value.className || DEFAULT_EFFECT_BADGES[key]?.className || `effect-${key}`,
      };
    }
  }
  return merged;
}

const HUD_CONFIG = HUD_HUNGER || {};
const MACROS = normalizeMacros(HUD_CONFIG.macros);
const EFFECT_BADGES = normalizeEffectBadges(HUD_CONFIG.effectBadges);
const FATIGUE_BADGE = EFFECT_BADGES.fatigued || DEFAULT_EFFECT_BADGES.fatigued;

function $(sel, root = document) {
  return root.querySelector(sel);
}

function createSliceElement(macro) {
  const slice = document.createElement("div");
  const variant = macro?.className || macro?.key || "macro";
  slice.className = `hud-hunger__slice hud-hunger__slice--${variant}`;
  slice.style.setProperty("--fill", "0");
  if (macro?.label) {
    slice.title = macro.label;
    slice.setAttribute("aria-label", macro.label);
  }
  if (macro?.key) {
    slice.dataset.macro = macro.key;
  }
  return slice;
}

function ensureContainer() {
  const hud = $(".hud") || document.body;
  let container = $(".hud-hunger", hud);
  if (!container) {
    container = document.createElement("div");
    container.className = "hud-hunger";
    hud.appendChild(container);
  }
  let pizza = $(".hud-hunger__pizza", container);
  if (!pizza) {
    pizza = document.createElement("div");
    pizza.className = "hud-hunger__pizza";
    const sliceMap = new Map();
    MACROS.forEach((macro) => {
      const slice = createSliceElement(macro);
      sliceMap.set(macro.key, slice);
      pizza.appendChild(slice);
    });
    const mask = document.createElement("div");
    mask.className = "hud-hunger__mask";
    pizza.appendChild(mask);
    pizza.__sliceMap = sliceMap;
    container.appendChild(pizza);
  }
  let badges = $(".hud-hunger__badges", container);
  if (!badges) {
    badges = document.createElement("div");
    badges.className = "hud-hunger__badges";
    container.appendChild(badges);
  }
  const sliceMap = pizza.__sliceMap instanceof Map ? pizza.__sliceMap : new Map();
  if (!sliceMap.size) {
    MACROS.forEach((macro) => {
      const selector = `.hud-hunger__slice--${macro.className || macro.key}`;
      const slice = pizza.querySelector(selector);
      if (slice) sliceMap.set(macro.key, slice);
    });
    pizza.__sliceMap = sliceMap;
  }
  return {
    container,
    pizza,
    badges,
    slices: sliceMap,
    fatigueBadge: null,
    lastFatiguePayload: null,
  };
}

function formatFatigueText(payload) {
  const base = FATIGUE_BADGE?.text || "Cansado";
  if (!payload || !payload.active) return base;
  const seconds = Math.max(
    0,
    Math.ceil(
      typeof payload.remainingSec === "number"
        ? payload.remainingSec
        : payload.remainingMs / 1000
    )
  );
  return seconds > 0 ? `${base} (${seconds}s)` : base;
}

function syncFatigueBadge(dom) {
  if (!dom?.fatigueBadge) return;
  dom.fatigueBadge.textContent = formatFatigueText(dom.lastFatiguePayload);
}

function updateMacros(dom, state) {
  MACROS.forEach(({ key, className }) => {
    const value = state.macros?.[key] ?? 0;
    const fill = Math.max(0, Math.min(1, value / 100));
    const slice = dom.slices?.get(key) || dom.pizza.querySelector(`.hud-hunger__slice--${className}`);
    if (!slice) return;
    slice.style.setProperty("--fill", fill.toString());
    if (value > 100) slice.classList.add("over");
    else slice.classList.remove("over");
  });
}

function updateBadges(dom, effects) {
  const set = new Set(effects || []);
  const entries = Object.entries(EFFECT_BADGES).filter(([key]) => set.has(key));
  dom.badges.textContent = "";
  dom.fatigueBadge = null;
  entries.forEach(([key, cfg]) => {
    const span = document.createElement("span");
    span.className = `badge hud-hunger__badge ${cfg.className}`;
    span.textContent = cfg.text;
    span.dataset.effect = key;
    if (key === "fatigued") {
      dom.fatigueBadge = span;
    }
    dom.badges.appendChild(span);
  });
  dom.container.classList.toggle("hud-hunger--has-effects", entries.length > 0);
  dom.container.classList.toggle("hud-hunger--fatigued", set.has("fatigued"));
  syncFatigueBadge(dom);
}

export function setupHungerHUD(emitter) {
  const dom = ensureContainer();

  emitter.on("hunger:changed", ({ state }) => {
    updateMacros(dom, state || {});
  });

  emitter.on("effects:changed", ({ effects }) => {
    updateBadges(dom, effects);
  });

  emitter.on("stamina:fatigue", (payload = {}) => {
    dom.lastFatiguePayload = payload;
    if (payload.active && !dom.fatigueBadge) {
      const cfg = FATIGUE_BADGE || EFFECT_BADGES.fatigued;
      const span = document.createElement("span");
      span.className = `badge hud-hunger__badge ${cfg.className}`;
      span.dataset.effect = "fatigued";
      dom.badges.appendChild(span);
      dom.fatigueBadge = span;
    }
    syncFatigueBadge(dom);
    dom.container.classList.toggle("hud-hunger--fatigued", Boolean(payload.active));
    dom.container.classList.toggle(
      "hud-hunger--has-effects",
      dom.badges.children.length > 0
    );
  });
}
