const form = document.querySelector("#macro-form");
const resultsGrid = document.querySelector("#results");
const resultsCount = document.querySelector("#results-count");

const MAX_VISIBLE_RESULTS = 3;

let foods = [];

let translations = {};
let currentLang = "en";

const getDefaultLang = () => {
  const browserLang = (navigator.language || "en").toLowerCase();
  if (browserLang.startsWith("it")) return "it";
  if (browserLang.startsWith("es")) return "es";
  return "en";
};

const t = (key) =>
  translations[currentLang]?.[key] || translations.en?.[key] || key;

const trackEvent = (name, params = {}) => {
  if (typeof window.gtag === "function") {
    window.gtag("event", name, params);
  }
};

const getFoodName = (item) => {
  if (currentLang === "it") return item.name_IT;
  if (currentLang === "es") return item.name_ES;
  return item.name_EN;
};

const applyLanguage = () => {
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    el.textContent = t(key);
  });

  const placeholders = {
    protein: t("placeholder_protein"),
    carb: t("placeholder_carb"),
    fat: t("placeholder_fat"),
  };
  const proteinInput = document.querySelector("#protein");
  const carbInput = document.querySelector("#carb");
  const fatInput = document.querySelector("#fat");
  if (proteinInput) proteinInput.placeholder = placeholders.protein;
  if (carbInput) carbInput.placeholder = placeholders.carb;
  if (fatInput) fatInput.placeholder = placeholders.fat;
  const betaEmail = document.querySelector("#beta-email");
  if (betaEmail) betaEmail.placeholder = t("placeholder_email");
  const betaMessage = document.querySelector("#beta-message");
  if (betaMessage) betaMessage.placeholder = t("placeholder_feedback");

  const resultsTitle = document.querySelector("#results-title");
  if (resultsTitle) resultsTitle.textContent = t("results_title");
  const resultsCount = document.querySelector("#results-count");
  if (resultsCount) resultsCount.textContent = t("results_none");
  const hintText = document.querySelector("#hint-text");
  if (hintText) hintText.textContent = t("hint_one_macro");
  const emptyState = document.querySelector("#empty-state-text");
  if (emptyState) emptyState.textContent = t("empty_prompt");
  const matchButton = document.querySelector("#match-button");
  if (matchButton) matchButton.textContent = t("match_button");
  const betaErrorEl = document.querySelector("#beta-error");
  if (betaErrorEl && betaErrorEl.getAttribute("data-i18n")) {
    const key = betaErrorEl.getAttribute("data-i18n");
    betaErrorEl.textContent = t(key);
  }
  const betaSubmitEl = document.querySelector("#beta-submit");
  if (betaSubmitEl && betaSubmitEl.classList.contains("is-loading")) {
    betaSubmitEl.textContent = t("beta_sending");
  }
};

const formatMacroLine = (label, value, className) =>
  `<span class="macro ${className}"><span class="dot"></span>${label} ${value}g</span>`;

const calcKcal = (protein, fat, carb) => protein * 4 + fat * 9 + carb * 4;

const formatMacros = (item) => {
  const kcal = calcKcal(item.protein, item.fat, item.carb);
  return `${t("kcal_label")} ${kcal.toFixed(0)} · ${formatMacroLine(t("macro_protein"), item.protein, "macro--protein")} · ${formatMacroLine(t("macro_fat"), item.fat, "macro--fat")} · ${formatMacroLine(t("macro_carb"), item.carb, "macro--carb")}`;
};

const comboSignature = (combo) =>
  combo.items.map((item) => item.id || item.nameIT || item.name).sort().join("|");

const comboRotationState = {
  signature: "",
  pool: [],
  index: 0,
};

const getRotatedCombos = (combos, count) => {
  if (!combos.length) return [];
  if (combos.length <= count) return combos;
  const signature = combos
    .map((combo) => comboSignature(combo))
    .sort()
    .join("::");
  if (signature !== comboRotationState.signature) {
    comboRotationState.signature = signature;
    comboRotationState.pool = shuffleArray(combos);
    comboRotationState.index = 0;
  }
  const pool = comboRotationState.pool;
  const start = comboRotationState.index;
  const selected = [];
  for (let i = 0; i < count; i += 1) {
    selected.push(pool[(start + i) % pool.length]);
  }
  comboRotationState.index = (start + count) % pool.length;
  return selected;
};

