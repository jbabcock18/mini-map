import {
  defaultPlanTitle,
  defaultVibe,
  normalizeRunRecord,
} from "./run-model.js";

export const STORAGE_KEYS = {
  savedRuns: "miniMap.savedRuns.v2",
  historyRuns: "miniMap.historyRuns.v2",
  publishedRuns: "miniMap.publishedRuns.v2",
  planMeta: "miniMap.planMeta.v2",
  sidebarHidden: "miniMap.sidebarHidden.v2",
  migrationFlag: "miniMap.storageVersion",
};

const LEGACY_KEYS = {
  savedRuns: "runAtlas.savedRuns.v1",
  planMeta: "miniMap.planMeta.v1",
  sidebarHidden: "miniMap.sidebarHidden.v1",
};

const MAX_HISTORY_RUNS = 80;

function safeParseJSON(rawValue, fallbackValue) {
  if (!rawValue) return fallbackValue;
  try {
    const parsed = JSON.parse(rawValue);
    return parsed ?? fallbackValue;
  } catch (error) {
    return fallbackValue;
  }
}

function readArray(key) {
  const parsed = safeParseJSON(localStorage.getItem(key), []);
  return Array.isArray(parsed) ? parsed : [];
}

function writeArray(key, items) {
  localStorage.setItem(key, JSON.stringify(Array.isArray(items) ? items : []));
}

function sortByCreatedAtDesc(runs) {
  return [...runs].sort((a, b) => {
    const aTime = new Date(a.createdAt || 0).getTime();
    const bTime = new Date(b.createdAt || 0).getTime();
    return bTime - aTime;
  });
}

function historyRunKey(run) {
  const ids = Array.isArray(run?.placeIds) ? run.placeIds.join("|") : "";
  const title = typeof run?.title === "string" ? run.title.trim().toLowerCase() : "";
  return `${ids}::${title}`;
}

function dedupeHistoryRuns(runs) {
  const seen = new Set();
  const deduped = [];
  runs.forEach((run) => {
    const key = historyRunKey(run);
    if (!key || seen.has(key)) return;
    seen.add(key);
    deduped.push(run);
  });
  return deduped;
}

export function migrateStorageV1toV2(placeById) {
  const existingVersion = localStorage.getItem(STORAGE_KEYS.migrationFlag);
  const shouldMigrateLegacy = existingVersion !== "2";

  if (!localStorage.getItem(STORAGE_KEYS.savedRuns)) {
    const legacySaved = shouldMigrateLegacy
      ? readArray(LEGACY_KEYS.savedRuns)
          .map((run) => normalizeRunRecord(run, placeById, "saved"))
          .filter(Boolean)
      : [];
    writeArray(STORAGE_KEYS.savedRuns, sortByCreatedAtDesc(legacySaved));
  }

  if (!localStorage.getItem(STORAGE_KEYS.historyRuns)) {
    writeArray(STORAGE_KEYS.historyRuns, []);
  }

  if (!localStorage.getItem(STORAGE_KEYS.publishedRuns)) {
    writeArray(STORAGE_KEYS.publishedRuns, []);
  }

  if (!localStorage.getItem(STORAGE_KEYS.planMeta)) {
    const legacyMeta = shouldMigrateLegacy
      ? safeParseJSON(localStorage.getItem(LEGACY_KEYS.planMeta), {})
      : {};
    const nextMeta = {
      title:
        typeof legacyMeta.title === "string" && legacyMeta.title.trim()
          ? legacyMeta.title.trim()
          : defaultPlanTitle(),
      vibe:
        typeof legacyMeta.vibe === "string" && legacyMeta.vibe.trim()
          ? legacyMeta.vibe.trim()
          : defaultVibe(),
      notesByPlaceId:
        legacyMeta.notesByPlaceId && typeof legacyMeta.notesByPlaceId === "object"
          ? legacyMeta.notesByPlaceId
          : {},
    };
    localStorage.setItem(STORAGE_KEYS.planMeta, JSON.stringify(nextMeta));
  }

  if (!localStorage.getItem(STORAGE_KEYS.sidebarHidden)) {
    const legacySidebarHidden =
      shouldMigrateLegacy && localStorage.getItem(LEGACY_KEYS.sidebarHidden) === "1";
    localStorage.setItem(STORAGE_KEYS.sidebarHidden, legacySidebarHidden ? "1" : "0");
  }

  localStorage.setItem(STORAGE_KEYS.migrationFlag, "2");
}

