const form = document.querySelector("#macro-form");
const resultsGrid = document.querySelector("#results");
const resultsCount = document.querySelector("#results-count");

const MAX_VISIBLE_RESULTS = 3;

let foods = [];
let lastResultsType = null;
let lastCombos = [];
let lastVisibleCombos = [];
let lastMatches = [];
let lastEmptyKey = null;

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

const getComboItemName = (item) => {
  if (item.nameIT && item.name_EN && item.name_ES) {
    if (currentLang === "it") return item.nameIT;
    if (currentLang === "es") return item.name_ES;
    return item.name_EN;
  }
  if (item.id && foods.length) {
    const source = foods.find((food) => food.id === item.id);
    if (source) return getFoodName(source);
  }
  return item.name || item.nameIT || item.name_IT || "";
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
  lastResultsType = "empty";
  lastEmptyKey = key;
  lastCombos = [];
  lastVisibleCombos = [];
  lastMatches = [];
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

const renderStoredResults = () => {
  if (lastResultsType === "combos" && lastVisibleCombos.length) {
    renderCombos(lastVisibleCombos, { preserveSelection: true });
    return;
  }
  if (lastResultsType === "matches" && lastMatches.length) {
    renderMatches(lastMatches);
    return;
  }
  if (lastResultsType === "empty" && lastEmptyKey) {
    renderEmpty(lastEmptyKey);
    resultsCount.textContent = t("results_none");
    const betaSection = document.querySelector("#beta-section");
    if (betaSection) betaSection.hidden = false;
  }
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
  lastResultsType = "matches";
  lastMatches = items;
  lastCombos = [];
  lastVisibleCombos = [];
  lastEmptyKey = null;
};

const renderCombos = (combos, options = {}) => {
  const { preserveSelection = false } = options;
  resultsGrid.innerHTML = "";
  const betaSection = document.querySelector("#beta-section");

  if (!combos.length) {
    renderEmpty("empty_no_combos");
    resultsCount.textContent = t("results_none");
    if (betaSection) betaSection.hidden = false;
    return;
  }

  const visibleCombos =
    preserveSelection && lastVisibleCombos.length
      ? lastVisibleCombos
      : getRotatedCombos(combos, MAX_VISIBLE_RESULTS);
  const total = visibleCombos.length;
  if (!preserveSelection) {
    lastResultsType = "combos";
    lastCombos = combos;
    lastVisibleCombos = visibleCombos;
    lastMatches = [];
    lastEmptyKey = null;
  }
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
              const displayName = getComboItemName(item);
              const protein = ((item.proteinPer100 * item.grams) / 100).toFixed(1);
              const fat = ((item.fatPer100 * item.grams) / 100).toFixed(1);
              const carb = ((item.carbPer100 * item.grams) / 100).toFixed(1);
              const kcal = calcKcal(Number(protein), Number(fat), Number(carb)).toFixed(0);
              return `
                <li class="combo-item">
                  <img src="${item.image}" alt="${displayName}" />
                  <div>
                    <div class="combo-item__title">${displayName}</div>
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
macroInputs.forEach((selector) => {
  const input = document.querySelector(selector);
  if (!input) return;
  input.addEventListener("input", () => enforceInputLimit(input));
  input.addEventListener("blur", () => enforceInputLimit(input));
});

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
    score += target.protein === 0 ? item.protein : Math.abs(item.protein - target.protein);
  }
  if (target.fat !== null) {
    score += target.fat === 0 ? item.fat : Math.abs(item.fat - target.fat);
  }
  if (target.carb !== null) {
    score += target.carb === 0 ? item.carb : Math.abs(item.carb - target.carb);
  }
  return score;
};

const prefilterFoods = (filters, target, limit = 12) => {
  const filtered = applyCategoryFilters(foods, filters);
  if (!target) return filtered;
  const activeKeys = ["protein", "fat", "carb"].filter(
    (key) => target[key] !== null
  );
  if (activeKeys.length > 1) return filtered;
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


const buildMacroCombos = (target, filters) => {
  const STEP = 20;
  const MIN_GRAMS = 30;
  const MAX_GRAMS = 500;
  const MAX_POOL = 60;

  const targetKeys = ["protein", "fat", "carb"].filter(
    (key) => target[key] !== null
  );
  if (!targetKeys.length) return [];

  const proteinOnly =
    target.protein !== null && target.fat === null && target.carb === null;
  const prefilterLimit = proteinOnly ? 20 : 12;
  const candidates = prefilterFoods(filters, target, prefilterLimit);
  const sources = [...candidates]
    .filter((item) => item.protein > 0 || item.fat > 0 || item.carb > 0)
    .map((item) => ({
      id: item.id,
      name: getFoodName(item),
      nameIT: item.name_IT,
      name_EN: item.name_EN,
      name_ES: item.name_ES,
      image: item.image,
      category: item.category,
      proteinPer100: item.protein,
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

  const withinRange = (totals) => {
    return targetKeys.every((key) => {
      const targetValue = target[key];
      const totalValue =
        key === "protein"
          ? totals.totalProtein
          : key === "fat"
          ? totals.totalFat
          : totals.totalCarb;
      if (targetValue <= 10) {
        const min = Math.max(0, targetValue - 10);
        const max = targetValue + 10;
        return totalValue >= min && totalValue <= max;
      }
      const min = targetValue * 0.8;
      const max = targetValue * 1.2;
      return totalValue >= min && totalValue <= max;
    });
  };

  const shouldStop = () => combosMap.size >= MAX_POOL;

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
      if (!withinRange(totals)) return;
      addBest(combosMap, {
        items,
        ...totals,
        score: scoreCombo(totals),
      });
    });
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
    return numberValue;
  };
  const clampInput = (value) =>
    value === null ? null : Math.min(Math.max(value, 0), 100);
  const target = {
    protein: clampInput(toNumberOrNull(document.querySelector("#protein").value)),
    fat: clampInput(toNumberOrNull(document.querySelector("#fat").value)),
    carb: clampInput(toNumberOrNull(document.querySelector("#carb").value)),
  };
  const selectedMacros = ["protein", "fat", "carb"].filter(
    (key) => target[key] !== null
  );
  const macroType =
    selectedMacros.length > 1
      ? "multi"
      : selectedMacros[0] || "none";
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

  const combos = buildMacroCombos(target, filters);
  if (combos.length) {
    renderCombos(combos);
    return;
  }

  renderEmpty("empty_no_combos");
  resultsCount.textContent = t("results_none");
  const betaSection = document.querySelector("#beta-section");
  if (betaSection) betaSection.hidden = false;
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
          renderStoredResults();
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