const renderEmpty = (key) => {
  const message = t(key);
  resultsGrid.innerHTML = `
    <div class="empty-state">
      <p>${message}</p>
    </div>
  `;
};

const ensureBetaNotice = (shouldShow) => {
  const existing = document.querySelector("#beta-results-note");
  if (!shouldShow) {
    if (existing) existing.remove();
    return;
  }
  if (existing) {
    existing.textContent = t("beta_results_notice");
    return;
  }
  const note = document.createElement("div");
  note.id = "beta-results-note";
  note.className = "results-warning";
  note.textContent = t("beta_results_notice");
  resultsGrid.appendChild(note);
};

const renderMatches = (items) => {
  resultsGrid.innerHTML = "";
  const betaSection = document.querySelector("#beta-section");
  if (betaSection) betaSection.hidden = false;

  if (!items.length) {
    renderEmpty("empty_no_combos");
    resultsCount.textContent = t("results_none");
    return;
  }

  items.forEach((item) => {
    const name = getFoodName(item);
    const card = document.createElement("article");
    card.className = "result-card";
    card.innerHTML = `
      <img src="${item.image}" alt="${name}" />
      <div>
        <h3>${name}</h3>
        <p class="macro-line">${formatMacros(item)}</p>
      </div>
    `;
    resultsGrid.appendChild(card);
  });

  resultsCount.textContent = `${items.length} ${t("results_label")}`;
};

const renderCombos = (combos) => {
  resultsGrid.innerHTML = "";
  const betaSection = document.querySelector("#beta-section");

  if (!combos.length) {
    renderEmpty("empty_no_combos");
    resultsCount.textContent = t("results_none");
    if (betaSection) betaSection.hidden = false;
    return;
  }

  const visibleCombos = getRotatedCombos(combos, MAX_VISIBLE_RESULTS);
  const total = visibleCombos.length;
  let rendered = 0;
  const chunkSize = 5;

  const renderChunk = () => {
    const slice = visibleCombos.slice(rendered, rendered + chunkSize);
    slice.forEach((combo, index) => {
      const card = document.createElement("article");
      card.className = "combo-card";
    const totals = `
        <span class="macro macro--kcal"><strong>${t("kcal_label")} ${combo.totalKcal.toFixed(0)}</strong></span>
        ${formatMacroLine(t("macro_protein"), combo.totalProtein.toFixed(1), "macro--protein")}
        ${formatMacroLine(t("macro_fat"), combo.totalFat.toFixed(1), "macro--fat")}
        ${formatMacroLine(t("macro_carb"), combo.totalCarb.toFixed(1), "macro--carb")}
      `;
      const comboIndex = rendered + index + 1;
      card.innerHTML = `
        <div class="combo-card__header">
          <h3>${t("combination_label")} ${comboIndex}</h3>
          <div class="macro-line">${totals}</div>
        </div>
        <div class="combo-divider" aria-hidden="true"></div>
        <ul class="combo-list">
          ${combo.items
            .map((item) => {
              const protein = ((item.proteinPer100 * item.grams) / 100).toFixed(1);
              const fat = ((item.fatPer100 * item.grams) / 100).toFixed(1);
              const carb = ((item.carbPer100 * item.grams) / 100).toFixed(1);
              const kcal = calcKcal(Number(protein), Number(fat), Number(carb)).toFixed(0);
              return `
                <li class="combo-item">
                  <img src="${item.image}" alt="${item.name}" />
                  <div>
                    <div class="combo-item__title">${item.name}</div>
                    <div class="combo-item__meta">${item.grams}g · ${t("kcal_label")} ${kcal}</div>
                    <div class="macro-line">
                      ${formatMacroLine(t("macro_protein"), protein, "macro--protein")}
                      ${formatMacroLine(t("macro_fat"), fat, "macro--fat")}
                      ${formatMacroLine(t("macro_carb"), carb, "macro--carb")}
                    </div>
                  </div>
                </li>
              `;
            })
            .join("")}
        </ul>
      `;
      resultsGrid.appendChild(card);
    });

    rendered += slice.length;
    resultsCount.textContent =
      rendered < total
        ? `${rendered} / ${total} ${t("combinations_label")}`
        : `${total} ${t("combinations_label")}`;

    if (rendered < total) {
      setTimeout(renderChunk, 0);
    } else {
      ensureBetaNotice(total === 3);
      if (betaSection) betaSection.hidden = false;
    }
  };

  renderChunk();
};

