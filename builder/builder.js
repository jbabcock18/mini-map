import {
  buildPlaceById,
  categoryLabel,
  categoryPillClass,
  categoryToneClass,
  descriptorForPlace,
  getConfig,
  getDefaultCenter,
  getPlacesCatalog,
  normalizePlaceIds,
} from "../shared/catalog.js";
import {
  distanceKm,
  estimateDurationMin,
  estimateWalkingTimeMin,
  formatDistanceMiles,
  formatMinutes,
  routeDistanceKm,
} from "../shared/metrics.js";
import {
  buildSharePayload,
  createRunId,
  createRunRecord,
  defaultPlanTitle,
  defaultVibe,
  parseSharePayload,
} from "../shared/run-model.js";
import {
  appendHistoryRun,
  loadPlanMeta,
  loadPublishedRuns,
  loadSavedRuns,
  loadSidebarHidden,
  migrateStorageV1toV2,
  persistPlanMeta,
  persistSidebarHidden,
  renameSavedRun,
  upsertPublishedRun,
  upsertSavedRun,
} from "../shared/storage.js";
import {
  buildBuilderShareUrl,
  parseSharePayloadFromSearch,
} from "../shared/share-link.js";
import { annRoyButlerTrailGeojson } from "../data/trails.js";

const config = getConfig();
const placesCatalog = getPlacesCatalog();
const placeById = buildPlaceById(placesCatalog);

migrateStorageV1toV2(placeById);

const appShell = document.querySelector(".app-shell");
const mapElement = document.getElementById("map");
const sidebarToggleButton = document.getElementById("sidebar-toggle");
const sidebarBuilderButton = document.getElementById("sidebar-builder-btn");
const sidebarDiscoverButton = document.getElementById("sidebar-discover-btn");
const builderSidebarView = document.getElementById("builder-sidebar-view");
const discoverSidebarView = document.getElementById("discover-sidebar-view");

const planTitleDisplay = document.getElementById("plan-title-display");
const planTitleInput = document.getElementById("plan-title-input");
const vibeDisplay = document.getElementById("vibe-display");
const vibeInput = document.getElementById("vibe-input");
const headerShareButton = document.getElementById("header-share-btn");
const headerSaveButton = document.getElementById("header-save-btn");
const editToggleButton = document.getElementById("edit-toggle-btn");

const statDistance = document.getElementById("stat-distance");
const statWalking = document.getElementById("stat-walking");
const statStops = document.getElementById("stat-stops");

const timelineList = document.getElementById("timeline-list");
const addStopInlineButton = document.getElementById("add-stop-inline-btn");
const optimizeOrderButton = document.getElementById("optimize-order-btn");
const catalogCategoryFilters = document.getElementById("catalog-category-filters");

const sharePlanButton = document.getElementById("share-plan-btn");
const copySummaryButton = document.getElementById("copy-summary-btn");
const copyLinkButton = document.getElementById("copy-link-btn");
const downloadCardButton = document.getElementById("download-card-btn");

const mapQuestCard = document.getElementById("map-quest-card");
const mapQuestList = document.getElementById("map-quest-list");
const mapQuestEmpty = document.getElementById("map-quest-empty");

const toast = document.getElementById("toast");

const addStopModal = document.getElementById("add-stop-modal");
const closeAddStopModalButton = document.getElementById("close-add-stop-modal");
const addTabSearchButton = document.getElementById("add-tab-search");
const addTabCuratedButton = document.getElementById("add-tab-curated");
const addTabNearbyButton = document.getElementById("add-tab-nearby");
const addSearchRow = document.getElementById("add-search-row");
const addStopSearchInput = document.getElementById("add-stop-search");
const addResults = document.getElementById("add-results");

const saveModal = document.getElementById("save-modal");
const closeSaveModalButton = document.getElementById("close-save-modal");
const saveTitleInput = document.getElementById("save-title-input");
const savePublishToggle = document.getElementById("save-publish-toggle");
const saveConfirmButton = document.getElementById("save-confirm-btn");

const shareModal = document.getElementById("share-modal");
const closeShareModalButton = document.getElementById("close-share-modal");
const sharePreview = document.getElementById("share-preview");
const modalCopyLinkButton = document.getElementById("modal-copy-link-btn");
const modalCopySummaryButton = document.getElementById("modal-copy-summary-btn");
const modalCopyPartifulButton = document.getElementById("modal-copy-partiful-btn");
const modalNativeShareButton = document.getElementById("modal-native-share-btn");

const runOfDayTitleSidebar = document.getElementById("run-of-day-title-sidebar");
const runOfDayMetaSidebar = document.getElementById("run-of-day-meta-sidebar");
const previewRunOfDaySidebarButton = document.getElementById("preview-run-of-day-sidebar");
const useRunOfDaySidebarButton = document.getElementById("use-run-of-day-sidebar");
const saveRunOfDaySidebarButton = document.getElementById("save-run-of-day-sidebar");
const randomRunSidebarButton = document.getElementById("random-run-sidebar-btn");
const randomRunSidebarPreview = document.getElementById("random-run-sidebar-preview");
const savedRunsSidebarList = document.getElementById("saved-runs-sidebar-list");
const communityRunsSidebarList = document.getElementById("community-runs-sidebar-list");

if (!config.accessToken) {
  showToast("Missing MAPBOX_CONFIG access token.");
  throw new Error("MAPBOX_CONFIG.accessToken is missing");
}

if (!placesCatalog.length) {
  showToast("No fitness locations found in catalog.");
}

mapboxgl.accessToken = config.accessToken;

const planMeta = loadPlanMeta();
const payloadRun = loadSharedRunFromUrl();

const initialPlaceIds = payloadRun?.placeIds?.length
  ? payloadRun.placeIds
  : normalizePlaceIds(config.defaultRun || [], placeById);

const state = {
  runPlaceIds: initialPlaceIds,
  mode: "view",
  sidebarView: "builder",
  routeDistanceKm: null,
  sidebarHidden: loadSidebarHidden(),
  planTitle: payloadRun?.title || planMeta.title || defaultPlanTitle(),
  vibe: payloadRun?.vibe || planMeta.vibe || defaultVibe(),
  notesByPlaceId: planMeta.notesByPlaceId || {},
  addStopTab: "search",
  addStopSearch: "",
  addStopInsertIndex: null,
  catalogCategoryFilter: "all",
  hydratedFromPayload: Boolean(payloadRun),
  payloadSource: payloadRun?.source || "builder-default",
  discoverPreviewPlaceIds: [],
  discoverData: {
    curatedRuns: [],
    runOfDay: null,
    randomLastRun: null,
    randomPool: [],
  },
};

let toastTimeoutId = null;
let lastRunSignature = "";
let routeRequestSeq = 0;
let previewRouteRequestSeq = 0;
let routeDebounceHandle = null;
let sidebarResizeTimeoutId = null;
let mapResizeAnimationFrame = null;
const routeCache = new Map();
const CATALOG_FILTER_CATEGORIES = new Set(["calisthenics", "track", "trail", "hill", "stairs"]);

function showToast(message) {
  if (!toast || !message) return;
  toast.textContent = message;
  toast.classList.remove("hidden");
  if (toastTimeoutId) {
    clearTimeout(toastTimeoutId);
  }
  toastTimeoutId = window.setTimeout(() => {
    toast.classList.add("hidden");
  }, 2200);
}

function isAllowedCatalogFilter(value) {
  return value === "all" || CATALOG_FILTER_CATEGORIES.has(value);
}

function getFilteredCatalogPlaces() {
  if (!isAllowedCatalogFilter(state.catalogCategoryFilter) || state.catalogCategoryFilter === "all") {
    return placesCatalog;
  }
  return placesCatalog.filter((place) => place.category === state.catalogCategoryFilter);
}

function renderCatalogCategoryFilters() {
  if (!catalogCategoryFilters) return;
  const activeCategory = isAllowedCatalogFilter(state.catalogCategoryFilter)
    ? state.catalogCategoryFilter
    : "all";
  catalogCategoryFilters.querySelectorAll("[data-category]").forEach((button) => {
    if (!(button instanceof HTMLButtonElement)) return;
    button.classList.toggle("is-active", button.dataset.category === activeCategory);
  });
}

function setCatalogCategoryFilter(nextCategory) {
  const normalized = typeof nextCategory === "string" ? nextCategory : "all";
  state.catalogCategoryFilter = isAllowedCatalogFilter(normalized) ? normalized : "all";
  renderCatalogCategoryFilters();
  updateMapSources();
  if (!addStopModal.classList.contains("hidden")) {
    renderAddStopResults();
  }
  if (!getRunPlaces().length) {
    fitRouteOrCatalog();
  }
}