export function loadPlanMeta() {
  const parsed = safeParseJSON(localStorage.getItem(STORAGE_KEYS.planMeta), {});
  return {
    title:
      typeof parsed.title === "string" && parsed.title.trim()
        ? parsed.title.trim()
        : defaultPlanTitle(),
    vibe:
      typeof parsed.vibe === "string" && parsed.vibe.trim()
        ? parsed.vibe.trim()
        : defaultVibe(),
    notesByPlaceId:
      parsed.notesByPlaceId && typeof parsed.notesByPlaceId === "object"
        ? parsed.notesByPlaceId
        : {},
  };
}

export function persistPlanMeta(planMeta) {
  const payload = {
    title:
      typeof planMeta?.title === "string" && planMeta.title.trim()
        ? planMeta.title.trim()
        : defaultPlanTitle(),
    vibe:
      typeof planMeta?.vibe === "string" && planMeta.vibe.trim()
        ? planMeta.vibe.trim()
        : defaultVibe(),
    notesByPlaceId:
      planMeta?.notesByPlaceId && typeof planMeta.notesByPlaceId === "object"
        ? planMeta.notesByPlaceId
        : {},
  };
  localStorage.setItem(STORAGE_KEYS.planMeta, JSON.stringify(payload));
}

export function loadSavedRuns(placeById) {
  return sortByCreatedAtDesc(
    readArray(STORAGE_KEYS.savedRuns)
      .map((run) => normalizeRunRecord(run, placeById, "saved"))
      .filter(Boolean)
  );
}

export function persistSavedRuns(runs) {
  writeArray(STORAGE_KEYS.savedRuns, sortByCreatedAtDesc(runs));
}

export function upsertSavedRun(run, placeById) {
  const normalized = normalizeRunRecord(run, placeById, "saved");
  if (!normalized) return loadSavedRuns(placeById);

  const current = loadSavedRuns(placeById);
  const index = current.findIndex((item) => item.id === normalized.id);
  if (index >= 0) {
    current[index] = { ...current[index], ...normalized };
  } else {
    current.unshift(normalized);
  }
  persistSavedRuns(current);
  return current;
}

export function renameSavedRun(runId, newTitle, placeById) {
  if (typeof runId !== "string" || !runId) return loadSavedRuns(placeById);
  const title = typeof newTitle === "string" ? newTitle.trim() : "";
  if (!title) return loadSavedRuns(placeById);

  const current = loadSavedRuns(placeById).map((run) =>
    run.id === runId ? { ...run, title } : run
  );
  persistSavedRuns(current);
  return current;
}

export function removeSavedRun(runId, placeById) {
  const nextRuns = loadSavedRuns(placeById).filter((run) => run.id !== runId);
  persistSavedRuns(nextRuns);
  return nextRuns;
}

export function loadHistoryRuns(placeById) {
  return dedupeHistoryRuns(
    sortByCreatedAtDesc(
      readArray(STORAGE_KEYS.historyRuns)
        .map((run) => normalizeRunRecord(run, placeById, "history"))
        .filter(Boolean)
    )
  );
}

export function appendHistoryRun(run, placeById, source = "history") {
  const normalized = normalizeRunRecord(
    {
      ...run,
      source,
      createdAt: new Date().toISOString(),
    },
    placeById,
    "history"
  );

  if (!normalized) return loadHistoryRuns(placeById);

  const incomingKey = historyRunKey(normalized);
  const current = loadHistoryRuns(placeById).filter((item) => historyRunKey(item) !== incomingKey);
  current.unshift(normalized);
  const trimmed = dedupeHistoryRuns(current).slice(0, MAX_HISTORY_RUNS);
  writeArray(STORAGE_KEYS.historyRuns, trimmed);
  return trimmed;
}

export function loadPublishedRuns(placeById) {
  return sortByCreatedAtDesc(
    readArray(STORAGE_KEYS.publishedRuns)
      .map((run) => normalizeRunRecord(run, placeById, "published"))
      .filter((run) => run && run.isPublished && run.moderationStatus !== "blocked")
  );
}

export function upsertPublishedRun(run, placeById) {
  const normalized = normalizeRunRecord(
    {
      ...run,
      isPublished: true,
      moderationStatus: run?.moderationStatus || "approved",
    },
    placeById,
    "published"
  );
  if (!normalized) return loadPublishedRuns(placeById);

  const current = loadPublishedRuns(placeById);
  const index = current.findIndex((item) => item.id === normalized.id);
  if (index >= 0) {
    current[index] = { ...current[index], ...normalized, isPublished: true };
  } else {
    current.unshift({ ...normalized, isPublished: true });
  }
  writeArray(STORAGE_KEYS.publishedRuns, sortByCreatedAtDesc(current));
  return loadPublishedRuns(placeById);
}

export function loadSidebarHidden() {
  return localStorage.getItem(STORAGE_KEYS.sidebarHidden) === "1";
}

export function persistSidebarHidden(hidden) {
  localStorage.setItem(STORAGE_KEYS.sidebarHidden, hidden ? "1" : "0");
}