const enforceInputLimit = (input) => {
  const value = input.value === "" ? "" : Number(input.value);
  if (value === "") return;
  if (Number.isNaN(value)) {
    input.value = "";
    return;
  }
  if (value > 100) input.value = "100";
  if (value < 0) input.value = "0";
};

const macroInputs = ["#protein", "#fat", "#carb"];
const updateInputLocking = () => {
  const inputs = macroInputs
    .map((selector) => document.querySelector(selector))
    .filter(Boolean);
  const active = inputs.find((input) => input.value !== "" && Number(input.value) !== 0);
  inputs.forEach((input) => {
    const shouldDisable = Boolean(active && input !== active);
    input.disabled = shouldDisable;
    if (shouldDisable) {
      input.value = "";
    }
    const label = input.closest("label");
    if (label) {
      label.classList.toggle("is-disabled", shouldDisable);
    }
  });
};

macroInputs.forEach((selector) => {
  const input = document.querySelector(selector);
  if (!input) return;
  input.addEventListener("input", () => updateInputLocking());
  input.addEventListener("change", () => updateInputLocking());
  input.addEventListener("input", () => enforceInputLimit(input));
  input.addEventListener("blur", () => enforceInputLimit(input));
});

updateInputLocking();

const scoreItem = (item, target) => {
  const proteinOnly =
    target.protein !== null && target.fat === null && target.carb === null;
  if (proteinOnly) {
    if (item.protein <= 0) return Number.POSITIVE_INFINITY;
    const gramsNeeded = (target.protein / item.protein) * 100;
    return gramsNeeded;
  }
  let score = 0;
  if (target.protein !== null) {
    score += Math.abs(item.protein - target.protein);
  }
  if (target.fat !== null) {
    score += Math.abs(item.fat - target.fat);
  }
  if (target.carb !== null) {
    score += Math.abs(item.carb - target.carb);
  }
  return score;
};

const prefilterFoods = (filters, target, limit = 12) => {
  const filtered = applyCategoryFilters(foods, filters);
  if (!target) return filtered;
  return filtered
    .map((item) => ({ item, score: scoreItem(item, target) }))
    .sort((a, b) => a.score - b.score)
    .slice(0, limit)
    .map(({ item }) => item);
};

const applyCategoryFilters = (items, filters) => {
  if (!filters.avoidMeat && !filters.avoidFish && !filters.avoidJunk) {
    return items;
  }

  return items.filter((item) => {
    const categories = getCategories(item.category);
    if (filters.avoidMeat && categories.includes("meat")) return false;
    if (filters.avoidFish && categories.includes("fish")) return false;
    if (filters.avoidJunk && categories.includes("junk")) return false;
    return true;
  });
};

const matchFoods = (target, filters) => {
  const targetKey = ["protein", "fat", "carb"].find((key) => target[key] !== null);
  return prefilterFoods(filters, target, 10)
    .filter((item) => !isOliveOilItem(item))
    .filter((item) => (targetKey ? item[targetKey] > 0 : true))
    .map((item) => ({
      ...item,
      score: scoreItem(item, target),
    }))
    .sort((a, b) => a.score - b.score)
    .slice(0, 6);
};