function loadSharedRunFromUrl() {
  const payload = parseSharePayloadFromSearch(window.location.search);
  const parsed = parseSharePayload(payload, placeById);
  return parsed;
}

function persistCurrentPlanMeta() {
  persistPlanMeta({
    title: state.planTitle,
    vibe: state.vibe,
    notesByPlaceId: state.notesByPlaceId,
  });
}

function runSignature(placeIds) {
  return placeIds.join("|");
}

function dateKeyLocal() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function hashStringToSeed(input) {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function selectRunOfDay(runs) {
  if (!runs.length) return null;
  const index = hashStringToSeed(dateKeyLocal()) % runs.length;
  return runs[index];
}

function pickRandomRun(runs) {
  if (!runs.length) return null;
  return runs[Math.floor(Math.random() * runs.length)];
}

function createRunFromIds({ id, title, vibe, placeIds, source, isFeatured = false, isPublished = false }) {
  const normalizedIds = normalizePlaceIds(placeIds || [], placeById);
  if (!normalizedIds.length) return null;
  return createRunRecord(
    {
      id,
      title,
      vibe,
      placeIds: normalizedIds,
      source,
      isFeatured,
      isPublished,
      createdAt: new Date().toISOString(),
    },
    placeById
  );
}

async function loadCuratedRuns() {
  try {
    const response = await fetch("/data/curated-runs.json", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Curated runs request failed (${response.status})`);
    }
    const payload = await response.json();
    const rawRuns = Array.isArray(payload?.runs) ? payload.runs : [];
    return rawRuns
      .map((run, index) => {
        const normalizedIds = normalizePlaceIds(run.placeIds || [], placeById);
        if (!normalizedIds.length) return null;
        const record = createRunRecord(
          {
            id: run.id || `curated-${index + 1}`,
            title: run.title || run.name || `Curated Route ${index + 1}`,
            vibe: run.vibe || defaultVibe(),
            placeIds: normalizedIds,
            source: "curated",
            isFeatured: Boolean(run.isFeatured),
            isPublished: Boolean(Array.isArray(run.tags) && run.tags.includes("community")),
            createdAt: run.createdAt || "2026-01-01T00:00:00.000Z",
          },
          placeById
        );
        if (!record) return null;
        return {
          ...record,
          tags: Array.isArray(run.tags) ? run.tags : [],
        };
      })
      .filter(Boolean);
  } catch (error) {
    console.warn("Failed to load curated runs:", error);
    return [];
  }
}

function loadConfigCommunityRuns() {
  const base = Array.isArray(config.communityRuns) ? config.communityRuns : [];
  return base
    .map((run, index) =>
      createRunFromIds({
        id: run.id || `community-${index + 1}`,
        title: run.title || run.name || `Community Route ${index + 1}`,
        vibe: run.vibe || defaultVibe(),
        placeIds: run.placeIds || [],
        source: "config-community",
        isFeatured: Boolean(run.isFeatured),
        isPublished: true,
      })
    )
    .filter(Boolean);
}

function runStatLine(run) {
  return `${run.placeIds.length} locations • ${formatDistanceMiles(run.distanceKm)} • ${formatMinutes(run.durationMin)}`;
}

function sortCommunityRuns(runs) {
  return [...runs].sort((a, b) => {
    if (a.isFeatured !== b.isFeatured) return a.isFeatured ? -1 : 1;
    const aTime = new Date(a.createdAt || 0).getTime();
    const bTime = new Date(b.createdAt || 0).getTime();
    return bTime - aTime;
  });
}

function getRunPlaces() {
  return state.runPlaceIds.map((id) => placeById.get(id)).filter(Boolean);
}

function categoryUpper(category) {
  return categoryLabel(category).toUpperCase();
}

function openModal(modalElement) {
  if (!modalElement) return;
  modalElement.classList.remove("hidden");
  modalElement.setAttribute("aria-hidden", "false");
}

function closeModal(modalElement) {
  if (!modalElement) return;
  modalElement.classList.add("hidden");
  modalElement.setAttribute("aria-hidden", "true");
}

function openAddStopModal(insertIndex = null) {
  state.addStopInsertIndex = Number.isInteger(insertIndex) ? insertIndex : null;
  openModal(addStopModal);
  renderAddStopResults();
  if (state.addStopTab === "search") {
    window.setTimeout(() => addStopSearchInput?.focus(), 40);
  }
}

function closeAddStopModal() {
  closeModal(addStopModal);
  state.addStopInsertIndex = null;
}

function openShareModal() {
  renderSharePreview();
  openModal(shareModal);
  recordRunInHistory("share");
}

function closeShareModal() {
  closeModal(shareModal);
}

function openSaveModal() {
  saveTitleInput.value = state.planTitle || defaultPlanTitle();
  savePublishToggle.checked = false;
  openModal(saveModal);
  window.setTimeout(() => saveTitleInput.focus(), 30);
}

function closeSaveModal() {
  closeModal(saveModal);
}

function renderPlanHeader() {
  const runPlaces = getRunPlaces();
  const fallbackDistance = routeDistanceKm(runPlaces);
  const resolvedDistance =
    runPlaces.length > 1 && Number.isFinite(state.routeDistanceKm)
      ? state.routeDistanceKm
      : fallbackDistance;

  planTitleDisplay.textContent = state.planTitle || defaultPlanTitle();
  planTitleInput.value = state.planTitle || defaultPlanTitle();
  vibeDisplay.textContent = state.vibe;
  vibeInput.value = state.vibe;

  statDistance.textContent = formatDistanceMiles(resolvedDistance);
  statWalking.textContent = formatMinutes(estimateWalkingTimeMin(resolvedDistance));
  statStops.textContent = String(runPlaces.length);

  const isEdit = state.mode === "edit";
  planTitleDisplay.classList.toggle("hidden", isEdit);
  vibeDisplay.classList.toggle("hidden", isEdit);
  planTitleInput.classList.toggle("hidden", !isEdit);
  vibeInput.classList.toggle("hidden", !isEdit);

  editToggleButton.textContent = state.mode === "edit" ? "Done" : "Edit";
  optimizeOrderButton.classList.toggle("hidden", !isEdit);
}

function renderLucideIcons() {
  if (!window.lucide || typeof window.lucide.createIcons !== "function") return;
  window.lucide.createIcons();
}

function createLucideNode(iconName, fallbackText = "") {
  const icon = document.createElement("i");
  icon.setAttribute("data-lucide", iconName);
  icon.setAttribute("aria-hidden", "true");
  if (fallbackText) {
    icon.textContent = fallbackText;
  }
  return icon;
}

function createIconButton(label, iconName, onClick, fallbackText = "") {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "icon-btn";
  button.title = label;
  button.setAttribute("aria-label", label);
  button.append(createLucideNode(iconName, fallbackText));
  button.addEventListener("click", onClick);
  return button;
}

async function copyText(text, successMessage) {
  if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
    try {
      await navigator.clipboard.writeText(text);
      showToast(successMessage);
      return true;
    } catch (error) {
      console.warn("Clipboard API copy failed, falling back:", error);
    }
  }

  const fallbackInput = document.createElement("textarea");
  fallbackInput.value = text;
  fallbackInput.setAttribute("readonly", "true");
  fallbackInput.style.position = "fixed";
  fallbackInput.style.left = "-9999px";
  fallbackInput.style.top = "0";
  document.body.append(fallbackInput);
  fallbackInput.focus();
  fallbackInput.select();

  let copied = false;
  try {
    copied = Boolean(document.execCommand("copy"));
  } catch (error) {
    console.warn("execCommand copy failed:", error);
  }

  fallbackInput.remove();

  if (copied) {
    showToast(successMessage);
    return true;
  }

  window.prompt("Copy manually:", text);
  showToast("Clipboard permission blocked. Manual copy opened.");
  return false;
}

function setMode(mode) {
  state.mode = mode === "edit" ? "edit" : "view";
  renderPlanHeader();
  renderTimeline();
}

function setSidebarView(view) {
  state.sidebarView = view === "discover" ? "discover" : "builder";
  const isDiscover = state.sidebarView === "discover";
  sidebarBuilderButton?.classList.toggle("is-active", !isDiscover);
  sidebarDiscoverButton?.classList.toggle("is-active", isDiscover);
  builderSidebarView?.classList.toggle("hidden", isDiscover);
  discoverSidebarView?.classList.toggle("hidden", !isDiscover);

  if (!isDiscover) {
    clearDiscoverPreview();
  } else {
    void refreshDiscoverData();
  }

  resizeMapAfterLayoutChange();
}

function setSidebarHidden(hidden) {
  state.sidebarHidden = Boolean(hidden);
  appShell.classList.toggle("sidebar-hidden", state.sidebarHidden);
  sidebarToggleButton.textContent = state.sidebarHidden ? "Show Sidebar" : "Hide Sidebar";
  persistSidebarHidden(state.sidebarHidden);
  resizeMapAfterLayoutChange();
  renderMapQuest();
}

function moveStop(fromIndex, toIndex) {
  if (fromIndex === toIndex) return;
  if (fromIndex < 0 || toIndex < 0) return;
  if (fromIndex >= state.runPlaceIds.length || toIndex >= state.runPlaceIds.length) return;

  const copy = [...state.runPlaceIds];
  const [moved] = copy.splice(fromIndex, 1);
  copy.splice(toIndex, 0, moved);
  state.runPlaceIds = copy;
  syncState();
}

function swapAdjacent(index) {
  if (index < 0 || index >= state.runPlaceIds.length - 1) return;
  const copy = [...state.runPlaceIds];
  [copy[index], copy[index + 1]] = [copy[index + 1], copy[index]];
  state.runPlaceIds = copy;
  syncState();
}

function buildDistanceMatrix(places) {
  const n = places.length;
  const matrix = Array.from({ length: n }, () => Array(n).fill(0));
  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      const d = distanceKm(places[i].coordinates, places[j].coordinates);
      matrix[i][j] = d;
      matrix[j][i] = d;
    }
  }
  return matrix;
}

function shortestHamiltonianPathExact(distanceMatrix) {
  const n = distanceMatrix.length;
  if (n <= 1) return [0];

  const stateCount = 1 << n;
  const width = n;
  const dp = new Float64Array(stateCount * width);
  dp.fill(Number.POSITIVE_INFINITY);
  const parent = new Int16Array(stateCount * width);
  parent.fill(-1);

  const offset = (mask, end) => mask * width + end;

  for (let end = 0; end < n; end += 1) {
    dp[offset(1 << end, end)] = 0;
  }

  for (let mask = 1; mask < stateCount; mask += 1) {
    for (let end = 0; end < n; end += 1) {
      if ((mask & (1 << end)) === 0) continue;
      const prevMask = mask ^ (1 << end);
      if (prevMask === 0) continue;

      let best = Number.POSITIVE_INFINITY;
      let bestPrev = -1;

      for (let prev = 0; prev < n; prev += 1) {
        if ((prevMask & (1 << prev)) === 0) continue;
        const candidate = dp[offset(prevMask, prev)] + distanceMatrix[prev][end];
        if (candidate < best) {
          best = candidate;
          bestPrev = prev;
        }
      }

      const index = offset(mask, end);
      dp[index] = best;
      parent[index] = bestPrev;
    }
  }

  const fullMask = stateCount - 1;
  let bestEnd = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let end = 0; end < n; end += 1) {
    const total = dp[offset(fullMask, end)];
    if (total < bestDistance) {
      bestDistance = total;
      bestEnd = end;
    }
  }

  const order = [];
  let mask = fullMask;
  let end = bestEnd;
  while (end !== -1) {
    order.push(end);
    const prev = parent[offset(mask, end)];
    mask ^= 1 << end;
    end = prev;
  }
  order.reverse();
  return order;
}

function nearestNeighborOrder(distanceMatrix, startIndex) {
  const n = distanceMatrix.length;
  const visited = new Array(n).fill(false);
  const order = [startIndex];
  visited[startIndex] = true;

  while (order.length < n) {
    const current = order[order.length - 1];
    let bestNext = -1;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (let next = 0; next < n; next += 1) {
      if (visited[next]) continue;
      const d = distanceMatrix[current][next];
      if (d < bestDistance) {
        bestDistance = d;
        bestNext = next;
      }
    }

    visited[bestNext] = true;
    order.push(bestNext);
  }

  return order;
}

function pathDistanceFromMatrix(order, distanceMatrix) {
  let total = 0;
  for (let i = 0; i < order.length - 1; i += 1) {
    total += distanceMatrix[order[i]][order[i + 1]];
  }
  return total;
}

function twoOptImprove(order, distanceMatrix) {
  const best = [...order];
  let improved = true;

  while (improved) {
    improved = false;
    for (let i = 1; i < best.length - 2; i += 1) {
      for (let k = i + 1; k < best.length - 1; k += 1) {
        const a = best[i - 1];
        const b = best[i];
        const c = best[k];
        const d = best[k + 1];
        const currentCost = distanceMatrix[a][b] + distanceMatrix[c][d];
        const swappedCost = distanceMatrix[a][c] + distanceMatrix[b][d];
        if (swappedCost + 1e-9 < currentCost) {
          const reversed = best.slice(i, k + 1).reverse();
          best.splice(i, k - i + 1, ...reversed);
          improved = true;
        }
      }
    }
  }

  return best;
}

function shortestPathOrder(distanceMatrix) {
  const n = distanceMatrix.length;
  if (n <= 1) return [0];
  if (n <= 12) {
    return shortestHamiltonianPathExact(distanceMatrix);
  }

  let bestOrder = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (let start = 0; start < n; start += 1) {
    const seeded = nearestNeighborOrder(distanceMatrix, start);
    const improved = twoOptImprove(seeded, distanceMatrix);
    const total = pathDistanceFromMatrix(improved, distanceMatrix);
    if (total < bestDistance) {
      bestDistance = total;
      bestOrder = improved;
    }
  }

  return bestOrder || nearestNeighborOrder(distanceMatrix, 0);
}

function optimizeRunOrder() {
  const runPlaces = getRunPlaces();
  if (runPlaces.length < 3) {
    showToast("Need at least 3 locations to optimize order.");
    return;
  }

  const beforeDistance = routeDistanceKm(runPlaces);
  const distanceMatrix = buildDistanceMatrix(runPlaces);
  const order = shortestPathOrder(distanceMatrix);
  const optimized = order.map((idx) => runPlaces[idx]);

  state.runPlaceIds = optimized.map((place) => place.id);
  syncState();
  fitRouteOrCatalog();

  const afterDistance = routeDistanceKm(optimized);
  const savings = Math.max(0, beforeDistance - afterDistance);
  if (savings > 0.01) {
    showToast(`Optimized order and saved ${formatDistanceMiles(savings)}.`);
  } else {
    showToast("Optimized order.");
  }
}

function renderTimeline() {
  timelineList.innerHTML = "";
  const runPlaces = getRunPlaces();

  if (!runPlaces.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.innerHTML =
      '<p>No locations yet. Add one to start your route.</p><button id="empty-add-stop" class="solid-btn" type="button">+ Add location</button>';
    timelineList.append(empty);
    const emptyButton = empty.querySelector("#empty-add-stop");
    emptyButton?.addEventListener("click", () => openAddStopModal(null));
    return;
  }

  runPlaces.forEach((place, index) => {
    const card = document.createElement("article");
    card.className = "timeline-card";
    card.classList.toggle("is-edit", state.mode === "edit");
    card.dataset.placeId = place.id;
    card.dataset.index = String(index);
    card.draggable = state.mode === "edit";

    const left = document.createElement("div");
    left.className = `stop-index ${categoryToneClass(place.category)}`;
    left.textContent = String(index + 1);

    const main = document.createElement("div");
    main.className = "stop-main";

    const topRow = document.createElement("div");
    topRow.className = "stop-top-row";

    const labelPill = document.createElement("span");
    labelPill.className = categoryPillClass(place.category);
    labelPill.textContent = categoryUpper(place.category);
    topRow.append(labelPill);

    const title = document.createElement("h3");
    title.textContent = place.name;

    const meta = document.createElement("p");
    meta.className = "stop-meta";
    meta.textContent = place.address || "No address";

    main.append(topRow, title, meta);

    if (state.mode === "edit") {
      const noteInput = document.createElement("input");
      noteInput.type = "text";
      noteInput.className = "note-input";
      noteInput.placeholder = "Add note (e.g. take a tequila shot)";
      noteInput.value = state.notesByPlaceId[place.id] || "";
      noteInput.addEventListener("change", (event) => {
        state.notesByPlaceId[place.id] = event.target.value || "";
        persistCurrentPlanMeta();
        renderMapQuest();
      });
      main.append(noteInput);
    } else if (state.notesByPlaceId[place.id]) {
      const note = document.createElement("p");
      note.className = "stop-note";
      note.textContent = state.notesByPlaceId[place.id];
      main.append(note);
    }

    if (state.mode === "edit") {
      const actions = document.createElement("div");
      actions.className = "stop-actions";

      const addAfterButton = createIconButton("Add after", "plus", () => {
        openAddStopModal(index + 1);
      }, "+");
      actions.append(addAfterButton);

      const removeButton = createIconButton("Remove location", "trash-2", () => {
        removePlaceFromPlan(place.id);
      }, "");
      removeButton.classList.add("danger");
      actions.append(removeButton);

      const dragHandle = document.createElement("span");
      dragHandle.className = "drag-handle";
      dragHandle.append(createLucideNode("grip-vertical", ""));
      actions.append(dragHandle);

      card.addEventListener("dragstart", (event) => {
        event.dataTransfer?.setData("text/plain", String(index));
        card.classList.add("dragging");
      });

      card.addEventListener("dragend", () => {
        card.classList.remove("dragging");
      });

      card.addEventListener("dragover", (event) => {
        event.preventDefault();
        card.classList.add("drag-over");
      });

      card.addEventListener("dragleave", () => {
        card.classList.remove("drag-over");
      });

      card.addEventListener("drop", (event) => {
        event.preventDefault();
        card.classList.remove("drag-over");
        const fromIndex = Number(event.dataTransfer?.getData("text/plain"));
        if (!Number.isInteger(fromIndex)) return;
        moveStop(fromIndex, index);
      });

      card.append(left, main, actions);
    } else {
      card.append(left, main);
    }

    timelineList.append(card);

    if (index < runPlaces.length - 1) {
      const nextPlace = runPlaces[index + 1];
      const segmentDistance = distanceKm(place.coordinates, nextPlace.coordinates);

      const segment = document.createElement("div");
      segment.className = "travel-segment";

      const segmentLabel = document.createElement("p");
      segmentLabel.textContent = `${formatDistanceMiles(segmentDistance)} between locations`;
      segment.append(segmentLabel);

      if (state.mode === "edit") {
        const segmentActions = document.createElement("div");
        segmentActions.className = "segment-actions";

        const swapButton = document.createElement("button");
        swapButton.type = "button";
        swapButton.className = "ghost-btn subtle";
        swapButton.textContent = "Swap route order";
        swapButton.addEventListener("click", () => swapAdjacent(index));

        const optimizeButton = document.createElement("button");
        optimizeButton.type = "button";
        optimizeButton.className = "ghost-btn subtle";
        optimizeButton.textContent = "Optimize";
        optimizeButton.addEventListener("click", optimizeRunOrder);

        segmentActions.append(swapButton, optimizeButton);
        segment.append(segmentActions);
      }

      timelineList.append(segment);
    }
  });

  renderLucideIcons();
}

function distanceFromAnchor(place) {
  const runPlaces = getRunPlaces();
  const anchor = runPlaces[runPlaces.length - 1] || { coordinates: getDefaultCenter() };
  return distanceKm(anchor.coordinates, place.coordinates);
}

function getAddStopResults() {
  const query = state.addStopSearch.trim().toLowerCase();
  const placesNotUsed = getFilteredCatalogPlaces().filter((place) => !state.runPlaceIds.includes(place.id));

  if (state.addStopTab === "search") {
    if (!query) return placesNotUsed.slice(0, 18);
    return placesNotUsed
      .filter((place) => {
        const haystack = `${place.name} ${place.address} ${place.category}`.toLowerCase();
        return haystack.includes(query);
      })
      .slice(0, 28);
  }

  if (state.addStopTab === "curated") {
    const categoryOrder = ["calisthenics", "track", "trail", "hill", "stairs"];
    const categorized = categoryOrder.flatMap((category) =>
      placesNotUsed.filter((place) => place.category === category).slice(0, 4)
    );
    const fallback = placesNotUsed
      .filter((place) => !categoryOrder.includes(place.category))
      .slice(0, 6);
    return [...categorized, ...fallback].slice(0, 20);
  }

  return [...placesNotUsed]
    .sort((a, b) => distanceFromAnchor(a) - distanceFromAnchor(b))
    .slice(0, 20);
}

function renderAddStopResults() {
  addResults.innerHTML = "";
  addSearchRow.classList.toggle("is-hidden", state.addStopTab !== "search");

  addTabSearchButton.classList.toggle("is-active", state.addStopTab === "search");
  addTabCuratedButton.classList.toggle("is-active", state.addStopTab === "curated");
  addTabNearbyButton.classList.toggle("is-active", state.addStopTab === "nearby");

  const results = getAddStopResults();
  if (!results.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state-text";
    empty.textContent = "No matching locations.";
    addResults.append(empty);
    return;
  }

  results.forEach((place) => {
    const card = document.createElement("article");
    card.className = "add-result-card";

    const textBlock = document.createElement("div");

    const top = document.createElement("div");
    top.className = "add-top";

    const pill = document.createElement("span");
    pill.className = categoryPillClass(place.category);
    pill.textContent = categoryUpper(place.category);

    const distanceText = document.createElement("span");
    distanceText.className = "distance-meta";
    distanceText.textContent = `${formatDistanceMiles(distanceFromAnchor(place))} from last location`;

    top.append(pill, distanceText);

    const title = document.createElement("h4");
    title.textContent = place.name;

    const descriptor = document.createElement("p");
    descriptor.className = "descriptor";
    descriptor.textContent = descriptorForPlace(place);

    textBlock.append(top, title, descriptor);

    const addButton = document.createElement("button");
    addButton.type = "button";
    addButton.className = "add-btn";
    addButton.textContent = "Add";
    addButton.addEventListener("click", () => {
      addPlaceToPlan(place.id, state.addStopInsertIndex);
      closeAddStopModal();
    });

    card.append(textBlock, addButton);
    card.addEventListener("click", (event) => {
      if (event.target instanceof HTMLButtonElement) return;
      map.flyTo({ center: place.coordinates, zoom: 14.2, duration: 700 });
    });

    addResults.append(card);
  });
}

function renderMapQuest() {
  mapQuestCard.classList.toggle("is-visible", state.sidebarHidden);
  const runPlaces = getRunPlaces();

  mapQuestList.innerHTML = "";
  mapQuestEmpty.classList.toggle("hidden", runPlaces.length > 0);

  runPlaces.forEach((place, index) => {
    const item = document.createElement("li");
    item.className = "quest-item";

    const indexNode = document.createElement("span");
    indexNode.className = `quest-index ${categoryToneClass(place.category)}`;
    indexNode.textContent = String(index + 1);

    const details = document.createElement("div");

    const title = document.createElement("h3");
    title.textContent = place.name;

    details.append(title);

    if (state.notesByPlaceId[place.id]) {
      const note = document.createElement("p");
      note.className = "quest-note";
      note.textContent = state.notesByPlaceId[place.id];
      details.append(note);
    }

    item.append(indexNode, details);
    mapQuestList.append(item);
  });
}

function getPlaceRecordsForIds(placeIds) {
  return normalizePlaceIds(placeIds || [], placeById)
    .map((id) => placeById.get(id))
    .filter(Boolean);
}

function previewRunOnMap(run) {
  if (!run || !Array.isArray(run.placeIds) || !run.placeIds.length) return;
  state.discoverPreviewPlaceIds = normalizePlaceIds(run.placeIds, placeById);
  updateDiscoverPreviewSources();
  void updateDiscoverPreviewRouteWithRoads();
  const previewPlaces = getPlaceRecordsForIds(state.discoverPreviewPlaceIds);
  const bounds = boundsForPlaces(previewPlaces);
  if (bounds) {
    map.fitBounds(bounds, { padding: 90, duration: 780, pitch: config.pitch ?? 58 });
  }
  showToast(`Previewing ${run.title}`);
}

function clearDiscoverPreview() {
  if (!state.discoverPreviewPlaceIds.length) return;
  state.discoverPreviewPlaceIds = [];
  previewRouteRequestSeq += 1;
  updateDiscoverPreviewSources();
}

function useRunFromDiscover(run, source) {
  if (!run || !Array.isArray(run.placeIds) || !run.placeIds.length) return;
  state.runPlaceIds = normalizePlaceIds(run.placeIds, placeById);
  state.planTitle = run.title || defaultPlanTitle();
  state.vibe = run.vibe || defaultVibe();
  persistCurrentPlanMeta();
  recordRunInHistory(`use:${source}`);
  setMode("view");
  setSidebarView("builder");
  syncState();
  fitRouteOrCatalog();
  showToast(`Loaded ${state.planTitle}`);
}

function saveRunFromDiscover(run, source = "discover") {
  if (!run || !Array.isArray(run.placeIds) || !run.placeIds.length) return;
  const saveId =
    typeof run.id === "string" && run.id.trim()
      ? `saved-ref-${run.id.trim()}`
      : createRunId("saved-ref");

  const savedRun = createRunRecord(
    {
      id: saveId,
      title: run.title || defaultPlanTitle(),
      vibe: run.vibe || defaultVibe(),
      placeIds: normalizePlaceIds(run.placeIds, placeById),
      source: `saved:${source}`,
      isPublished: false,
    },
    placeById
  );

  upsertSavedRun(savedRun, placeById);
  recordRunInHistory(`save:${source}`);
  requestDiscoverRefresh();
  showToast(`Saved ${savedRun.title}`);
}

function createDiscoverRunCard(
  run,
  { allowRename = false, showSave = false, source = "discover" } = {}
) {
  const card = document.createElement("article");
  card.className = "run-card discover-run-card";

  const top = document.createElement("div");
  top.className = "run-card-top";

  const title = document.createElement("h4");
  title.textContent = run.title;
  top.append(title);

  if (run.isFeatured) {
    const badge = document.createElement("span");
    badge.className = "vote-count";
    badge.textContent = "Featured";
    top.append(badge);
  }

  const meta = document.createElement("p");
  meta.textContent = runStatLine(run);

  const actions = document.createElement("div");
  actions.className = "run-card-actions";

  const previewBtn = document.createElement("button");
  previewBtn.type = "button";
  previewBtn.className = "load-btn";
  previewBtn.textContent = "Preview";
  previewBtn.addEventListener("click", () => previewRunOnMap(run));

  const useBtn = document.createElement("button");
  useBtn.type = "button";
  useBtn.className = "load-btn vote-btn";
  useBtn.textContent = "Use this route";
  useBtn.addEventListener("click", () => useRunFromDiscover(run, source));

  actions.append(previewBtn, useBtn);

  if (showSave) {
    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "load-btn";
    saveBtn.textContent = "Save";
    saveBtn.addEventListener("click", () => saveRunFromDiscover(run, source));
    actions.append(saveBtn);
  }

  if (allowRename) {
    const renameBtn = document.createElement("button");
    renameBtn.type = "button";
    renameBtn.className = "load-btn";
    renameBtn.textContent = "Rename";
    renameBtn.addEventListener("click", () => {
      const next = window.prompt("Rename saved route", run.title);
      if (!next || !next.trim()) return;
      renameSavedRun(run.id, next.trim(), placeById);
      void refreshDiscoverData();
    });
    actions.append(renameBtn);
  }

  card.append(top, meta, actions);
  card.addEventListener("click", (event) => {
    if (event.target instanceof HTMLButtonElement) return;
    previewRunOnMap(run);
  });
  return card;
}

function renderDiscoverList(
  targetNode,
  runs,
  { allowRename = false, showSave = false, source = "discover" } = {}
) {
  if (!targetNode) return;
  targetNode.innerHTML = "";
  if (!runs.length) {
    const empty = document.createElement("p");
    empty.className = "empty-library";
    empty.textContent = "No routes yet.";
    targetNode.append(empty);
    return;
  }

  runs.forEach((run) => {
    targetNode.append(createDiscoverRunCard(run, { allowRename, showSave, source }));
  });
}

function renderRunOfDayCard(run) {
  if (!runOfDayTitleSidebar || !runOfDayMetaSidebar) return;
  if (!run) {
    runOfDayTitleSidebar.textContent = "No curated routes available";
    runOfDayMetaSidebar.textContent = "Add curated routes to /data/curated-runs.json.";
    previewRunOfDaySidebarButton.disabled = true;
    useRunOfDaySidebarButton.disabled = true;
    saveRunOfDaySidebarButton.disabled = true;
    return;
  }

  runOfDayTitleSidebar.textContent = run.title;
  runOfDayMetaSidebar.textContent = runStatLine(run);
  previewRunOfDaySidebarButton.disabled = false;
  useRunOfDaySidebarButton.disabled = false;
  saveRunOfDaySidebarButton.disabled = false;
}

async function refreshDiscoverData() {
  const curatedRuns = await loadCuratedRuns();
  const runOfDayPool = curatedRuns.filter((run) => Array.isArray(run.tags) && run.tags.includes("rotd"));
  const randomPool = curatedRuns.filter((run) => Array.isArray(run.tags) && run.tags.includes("random"));
  const curatedCommunityRuns = curatedRuns.filter(
    (run) => Array.isArray(run.tags) && run.tags.includes("community")
  );

  const savedRuns = loadSavedRuns(placeById);
  const publishedRuns = loadPublishedRuns(placeById);
  const configCommunityRuns = loadConfigCommunityRuns();

  const communityById = new Map();
  [...configCommunityRuns, ...curatedCommunityRuns, ...publishedRuns].forEach((run) => {
    communityById.set(run.id, run);
  });
  const communityRuns = sortCommunityRuns(Array.from(communityById.values()));

  state.discoverData.curatedRuns = curatedRuns;
  state.discoverData.runOfDay = selectRunOfDay(runOfDayPool.length ? runOfDayPool : curatedRuns);
  state.discoverData.randomPool = randomPool.length ? randomPool : curatedRuns;

  if (
    state.discoverData.randomLastRun &&
    !state.discoverData.randomPool.find((run) => run.id === state.discoverData.randomLastRun.id)
  ) {
    state.discoverData.randomLastRun = null;
  }

  renderRunOfDayCard(state.discoverData.runOfDay);
  if (state.discoverData.randomLastRun) {
    renderDiscoverList(randomRunSidebarPreview, [state.discoverData.randomLastRun], {
      source: "random",
      showSave: true,
    });
  } else if (randomRunSidebarPreview) {
    randomRunSidebarPreview.innerHTML = '<p class="empty-library">Click Roll to preview a random route.</p>';
  }
  renderDiscoverList(savedRunsSidebarList, savedRuns, {
    allowRename: true,
    source: "saved",
  });
  renderDiscoverList(communityRunsSidebarList, communityRuns, {
    source: "community",
    showSave: true,
  });
}

function requestDiscoverRefresh() {
  void refreshDiscoverData();
}

function buildShareLink() {
  const payload = buildSharePayload({
    title: state.planTitle,
    vibe: state.vibe,
    placeIds: state.runPlaceIds,
    source: "share-link",
  });
  return buildBuilderShareUrl(payload, "/");
}

function buildSummaryText(partifulFormat = false) {
  const runPlaces = getRunPlaces();
  const fallbackDistance = routeDistanceKm(runPlaces);
  const resolvedDistance =
    runPlaces.length > 1 && Number.isFinite(state.routeDistanceKm)
      ? state.routeDistanceKm
      : fallbackDistance;

  const walkingTimeMin = estimateWalkingTimeMin(resolvedDistance);
  const durationMin = estimateDurationMin(runPlaces.length, walkingTimeMin);

  if (partifulFormat) {
    const lines = [
      `${state.planTitle} (${state.vibe})`,
      `Locations: ${runPlaces.length} • Distance: ${formatDistanceMiles(resolvedDistance)}`,
      "",
      ...runPlaces.map((place, index) => `${index + 1}. ${place.name} — ${place.address}`),
    ];
    return lines.join("\n");
  }

  const lines = [
    `${state.planTitle}`,
    `Vibe: ${state.vibe}`,
    `Locations: ${runPlaces.length}`,
    `Distance: ${formatDistanceMiles(resolvedDistance)}`,
    `Duration: ${formatMinutes(durationMin)}`,
    "",
    "Route",
    ...runPlaces.map((place, index) => `${index + 1}. ${place.name} (${categoryLabel(place.category)})`),
  ];
  return lines.join("\n");
}

function renderSharePreview() {
  const link = buildShareLink();
  sharePreview.innerHTML = "";

  const line = document.createElement("p");
  line.className = "share-preview-line";
  line.textContent = link;

  const summary = document.createElement("pre");
  summary.className = "share-preview-summary";
  summary.textContent = buildSummaryText(false);

  sharePreview.append(line, summary);
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function downloadShareCard() {
  const runPlaces = getRunPlaces();
  const title = escapeXml(state.planTitle || defaultPlanTitle());
  const vibe = escapeXml(state.vibe);

  const lineItems = runPlaces
    .slice(0, 10)
    .map(
      (place, index) =>
        `<text x="44" y="${170 + index * 32}" font-size="18" fill="#1d2a3e">${index + 1}. ${escapeXml(place.name)}</text>`
    )
    .join("");

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#e7f2ff" />
      <stop offset="100%" stop-color="#f7fbff" />
    </linearGradient>
  </defs>
  <rect width="1080" height="1350" fill="url(#bg)"/>
  <text x="44" y="78" font-size="22" fill="#4272c6">Fitness Finder</text>
  <text x="44" y="122" font-size="44" font-weight="700" fill="#14233a">${title}</text>
  <text x="44" y="152" font-size="24" fill="#3d5578">Vibe: ${vibe}</text>
  ${lineItems}
</svg>
`;

  const blob = new Blob([svg], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${(state.planTitle || "fitness-finder-route").replace(/\s+/g, "-").toLowerCase()}.svg`;
  a.click();
  URL.revokeObjectURL(url);
  showToast("Downloaded share card.");
}

function addPlaceToPlan(placeId, insertIndex = null) {
  if (state.runPlaceIds.includes(placeId)) {
    showToast("That location is already in your route.");
    return;
  }

  const next = [...state.runPlaceIds];
  if (Number.isInteger(insertIndex) && insertIndex >= 0 && insertIndex <= next.length) {
    next.splice(insertIndex, 0, placeId);
  } else {
    next.push(placeId);
  }

  state.runPlaceIds = normalizePlaceIds(next, placeById);
  syncState();

  const place = placeById.get(placeId);
  showToast(`Added ${place?.name || "location"}.`);
}

function removePlaceFromPlan(placeId) {
  state.runPlaceIds = state.runPlaceIds.filter((id) => id !== placeId);
  syncState();
}

function recordRunInHistory(source) {
  const run = createRunRecord(
    {
      id: createRunId("history"),
      title: state.planTitle,
      vibe: state.vibe,
      placeIds: state.runPlaceIds,
      source,
      isPublished: false,
    },
    placeById
  );
  appendHistoryRun(run, placeById, source);
  requestDiscoverRefresh();
}

function saveCurrentPlan() {
  const title = saveTitleInput.value.trim();
  if (!title) {
    showToast("Add a title before saving.");
    return;
  }

  if (state.runPlaceIds.length < 2) {
    showToast("Add at least 2 locations before saving.");
    return;
  }

  state.planTitle = title;
  persistCurrentPlanMeta();

  const saveId = createRunId("saved");
  const isPublished = savePublishToggle.checked;

  const run = createRunRecord(
    {
      id: saveId,
      title,
      vibe: state.vibe,
      placeIds: state.runPlaceIds,
      source: "save",
      isPublished,
      moderationStatus: "approved",
    },
    placeById
  );

  upsertSavedRun(run, placeById);
  if (isPublished) {
    upsertPublishedRun({ ...run, isPublished: true }, placeById);
  }
  recordRunInHistory("save");

  renderPlanHeader();
  closeSaveModal();
  requestDiscoverRefresh();
  showToast(isPublished ? "Saved and published to Community Routes." : "Saved to Saved Routes.");
}

function buildPointsGeoJSON(places, withOrder = false) {
  return {
    type: "FeatureCollection",
    features: places.map((place, index) => ({
      type: "Feature",
      properties: {
        id: place.id,
        name: place.name,
        category: place.category,
        address: place.address,
        website: place.website,
        order: withOrder ? index + 1 : 0,
      },
      geometry: {
        type: "Point",
        coordinates: place.coordinates,
      },
    })),
  };
}

function buildRunRouteGeoJSON(places) {
  if (places.length < 2) {
    return { type: "FeatureCollection", features: [] };
  }

  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {},
        geometry: {
          type: "LineString",
          coordinates: places.map((place) => place.coordinates),
        },
      },
    ],
  };
}

function updateMapSources() {
  if (!map.isStyleLoaded()) return;
  const runPlaces = getRunPlaces();
  map.getSource("catalog-places")?.setData(buildPointsGeoJSON(getFilteredCatalogPlaces()));
  map.getSource("run-route")?.setData(buildRunRouteGeoJSON(runPlaces));
  map.getSource("run-stops")?.setData(buildPointsGeoJSON(runPlaces, true));
}

function updateDiscoverPreviewSources() {
  if (!map || !map.isStyleLoaded()) return;
  const previewPlaces = getPlaceRecordsForIds(state.discoverPreviewPlaceIds);
  map.getSource("discover-preview-stops")?.setData(buildPointsGeoJSON(previewPlaces, true));
  if (!previewPlaces.length) {
    map.getSource("discover-preview-route")?.setData(buildRunRouteGeoJSON([]));
  }
}

function directionsUrlForPlaces(places) {
  const profile = config.routeProfile || "walking";
  const coordinates = places.map((place) => `${place.coordinates[0]},${place.coordinates[1]}`).join(";");
  return `https://api.mapbox.com/directions/v5/mapbox/${encodeURIComponent(profile)}/${coordinates}?alternatives=false&geometries=geojson&overview=full&steps=false&access_token=${encodeURIComponent(mapboxgl.accessToken)}`;
}

function routeCacheKeyForPlaces(places) {
  const profile = config.routeProfile || "walking";
  const coordinateKey = places.map((place) => `${place.coordinates[0]},${place.coordinates[1]}`).join(";");
  return `${profile}|${coordinateKey}`;
}

async function resolveRouteDataForPlaces(places) {
  if (!Array.isArray(places) || places.length < 2) {
    return {
      geojson: buildRunRouteGeoJSON(places || []),
      distanceKm: routeDistanceKm(places || []),
      usedRoads: false,
    };
  }

  if (config.useRoadRouting === false) {
    return {
      geojson: buildRunRouteGeoJSON(places),
      distanceKm: routeDistanceKm(places),
      usedRoads: false,
    };
  }

  const cacheKey = routeCacheKeyForPlaces(places);
  const cached = routeCache.get(cacheKey);
  if (cached) {
    return {
      geojson: cached.geojson,
      distanceKm: cached.distanceKm,
      usedRoads: true,
    };
  }

  try {
    const response = await fetch(directionsUrlForPlaces(places));
    if (!response.ok) {
      throw new Error(`Directions request failed (${response.status})`);
    }

    const payload = await response.json();
    const route = payload.routes && payload.routes[0];
    const coordinates = route?.geometry?.coordinates;
    if (!Array.isArray(coordinates) || coordinates.length < 2) {
      throw new Error("No routable path returned");
    }

    const geojson = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates,
          },
        },
      ],
    };

    const distance = Number(route.distance) / 1000;
    const distanceKm = Number.isFinite(distance) ? distance : routeDistanceKm(places);
    routeCache.set(cacheKey, { geojson, distanceKm });
    return { geojson, distanceKm, usedRoads: true };
  } catch (error) {
    console.warn("Directions routing unavailable, using straight-line route.", error);
    return {
      geojson: buildRunRouteGeoJSON(places),
      distanceKm: routeDistanceKm(places),
      usedRoads: false,
    };
  }
}

