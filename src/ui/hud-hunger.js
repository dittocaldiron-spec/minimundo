const MACROS = [
  { key: "carbs", className: "carbs", label: "Carbs" },
  { key: "protein", className: "protein", label: "Protein" },
  { key: "fat", className: "fat", label: "Fat" },
];

const EFFECT_BADGES = {
  slow: { text: "Slow", className: "effect-slow" },
  strength: { text: "Str", className: "effect-strength" },
  weakness: { text: "Weak", className: "effect-weakness" },
  saturation: { text: "Sat", className: "effect-saturation" },
  starving: { text: "Starv", className: "effect-starving" },
  fatigued: { text: "Cansado", className: "effect-fatigue" },
};

function $(sel, root = document) {
  return root.querySelector(sel);
}

function createSliceElement(kind) {
  const slice = document.createElement("div");
  slice.className = `hud-hunger__slice hud-hunger__slice--${kind}`;
  slice.style.setProperty("--fill", "0");
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
    MACROS.forEach(({ className }) => {
      pizza.appendChild(createSliceElement(className));
    });
    const mask = document.createElement("div");
    mask.className = "hud-hunger__mask";
    pizza.appendChild(mask);
    container.appendChild(pizza);
  }
  let badges = $(".hud-hunger__badges", container);
  if (!badges) {
    badges = document.createElement("div");
    badges.className = "hud-hunger__badges";
    container.appendChild(badges);
  }
  return { container, pizza, badges, fatigueBadge: null, lastFatiguePayload: null };
}

function formatFatigueText(payload) {
  const base = EFFECT_BADGES.fatigued.text;
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
    const slice = dom.pizza.querySelector(`.hud-hunger__slice--${className}`);
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
      const cfg = EFFECT_BADGES.fatigued;
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