const roundToStep = (value, step) => Math.round(value / step) * step;
const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const getCategories = (category) =>
  (category || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
const hasCategory = (item, category) =>
  getCategories(item.category).includes(category);
const isOliveOilItem = (item) => {
  const name = (item.nameIT || item.name_IT || "").toLowerCase();
  return (
    hasCategory(item, "olive-oil") ||
    name.includes("olio di oliva") ||
    name.includes("olio d'oliva")
  );
};
const isHamburgerItem = (item) => hasCategory(item, "hamburger");
const getGramsBounds = (item, defaultMin, defaultMax, step) => {
  if (isOliveOilItem(item)) {
    return { min: 5, max: 20, step: 5 };
  }
  if (isHamburgerItem(item)) {
    return { min: 100, max: 200, step: 100 };
  }
  return { min: defaultMin, max: defaultMax, step };
};
const MAX_ITEM_KCAL = 800;
const itemKcalForGrams = (item, grams) =>
  calcKcal(
    (item.proteinPer100 * grams) / 100,
    (item.fatPer100 * grams) / 100,
    (item.carbPer100 * grams) / 100
  );
const isWithinItemKcalLimit = (item, grams) =>
  itemKcalForGrams(item, grams) <= MAX_ITEM_KCAL;
const shuffleArray = (items) => {
  const array = [...items];
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
};


const buildMacroCombos = (target, filters, allowFallback = true) => {
  const STEP = 20;
  const MIN_GRAMS = 30;
  const MAX_GRAMS = 600;
  const BASE_TOLERANCE = 5;
  const MAX_POOL = 60;

  const targetKeys = ["protein", "fat", "carb"].filter(
    (key) => target[key] !== null
  );
  if (!targetKeys.length) return [];

  const candidates = prefilterFoods(filters, target, 12);
  const sources = [...candidates]
    .filter((item) => item.protein > 0 || item.fat > 0 || item.carb > 0)
    .map((item) => ({
      id: item.id,
      name: getFoodName(item),
      nameIT: item.name_IT,
      image: item.image,
      category: item.category,
      proteinPer100: item.protein,
      fatPer100: item.fat,
      carbPer100: item.carb,
    }));

  const combosMap = new Map();
  const fallbackMap = new Map();
  const comboKey = (items) =>
    items
      .map((item) => item.id || item.nameIT || item.name)
      .sort()
      .join("|");
  const addBest = (map, combo) => {
    const key = comboKey(combo.items);
    const existing = map.get(key);
    if (!existing || combo.score < existing.score) {
      map.set(key, combo);
    }
  };

  const computeTotals = (items) => {
    let totalProtein = 0;
    let totalFat = 0;
    let totalCarb = 0;
    items.forEach((item) => {
      totalProtein += (item.proteinPer100 * item.grams) / 100;
      totalFat += (item.fatPer100 * item.grams) / 100;
      totalCarb += (item.carbPer100 * item.grams) / 100;
    });
    const totalKcal = calcKcal(totalProtein, totalFat, totalCarb);
    return { totalProtein, totalFat, totalCarb, totalKcal };
  };

  const scoreCombo = (totals) => {
    let score = 0;
    targetKeys.forEach((key) => {
      const targetValue = target[key];
      const totalValue =
        key === "protein"
          ? totals.totalProtein
          : key === "fat"
          ? totals.totalFat
          : totals.totalCarb;
      const denom = targetValue === 0 ? 1 : targetValue;
      score += Math.abs(totalValue - targetValue) / denom;
    });
    return score;
  };

  const withinTolerance = (totals) => {
    return targetKeys.every((key) => {
      const targetValue = target[key];
      const totalValue =
        key === "protein"
          ? totals.totalProtein
          : key === "fat"
          ? totals.totalFat
          : totals.totalCarb;
      const tolerance = targetValue >= 150 ? 25 : BASE_TOLERANCE;
      return Math.abs(totalValue - targetValue) <= tolerance;
    });
  };

  const shouldStop = () => combosMap.size >= MAX_POOL;
  const pushFallback = (combo) => {
    addBest(fallbackMap, combo);
    if (fallbackMap.size > MAX_POOL) {
      const sorted = [...fallbackMap.values()].sort((a, b) => a.score - b.score);
      fallbackMap.clear();
      sorted.slice(0, MAX_POOL).forEach((item) => addBest(fallbackMap, item));
    }
  };

  // 1 alimento
  sources.forEach((a) => {
    if (shouldStop()) return;
    targetKeys.forEach((key) => {
      if (shouldStop()) return;
      const per100 =
        key === "protein"
          ? a.proteinPer100
          : key === "fat"
          ? a.fatPer100
          : a.carbPer100;
      if (per100 <= 0) return;
      if (isOliveOilItem(a)) return;
      const bounds = getGramsBounds(a, MIN_GRAMS, MAX_GRAMS, STEP);
      const grams = clamp(
        roundToStep((target[key] / per100) * 100, bounds.step),
        bounds.min,
        bounds.max
      );
      const items = [{ ...a, grams }];
      if (!isWithinItemKcalLimit(a, grams)) return;
      const totals = computeTotals(items);
      if (!withinTolerance(totals)) {
        pushFallback({
          items,
          ...totals,
          score: scoreCombo(totals),
        });
        return;
      }
      addBest(combosMap, {
        items,
        ...totals,
        score: scoreCombo(totals),
      });
    });
  });

  const combos = [...combosMap.values()];
  if (!combos.length) {
    if (!allowFallback) return [];
    const fallbackCombos = [...fallbackMap.values()];
    if (!fallbackCombos.length) return [];
    const sortedFallback = fallbackCombos.sort((a, b) => a.score - b.score);
    return sortedFallback.slice(0, MAX_POOL);
  }
  const sorted = combos.sort((a, b) => a.score - b.score);
  return sorted.slice(0, MAX_POOL);
};

const buildProteinCombos = (targetProtein, filters) => {
  const STEP = targetProtein >= 100 ? 10 : 20;
  const MIN_GRAMS = 30;
  const MAX_GRAMS = 600;
  const BASE_TOLERANCE = 5;
  const MAX_POOL = 60;
  const target = { protein: targetProtein, fat: null, carb: null };

  const candidates = prefilterFoods(
    filters,
    { protein: targetProtein, fat: null, carb: null },
    20
  );
  const sources = candidates
    .filter((item) => item.protein > 0)
    .map((item) => ({
      id: item.id,
      name: getFoodName(item),
      nameIT: item.name_IT,
      proteinPer100: item.protein,
      image: item.image,
      category: item.category,
      fatPer100: item.fat,
      carbPer100: item.carb,
    }));

  const combosMap = new Map();
  const comboKey = (items) =>
    items
      .map((item) => item.id || item.nameIT || item.name)
      .sort()
      .join("|");
  const addBest = (map, combo) => {
    const key = comboKey(combo.items);
    const existing = map.get(key);
    if (!existing || combo.score < existing.score) {
      map.set(key, combo);
    }
  };

  const shouldStop = () => combosMap.size >= MAX_POOL;

  // 1 alimento
  sources.forEach((a) => {
    if (shouldStop()) return;
    if (isOliveOilItem(a)) return;
    const bounds = getGramsBounds(a, MIN_GRAMS, MAX_GRAMS, STEP);
    const grams = clamp(
      roundToStep((targetProtein / a.proteinPer100) * 100, bounds.step),
      bounds.min,
      bounds.max
    );
    if (grams < bounds.min || grams > bounds.max) return;
    const items = [{ ...a, grams }];
    if (!isWithinItemKcalLimit(a, grams)) return;
    const totalProtein = (a.proteinPer100 * grams) / 100;
    const tolerance = targetProtein >= 150 ? 25 : targetProtein >= 100 ? 15 : BASE_TOLERANCE;
    if (Math.abs(totalProtein - targetProtein) <= tolerance) {
      const totalFat = (a.fatPer100 * grams) / 100;
      const totalCarb = (a.carbPer100 * grams) / 100;
      const totalKcal = calcKcal(totalProtein, totalFat, totalCarb);
      addBest(combosMap, {
        items,
        totalProtein,
        totalFat,
        totalCarb,
        totalKcal,
        score: Math.abs(totalProtein - targetProtein),
      });
    }
  });

  const combos = [...combosMap.values()];
  const sorted = combos.sort((a, b) => a.score - b.score);
  return sorted.slice(0, MAX_POOL);
};

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const toNumberOrNull = (value) => {
    if (value === "") return null;
    const numberValue = Number(value);
    if (numberValue === 0) return null;
    return numberValue;
  };
  const clampInput = (value) =>
    value === null ? null : Math.min(Math.max(value, 0), 100);
  const target = {
    protein: clampInput(toNumberOrNull(document.querySelector("#protein").value)),
    fat: clampInput(toNumberOrNull(document.querySelector("#fat").value)),
    carb: clampInput(toNumberOrNull(document.querySelector("#carb").value)),
  };
  const macroType = target.protein !== null
    ? "protein"
    : target.fat !== null
    ? "fat"
    : target.carb !== null
    ? "carb"
    : "none";
  trackEvent("match_foods_click", {
    event_category: "engagement",
    macro_type: macroType,
  });
  const filters = {
    avoidMeat: document.querySelector("#avoid-meat")?.checked ?? false,
    avoidFish: document.querySelector("#avoid-fish")?.checked ?? false,
    avoidJunk: document.querySelector("#avoid-junk")?.checked ?? false,
  };

  if (!foods.length) {
    renderEmpty("error_db");
    resultsCount.textContent = t("results_none");
    const betaSection = document.querySelector("#beta-section");
    if (betaSection) betaSection.hidden = false;
    return;
  }

  const filledCount = [
    target.protein,
    target.fat,
    target.carb,
  ].filter((value) => value !== null).length;
  const hasAnyMacro = filledCount > 0;

  if (!hasAnyMacro) {
    renderEmpty("empty_no_macro");
    resultsCount.textContent = t("results_none");
    const betaSection = document.querySelector("#beta-section");
    if (betaSection) betaSection.hidden = false;
    return;
  }

  if (filledCount > 1) {
    renderEmpty("empty_one_macro");
    resultsCount.textContent = t("results_none");
    const betaSection = document.querySelector("#beta-section");
    if (betaSection) betaSection.hidden = false;
    return;
  }

  const isProteinOnly =
    target.protein !== null && target.fat === null && target.carb === null;

  if (isProteinOnly) {
    const combos = buildProteinCombos(target.protein, filters);
    if (combos.length) {
      renderCombos(combos);
      return;
    }
    const matches = matchFoods(target, filters);
    renderMatches(matches);
    return;
  }

  const providedMacros = [
    target.protein,
    target.fat,
    target.carb,
  ].filter((value) => value !== null).length;
  const allowFallback = providedMacros <= 1;

  const combos = buildMacroCombos(target, filters, allowFallback);
  if (combos.length) {
    renderCombos(combos);
    return;
  }

  const matches = matchFoods(target, filters);
  renderMatches(matches);
});