async function updateRouteWithRoadsAndTrails() {
  const runPlaces = getRunPlaces();
  if (runPlaces.length < 2) return;

  const requestId = ++routeRequestSeq;
  const routeData = await resolveRouteDataForPlaces(runPlaces);
  if (requestId !== routeRequestSeq) return;
  state.routeDistanceKm = Number.isFinite(routeData.distanceKm) ? routeData.distanceKm : null;
  map.getSource("run-route")?.setData(routeData.geojson);
  renderPlanHeader();
  renderTimeline();
}

async function updateDiscoverPreviewRouteWithRoads() {
  if (!map || !map.isStyleLoaded()) return;
  const previewPlaces = getPlaceRecordsForIds(state.discoverPreviewPlaceIds);
  const requestId = ++previewRouteRequestSeq;
  const routeData = await resolveRouteDataForPlaces(previewPlaces);
  if (requestId !== previewRouteRequestSeq) return;
  map.getSource("discover-preview-route")?.setData(routeData.geojson);
}

function scheduleRoadRouteUpdate() {
  if (routeDebounceHandle) {
    clearTimeout(routeDebounceHandle);
  }
  routeDebounceHandle = setTimeout(() => {
    void updateRouteWithRoadsAndTrails();
  }, 180);
}

function boundsForPlaces(places) {
  if (!places.length) return null;
  const bounds = new mapboxgl.LngLatBounds(places[0].coordinates, places[0].coordinates);
  places.slice(1).forEach((place) => bounds.extend(place.coordinates));
  return bounds;
}

