import {
  buildPlaceById,
  getConfig,
  getPlacesCatalog,
  normalizePlaceIds,
} from "../shared/catalog.js";
import {
  formatDistanceMiles,
  formatMinutes,
} from "../shared/metrics.js";
import {
  buildSharePayload,
  normalizeRunRecord,
} from "../shared/run-model.js";
import {
  loadHistoryRuns,
  loadPublishedRuns,
  loadSavedRuns,
  migrateStorageV1toV2,
  renameSavedRun,
} from "../shared/storage.js";
import { buildBuilderShareUrl } from "../shared/share-link.js";

const runOfDayTitle = document.getElementById("run-of-day-title");
const runOfDayMeta = document.getElementById("run-of-day-meta");
const runOfDayUseButton = document.getElementById("use-run-of-day");
const randomRunButton = document.getElementById("random-run-btn");
const randomPreview = document.getElementById("random-preview");

const savedRunsList = document.getElementById("saved-runs-list");
const historyRunsList = document.getElementById("history-runs-list");
const communityRunsList = document.getElementById("community-runs-list");

const config = getConfig();
const placeById = buildPlaceById(getPlacesCatalog());

migrateStorageV1toV2(placeById);

function dateKeyLocal() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function hashStringToSeed(input) {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function parseCuratedData(raw) {
  const sourceRuns = Array.isArray(raw?.runs) ? raw.runs : [];
  return sourceRuns
    .map((run, index) => {
      const placeIds = normalizePlaceIds(run.placeIds, placeById);
      if (!placeIds.length) return null;
      const normalized = normalizeRunRecord(
        {
          id: run.id || `curated-${index + 1}`,
          title: run.title || run.name || `Curated Route ${index + 1}`,
          vibe: run.vibe || "Mixed Session",
          placeIds,
          isFeatured: Boolean(run.isFeatured),
          isPublished: Boolean(run.tags?.includes("community")),
          source: "curated",
          createdAt: run.createdAt || "2026-01-01T12:00:00.000Z",
          tags: Array.isArray(run.tags) ? run.tags : [],
        },
        placeById,
        "curated"
      );
      if (!normalized) return null;
      return {
        ...normalized,
        tags: Array.isArray(run.tags) ? run.tags : [],
      };
    })
    .filter(Boolean);
}

async function loadCuratedRuns() {
  try {
    const response = await fetch("/data/curated-runs.json", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Curated runs request failed (${response.status})`);
    }
    const json = await response.json();
    return parseCuratedData(json);
  } catch (error) {
    console.warn("Failed to load curated runs:", error);
    return [];
  }
}

function runStatLine(run) {
  return `${run.placeIds.length} locations • ${formatDistanceMiles(run.distanceKm)} • ${formatMinutes(run.durationMin)}`;
}

function usePlan(run, source) {
  const payload = buildSharePayload({
    title: run.title,
    vibe: run.vibe,
    placeIds: run.placeIds,
    source,
  });
  window.location.assign(buildBuilderShareUrl(payload, "/"));
}

function createRunCard(run, { source, includeRename = false } = {}) {
  const card = document.createElement("article");
  card.className = "run-card";

  const top = document.createElement("div");
  top.className = "run-top";

  const headingBlock = document.createElement("div");
  const title = document.createElement("h3");
  title.textContent = run.title;
  const vibe = document.createElement("p");
  vibe.className = "run-vibe";
  vibe.textContent = `Vibe: ${run.vibe}`;
  headingBlock.append(title, vibe);

  top.append(headingBlock);

  if (run.isFeatured) {
    const featured = document.createElement("span");
    featured.className = "ghost-btn";
    featured.textContent = "Featured";
    top.append(featured);
  }

  const stats = document.createElement("p");
  stats.className = "run-stats";
  stats.textContent = runStatLine(run);

  const actions = document.createElement("div");
  actions.className = "run-actions";

  const useButton = document.createElement("button");
  useButton.type = "button";
  useButton.className = "solid-btn";
  useButton.textContent = "Use this route";
  useButton.addEventListener("click", () => usePlan(run, source));
  actions.append(useButton);

  if (includeRename) {
    const renameButton = document.createElement("button");
    renameButton.type = "button";
    renameButton.className = "ghost-btn";
    renameButton.textContent = "Rename";
    renameButton.addEventListener("click", () => {
      const next = window.prompt("Rename saved route", run.title);
      if (!next || !next.trim()) return;
      renameSavedRun(run.id, next.trim(), placeById);
      void renderAll();
    });
    actions.append(renameButton);
  }

  card.append(top, stats, actions);
  return card;
}

function renderSection(target, runs, { source, includeRename = false } = {}) {
  target.innerHTML = "";
  if (!runs.length) {
    const empty = document.createElement("p");
    empty.className = "empty-line";
    empty.textContent = "No routes yet.";
    target.append(empty);
    return;
  }

  runs.forEach((run) => {
    target.append(createRunCard(run, { source, includeRename }));
  });
}

function sortCommunityRuns(runs) {
  return [...runs].sort((a, b) => {
    if (a.isFeatured !== b.isFeatured) return a.isFeatured ? -1 : 1;
    const aTime = new Date(a.createdAt || 0).getTime();
    const bTime = new Date(b.createdAt || 0).getTime();
    return bTime - aTime;
  });
}

function selectRunOfDay(runs) {
  if (!runs.length) return null;
  const dayKey = dateKeyLocal();
  const index = hashStringToSeed(dayKey) % runs.length;
  return runs[index];
}

function pickRandomRun(runs) {
  if (!runs.length) return null;
  const index = Math.floor(Math.random() * runs.length);
  return runs[index];
}

function normalizeConfigCommunityRuns() {
  const baseRuns = Array.isArray(config.communityRuns) ? config.communityRuns : [];
  return baseRuns
    .map((run, index) =>
      normalizeRunRecord(
        {
          id: run.id || `community-${index + 1}`,
          title: run.name || run.title || `Community Route ${index + 1}`,
          vibe: run.vibe || "Mixed Session",
          placeIds: normalizePlaceIds(run.placeIds, placeById),
          isFeatured: Boolean(run.isFeatured),
          isPublished: true,
          source: "config-community",
          createdBy: run.author || null,
          createdAt: run.createdAt || "2026-01-01T12:00:00.000Z",
        },
        placeById,
        "community"
      )
    )
    .filter(Boolean);
}

async function renderAll() {
  const curatedRuns = await loadCuratedRuns();
  const curatedCommunityRuns = curatedRuns.filter((run) => run.tags.includes("community"));
  const curatedRunPool = curatedRuns.length ? curatedRuns : normalizeConfigCommunityRuns();

  const savedRuns = loadSavedRuns(placeById);
  const historyRuns = loadHistoryRuns(placeById);
  const publishedRuns = loadPublishedRuns(placeById);

  const configCommunityRuns = normalizeConfigCommunityRuns();
  const communityById = new Map();
  [...configCommunityRuns, ...curatedCommunityRuns, ...publishedRuns].forEach((run) => {
    communityById.set(run.id, run);
  });
  const communityRuns = sortCommunityRuns(Array.from(communityById.values()));

  const runOfDayPool = curatedRunPool.filter((run) => run.tags?.includes("rotd"));
  const rotd = selectRunOfDay(runOfDayPool.length ? runOfDayPool : curatedRunPool);

  if (rotd) {
    runOfDayTitle.textContent = rotd.title;
    runOfDayMeta.textContent = runStatLine(rotd);
    runOfDayUseButton.disabled = false;
    runOfDayUseButton.onclick = () => usePlan(rotd, "discover-rotd");
  } else {
    runOfDayTitle.textContent = "No curated routes available";
    runOfDayMeta.textContent = "Add curated routes in data/curated-runs.json to enable this section.";
    runOfDayUseButton.disabled = true;
  }

  randomRunButton.onclick = () => {
    const randomPool = curatedRunPool.filter((run) => run.tags?.includes("random"));
    const picked = pickRandomRun(randomPool.length ? randomPool : curatedRunPool);
    if (!picked) return;

    randomPreview.classList.remove("hidden");
    randomPreview.innerHTML = "";
    randomPreview.append(createRunCard(picked, { source: "discover-random" }));
  };

  renderSection(savedRunsList, savedRuns, {
    source: "discover-saved",
    includeRename: true,
  });
  renderSection(historyRunsList, historyRuns, {
    source: "discover-history",
  });
  renderSection(communityRunsList, communityRuns, {
    source: "discover-community",
  });
}

void renderAll();