fetch("data.json")
  .then((response) => response.json())
  .then((data) => {
    foods = data;
  })
  .catch(() => {
    renderEmpty("error_db");
  });

const initI18n = () => {
  fetch("i18n.json")
    .then((response) => response.json())
    .then((data) => {
      translations = data;
      currentLang = getDefaultLang();
      const langSelect = document.querySelector("#lang");
      if (langSelect) {
        langSelect.value = currentLang;
        langSelect.addEventListener("change", () => {
          currentLang = langSelect.value;
          document.documentElement.lang = currentLang;
          applyLanguage();
          if (form) form.requestSubmit();
        });
      }
      document.documentElement.lang = currentLang;
      applyLanguage();
    })
    .catch(() => {
      currentLang = getDefaultLang();
      document.documentElement.lang = currentLang;
      applyLanguage();
    });
};

initI18n();

const betaForm = document.querySelector("#beta-form");
const betaEmailInput = document.querySelector("#beta-email");
const betaMessageInput = document.querySelector("#beta-message");
const betaError = document.querySelector("#beta-error");
const betaModal = document.querySelector("#beta-modal");
const betaClose = document.querySelector("#beta-close");
const betaSubmit = document.querySelector("#beta-submit");
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const setBetaError = (key) => {
  if (!betaError) return;
  if (!key) {
    betaError.textContent = "";
    betaError.removeAttribute("data-i18n");
    return;
  }
  betaError.setAttribute("data-i18n", key);
  betaError.textContent = t(key);
};