function fitRouteOrCatalog() {
  const runPlaces = getRunPlaces();
  const catalogPlaces = getFilteredCatalogPlaces();
  const target = runPlaces.length ? runPlaces : catalogPlaces.length ? catalogPlaces : placesCatalog;
  const bounds = boundsForPlaces(target);
  if (!bounds) return;
  map.fitBounds(bounds, { padding: 86, duration: 820, pitch: config.pitch ?? 58 });
}

function popupHtml(feature, { isCatalog = false } = {}) {
  const props = feature.properties || {};
  const address = props.address ? `<br />${props.address}` : "";
  const website = props.website
    ? `<br /><a href="${props.website}" target="_blank" rel="noopener noreferrer">Website</a>`
    : "";
  const locationNumber = props.order ? `<br /><em>Route location ${props.order}</em>` : "";
  const catalogHint = isCatalog
    ? `<br /><em>${state.mode === "edit" ? "Clicking map points adds to your route." : "Switch to Edit mode to add this location."}</em>`
    : "";
  return `<strong>${props.name}</strong><br />${categoryLabel(props.category || "trail")}${locationNumber}${address}${website}${catalogHint}`;
}

function syncState() {
  const currentSignature = runSignature(state.runPlaceIds);
  const didRunChange = currentSignature !== lastRunSignature;

  if (didRunChange) {
    state.routeDistanceKm = null;
    lastRunSignature = currentSignature;
  }

  renderPlanHeader();
  renderTimeline();
  renderMapQuest();
  updateMapSources();
  updateDiscoverPreviewSources();

  if (!addStopModal.classList.contains("hidden")) {
    renderAddStopResults();
  }

  if (didRunChange) {
    scheduleRoadRouteUpdate();
  }
}