const openBetaModal = () => {
  if (!betaModal) return;
  betaModal.hidden = false;
  betaModal.classList.add("is-visible");
};

const closeBetaModal = () => {
  if (!betaModal) return;
  betaModal.classList.remove("is-visible");
  betaModal.hidden = true;
};

const syncBetaButtonState = () => {
  if (!betaSubmit || !betaEmailInput) return;
  const email = betaEmailInput.value.trim();
  const isLoading = betaSubmit.classList.contains("is-loading");
  const isValid = email.length > 0 && emailRegex.test(email);
  betaSubmit.disabled = !isValid || isLoading;
};

const validateBetaEmail = () => {
  if (!betaEmailInput) return false;
  const email = betaEmailInput.value.trim();
  if (!email) {
    setBetaError("");
    betaEmailInput.classList.remove("is-invalid");
    return false;
  }
  if (!emailRegex.test(email)) {
    setBetaError("beta_invalid_email");
    betaEmailInput.classList.add("is-invalid");
    return false;
  }
  setBetaError("");
  betaEmailInput.classList.remove("is-invalid");
  return true;
};

if (betaClose) {
  betaClose.addEventListener("click", closeBetaModal);
}

if (betaModal) {
  betaModal.addEventListener("click", (event) => {
    if (event.target === betaModal) closeBetaModal();
  });
}