function applyDaytimeBasemap() {
  if (typeof map.setConfigProperty !== "function") return;
  try {
    map.setConfigProperty("basemap", "lightPreset", config.lightPreset || "day");
    map.setConfigProperty(
      "basemap",
      "showPointOfInterestLabels",
      config.showPointOfInterestLabels ?? false
    );
  } catch (error) {
    console.warn("Basemap config not applied:", error);
  }
}

function setupSourcesAndLayers() {
  if (!map.getSource("catalog-places")) {
    map.addSource("catalog-places", {
      type: "geojson",
      data: buildPointsGeoJSON(placesCatalog),
    });
  }

  if (!map.getSource("run-route")) {
    map.addSource("run-route", {
      type: "geojson",
      data: buildRunRouteGeoJSON(getRunPlaces()),
    });
  }

  if (!map.getSource("run-stops")) {
    map.addSource("run-stops", {
      type: "geojson",
      data: buildPointsGeoJSON(getRunPlaces(), true),
    });
  }

  if (!map.getSource("discover-preview-route")) {
    map.addSource("discover-preview-route", {
      type: "geojson",
      data: buildRunRouteGeoJSON([]),
    });
  }

  if (!map.getSource("discover-preview-stops")) {
    map.addSource("discover-preview-stops", {
      type: "geojson",
      data: buildPointsGeoJSON([], true),
    });
  }

  if (!map.getSource("ann-roy-butler-trail")) {
    map.addSource("ann-roy-butler-trail", {
      type: "geojson",
      data: annRoyButlerTrailGeojson,
    });
  }

  const firstSymbolLayer = map
    .getStyle()
    .layers.find((layer) => layer.type === "symbol" && layer.layout?.["text-field"]);

  if (!map.getLayer("ann-roy-butler-trail-line")) {
    map.addLayer(
      {
        id: "ann-roy-butler-trail-line",
        type: "line",
        source: "ann-roy-butler-trail",
        paint: {
          "line-color": "#2bb3a3",
          "line-width": ["interpolate", ["linear"], ["zoom"], 10, 3, 16, 6],
          "line-opacity": 0.82,
          "line-dasharray": [1.1, 1.1],
        },
      },
      firstSymbolLayer ? firstSymbolLayer.id : undefined
    );
  }

  if (!map.getLayer("run-route-line")) {
    map.addLayer({
      id: "run-route-line",
      type: "line",
      source: "run-route",
      paint: {
        "line-color": "#3b93ff",
        "line-width": ["interpolate", ["linear"], ["zoom"], 10, 6.2, 16, 10.2],
        "line-opacity": 0.98,
      },
    });
  }

  if (!map.getLayer("run-route-core")) {
    map.addLayer({
      id: "run-route-core",
      type: "line",
      source: "run-route",
      paint: {
        "line-color": "#dff1ff",
        "line-width": ["interpolate", ["linear"], ["zoom"], 10, 1.6, 16, 2.8],
        "line-opacity": 0.9,
      },
    });
  }

  if (!map.getLayer("catalog-places-layer")) {
    map.addLayer(
      {
        id: "catalog-places-layer",
        type: "circle",
        source: "catalog-places",
        paint: {
          "circle-radius": 5.2,
          "circle-color": [
            "match",
            ["downcase", ["get", "category"]],
            "calisthenics",
            "#24b174",
            "track",
            "#418bff",
            "trail",
            "#2bb3a3",
            "hill",
            "#f2993a",
            "stairs",
            "#915df5",
            "coffee",
            "#b9824d",
            "restaurant",
            "#d96f61",
            "bar",
            "#658ce4",
            "#7fb5eb",
          ],
          "circle-stroke-color": "#0b1322",
          "circle-stroke-width": 1.7,
          "circle-opacity": 0.76,
        },
      },
      firstSymbolLayer ? firstSymbolLayer.id : undefined
    );
  }

  if (!map.getLayer("run-stops-layer")) {
    map.addLayer({
      id: "run-stops-layer",
      type: "circle",
      source: "run-stops",
      paint: {
        "circle-radius": 9.2,
        "circle-color": "#3ed4af",
        "circle-stroke-color": "#071326",
        "circle-stroke-width": 2.3,
        "circle-opacity": 0.95,
      },
    });
  }

  if (!map.getLayer("run-stops-number")) {
    map.addLayer({
      id: "run-stops-number",
      type: "symbol",
      source: "run-stops",
      layout: {
        "text-field": ["to-string", ["get", "order"]],
        "text-size": 11,
      },
      paint: {
        "text-color": "#041423",
      },
    });
  }

  if (!map.getLayer("discover-preview-route-line")) {
    map.addLayer({
      id: "discover-preview-route-line",
      type: "line",
      source: "discover-preview-route",
      paint: {
        "line-color": "#ffb84a",
        "line-width": ["interpolate", ["linear"], ["zoom"], 10, 4.8, 16, 8.2],
        "line-opacity": 0.98,
        "line-dasharray": [1.15, 1],
      },
    });
  }

  if (!map.getLayer("discover-preview-stops-layer")) {
    map.addLayer({
      id: "discover-preview-stops-layer",
      type: "circle",
      source: "discover-preview-stops",
      paint: {
        "circle-radius": 6.8,
        "circle-color": "#ffd17f",
        "circle-stroke-color": "#10233e",
        "circle-stroke-width": 2,
        "circle-opacity": 0.92,
      },
    });
  }

  if (!map.getLayer("discover-preview-stops-number")) {
    map.addLayer({
      id: "discover-preview-stops-number",
      type: "symbol",
      source: "discover-preview-stops",
      layout: {
        "text-field": ["to-string", ["get", "order"]],
        "text-size": 10,
      },
      paint: {
        "text-color": "#10233e",
      },
    });
  }

}