if (betaForm && betaEmailInput) {
  syncBetaButtonState();
  betaEmailInput.addEventListener("input", () => {
    validateBetaEmail();
    syncBetaButtonState();
  });
  betaEmailInput.addEventListener("blur", () => {
    validateBetaEmail();
    syncBetaButtonState();
  });
  betaForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!validateBetaEmail()) {
      trackEvent("beta_email_invalid", { event_category: "engagement" });
      return;
    }

    const email = betaEmailInput.value.trim();
    trackEvent("beta_email_submit", { event_category: "engagement" });
    if (betaSubmit) {
      betaSubmit.disabled = true;
      betaSubmit.classList.add("is-loading");
      betaSubmit.textContent = t("beta_sending");
    }
    betaEmailInput.disabled = true;
    if (betaMessageInput) betaMessageInput.disabled = true;

    const feedback = betaMessageInput ? betaMessageInput.value.trim() : "";

    const payload = new FormData();
    payload.append("email", email);
    payload.append(
      "message",
      `Email: ${email}\nDate: ${new Date().toLocaleString()}\nFeedback: ${
        feedback || "-"
      }`
    );
    payload.append("_subject", "MacroMatch Beta Signup");
    payload.append("_captcha", "false");

    fetch("https://formsubmit.co/ajax/macromatchtool@gmail.com", {
      method: "POST",
      headers: { Accept: "application/json" },
      body: payload,
    })
      .then((response) => {
        if (!response.ok) throw new Error("submit_failed");
        betaEmailInput.value = "";
        if (betaMessageInput) betaMessageInput.value = "";
        openBetaModal();
        trackEvent("beta_email_success", { event_category: "engagement" });
      })
      .catch(() => {
        setBetaError("beta_error");
        trackEvent("beta_email_error", { event_category: "engagement" });
      })
      .finally(() => {
        betaEmailInput.disabled = false;
        if (betaMessageInput) betaMessageInput.disabled = false;
        if (betaSubmit) {
          betaSubmit.disabled = false;
          betaSubmit.classList.remove("is-loading");
          betaSubmit.textContent = t("beta_submit");
        }
        betaEmailInput.classList.remove("is-invalid");
        syncBetaButtonState();
      });
  });
}