function scheduleMapResize() {
  if (mapResizeAnimationFrame) {
    cancelAnimationFrame(mapResizeAnimationFrame);
  }
  mapResizeAnimationFrame = requestAnimationFrame(() => {
    mapResizeAnimationFrame = null;
    map.resize();

    const canvas = map.getCanvas();
    if (canvas) {
      canvas.style.width = "100%";
      canvas.style.height = "100%";
    }

    if (typeof map.getCanvasContainer === "function") {
      const canvasContainer = map.getCanvasContainer();
      if (canvasContainer) {
        canvasContainer.style.width = "100%";
        canvasContainer.style.height = "100%";
      }
    }
  });
}

function resizeMapAfterLayoutChange() {
  scheduleMapResize();
  if (sidebarResizeTimeoutId) {
    clearTimeout(sidebarResizeTimeoutId);
  }
  sidebarResizeTimeoutId = window.setTimeout(() => {
    scheduleMapResize();
  }, 280);
}

const map = new mapboxgl.Map({
  container: "map",
  style: config.style || "mapbox://styles/mapbox/standard",
  center: config.center || getDefaultCenter(),
  zoom: config.zoom ?? 12,
  pitch: config.pitch ?? 58,
  bearing: config.bearing ?? -20,
  antialias: true,
  config: {
    basemap: {
      lightPreset: config.lightPreset || "day",
      showPointOfInterestLabels: config.showPointOfInterestLabels ?? false,
      showPlaceLabels: config.showPlaceLabels ?? true,
      showRoadLabels: config.showRoadLabels ?? true,
      showTransitLabels: config.showTransitLabels ?? false,
    },
  },
});

map.addControl(new mapboxgl.NavigationControl(), "top-right");
map.addControl(new mapboxgl.ScaleControl(), "bottom-right");

appShell.addEventListener("transitionend", (event) => {
  if (event.target !== appShell) return;
  if (!["grid-template-columns", "grid-template-rows"].includes(event.propertyName)) return;
  scheduleMapResize();
});

window.addEventListener("resize", scheduleMapResize);

if (typeof ResizeObserver === "function") {
  const resizeTarget = mapElement?.parentElement || mapElement;
  if (resizeTarget) {
    const mapResizeObserver = new ResizeObserver(() => {
      scheduleMapResize();
    });
    mapResizeObserver.observe(resizeTarget);
  }
}

map.on("load", () => {
  scheduleMapResize();
  window.setTimeout(scheduleMapResize, 120);
  setupSourcesAndLayers();
  applyDaytimeBasemap();

  map.on("click", "catalog-places-layer", (event) => {
    const feature = event.features && event.features[0];
    if (!feature) return;
    new mapboxgl.Popup()
      .setLngLat(event.lngLat)
      .setHTML(popupHtml(feature, { isCatalog: true }))
      .addTo(map);
    const placeId = feature.properties && feature.properties.id;
    if (placeId && state.mode === "edit") {
      addPlaceToPlan(placeId, null);
    }
  });

  map.on("click", "run-stops-layer", (event) => {
    const feature = event.features && event.features[0];
    if (!feature) return;
    new mapboxgl.Popup().setLngLat(event.lngLat).setHTML(popupHtml(feature)).addTo(map);
  });

  map.on("click", "discover-preview-stops-layer", (event) => {
    const feature = event.features && event.features[0];
    if (!feature) return;
    new mapboxgl.Popup().setLngLat(event.lngLat).setHTML(popupHtml(feature)).addTo(map);
  });

  ["catalog-places-layer", "run-stops-layer", "discover-preview-stops-layer"].forEach((layerId) => {
    map.on("mouseenter", layerId, () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", layerId, () => {
      map.getCanvas().style.cursor = "";
    });
  });

  syncState();
  updateDiscoverPreviewSources();
  fitRouteOrCatalog();

  if (state.hydratedFromPayload) {
    setMode("view");
    recordRunInHistory(`use:${state.payloadSource}`);
  }
});

map.on("style.load", () => {
  applyDaytimeBasemap();
  setupSourcesAndLayers();
  syncState();
  updateDiscoverPreviewSources();
  void updateDiscoverPreviewRouteWithRoads();
});

map.on("error", (event) => {
  console.error(event.error);
  showToast("Mapbox error. Verify token and style permissions.");
});

sidebarToggleButton.addEventListener("click", () => {
  setSidebarHidden(!state.sidebarHidden);
});

sidebarBuilderButton?.addEventListener("click", () => {
  setSidebarView("builder");
});

sidebarDiscoverButton?.addEventListener("click", () => {
  setSidebarView("discover");
});

catalogCategoryFilters?.querySelectorAll("[data-category]").forEach((button) => {
  if (!(button instanceof HTMLButtonElement)) return;
  button.addEventListener("click", () => {
    setCatalogCategoryFilter(button.dataset.category || "all");
  });
});

previewRunOfDaySidebarButton?.addEventListener("click", () => {
  if (!state.discoverData.runOfDay) return;
  previewRunOnMap(state.discoverData.runOfDay);
});

useRunOfDaySidebarButton?.addEventListener("click", () => {
  if (!state.discoverData.runOfDay) return;
  useRunFromDiscover(state.discoverData.runOfDay, "discover-rotd");
});

saveRunOfDaySidebarButton?.addEventListener("click", () => {
  if (!state.discoverData.runOfDay) return;
  saveRunFromDiscover(state.discoverData.runOfDay, "discover-rotd");
});

randomRunSidebarButton?.addEventListener("click", () => {
  const picked = pickRandomRun(state.discoverData.randomPool || []);
  if (!picked) {
    showToast("No random routes available.");
    return;
  }
  state.discoverData.randomLastRun = picked;
  renderDiscoverList(randomRunSidebarPreview, [picked], {
    source: "discover-random",
    showSave: true,
  });
  previewRunOnMap(picked);
});

editToggleButton.addEventListener("click", () => {
  setMode(state.mode === "edit" ? "view" : "edit");
  showToast(state.mode === "edit" ? "Edit mode enabled." : "View mode enabled.");
});

planTitleInput.addEventListener("input", (event) => {
  state.planTitle = event.target.value || defaultPlanTitle();
  renderPlanHeader();
  persistCurrentPlanMeta();
});

vibeInput.addEventListener("change", (event) => {
  state.vibe = event.target.value || defaultVibe();
  renderPlanHeader();
  persistCurrentPlanMeta();
});

addStopInlineButton?.addEventListener("click", () => openAddStopModal(null));
optimizeOrderButton.addEventListener("click", optimizeRunOrder);

addTabSearchButton.addEventListener("click", () => {
  state.addStopTab = "search";
  renderAddStopResults();
});

addTabCuratedButton.addEventListener("click", () => {
  state.addStopTab = "curated";
  renderAddStopResults();
});

addTabNearbyButton.addEventListener("click", () => {
  state.addStopTab = "nearby";
  renderAddStopResults();
});

addStopSearchInput.addEventListener("input", (event) => {
  state.addStopSearch = event.target.value || "";
  renderAddStopResults();
});

closeAddStopModalButton.addEventListener("click", closeAddStopModal);
closeSaveModalButton.addEventListener("click", closeSaveModal);
closeShareModalButton.addEventListener("click", closeShareModal);

headerShareButton.addEventListener("click", openShareModal);
sharePlanButton?.addEventListener("click", openShareModal);
headerSaveButton.addEventListener("click", openSaveModal);
saveConfirmButton.addEventListener("click", saveCurrentPlan);

copySummaryButton?.addEventListener("click", async () => {
  await copyText(buildSummaryText(false), "Copied route summary.");
  recordRunInHistory("share-summary");
});

copyLinkButton?.addEventListener("click", async () => {
  await copyText(buildShareLink(), "Copied route link.");
  recordRunInHistory("share-link");
});

downloadCardButton?.addEventListener("click", () => {
  downloadShareCard();
  recordRunInHistory("share-card");
});

modalCopyLinkButton.addEventListener("click", async () => {
  await copyText(buildShareLink(), "Copied route link.");
  recordRunInHistory("share-link");
});

modalCopySummaryButton.addEventListener("click", async () => {
  await copyText(buildSummaryText(false), "Copied route summary.");
  recordRunInHistory("share-summary");
});

modalCopyPartifulButton.addEventListener("click", async () => {
  await copyText(buildSummaryText(true), "Copied Partiful-ready summary.");
  recordRunInHistory("share-partiful");
});

if (navigator.share) {
  modalNativeShareButton.classList.remove("hidden");
  modalNativeShareButton.addEventListener("click", async () => {
    try {
      await navigator.share({
        title: state.planTitle,
        text: buildSummaryText(false),
        url: buildShareLink(),
      });
      showToast("Shared route.");
      recordRunInHistory("share-native");
    } catch (error) {
      if (error && error.name !== "AbortError") {
        showToast("Native share failed.");
      }
    }
  });
} else {
  modalNativeShareButton.classList.add("hidden");
}

document.querySelectorAll(".modal-backdrop").forEach((node) => {
  node.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const modalId = target.dataset.close;
    if (!modalId) return;
    const modal = document.getElementById(modalId);
    if (!modal) return;
    closeModal(modal);
  });
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  closeAddStopModal();
  closeSaveModal();
  closeShareModal();
});

setMode("view");
setSidebarView("builder");
setSidebarHidden(state.sidebarHidden);
renderCatalogCategoryFilters();
renderAddStopResults();
renderPlanHeader();
renderTimeline();
renderMapQuest();
requestDiscoverRefresh();

if (state.hydratedFromPayload) {
  showToast("Shared route loaded in view mode.");
}
