import {
  estimateDurationMin,
  estimateWalkingTimeMin,
  routeDistanceKm,
} from "./metrics.js";

export const SHARE_PAYLOAD_VERSION = 1;

export function defaultPlanTitle() {
  return "My Plan";
}

export function defaultVibe() {
  return "Golden Hour";
}

export function createRunId(prefix = "run") {
  const randomPart = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${Date.now()}-${randomPart}`;
}

export function buildStopsFromPlaceIds(placeIds, placeById) {
  if (!Array.isArray(placeIds) || !placeById) return [];

  return placeIds
    .map((placeId, index) => {
      const place = placeById.get(placeId);
      if (!place) return null;
      return {
        id: place.id,
        name: place.name,
        address: place.address,
        lat: place.coordinates[1],
        lng: place.coordinates[0],
        type: place.category,
        order: index + 1,
      };
    })
    .filter(Boolean);
}

export function createRunRecord(
  {
    id,
    title,
    vibe,
    placeIds,
    createdAt,
    createdBy,
    isPublished = false,
    isFeatured = false,
    source = "builder",
    moderationStatus = "approved",
  },
  placeById
) {
  const stops = buildStopsFromPlaceIds(placeIds, placeById);
  const distanceKm = routeDistanceKm(
    stops.map((stop) => ({
      coordinates: [stop.lng, stop.lat],
    }))
  );
  const walkingTimeMin = estimateWalkingTimeMin(distanceKm);
  const durationMin = estimateDurationMin(stops.length, walkingTimeMin);

  return {
    id: typeof id === "string" && id.trim() ? id.trim() : createRunId("run"),
    title: typeof title === "string" && title.trim() ? title.trim() : defaultPlanTitle(),
    vibe: typeof vibe === "string" && vibe.trim() ? vibe.trim() : defaultVibe(),
    placeIds: stops.map((stop) => stop.id),
    distanceKm,
    walkingTimeMin,
    durationMin,
    createdAt: createdAt || new Date().toISOString(),
    createdBy: createdBy || null,
    isPublished: Boolean(isPublished),
    isFeatured: Boolean(isFeatured),
    moderationStatus,
    source,
  };
}

export function normalizeRunRecord(rawRun, placeById, fallbackPrefix = "run") {
  if (!rawRun || typeof rawRun !== "object") return null;

  const placeIds = Array.isArray(rawRun.placeIds)
    ? rawRun.placeIds
    : Array.isArray(rawRun.stops)
      ? rawRun.stops.map((stop) => stop && stop.id).filter(Boolean)
      : [];

  const run = createRunRecord(
    {
      id:
        typeof rawRun.id === "string" && rawRun.id.trim()
          ? rawRun.id.trim()
          : createRunId(fallbackPrefix),
      title:
        typeof rawRun.title === "string" && rawRun.title.trim()
          ? rawRun.title.trim()
          : typeof rawRun.name === "string" && rawRun.name.trim()
            ? rawRun.name.trim()
            : defaultPlanTitle(),
      vibe:
        typeof rawRun.vibe === "string" && rawRun.vibe.trim()
          ? rawRun.vibe.trim()
          : defaultVibe(),
      placeIds,
      createdAt:
        typeof rawRun.createdAt === "string" && rawRun.createdAt
          ? rawRun.createdAt
          : new Date().toISOString(),
      createdBy:
        typeof rawRun.createdBy === "string" && rawRun.createdBy.trim()
          ? rawRun.createdBy.trim()
          : typeof rawRun.author === "string" && rawRun.author.trim()
            ? rawRun.author.trim()
            : null,
      isPublished: Boolean(rawRun.isPublished),
      isFeatured: Boolean(rawRun.isFeatured),
      moderationStatus:
        typeof rawRun.moderationStatus === "string"
          ? rawRun.moderationStatus
          : "approved",
      source: typeof rawRun.source === "string" ? rawRun.source : "imported",
    },
    placeById
  );

  if (!run.placeIds.length) return null;
  return run;
}

export function buildSharePayload({ title, vibe, placeIds, source }) {
  return {
    v: SHARE_PAYLOAD_VERSION,
    title: typeof title === "string" && title.trim() ? title.trim() : defaultPlanTitle(),
    vibe: typeof vibe === "string" && vibe.trim() ? vibe.trim() : defaultVibe(),
    placeIds: Array.isArray(placeIds) ? placeIds.filter((id) => typeof id === "string" && id.trim()) : [],
    source: typeof source === "string" && source.trim() ? source.trim() : undefined,
  };
}

export function parseSharePayload(payload, placeById) {
  if (!payload || typeof payload !== "object") return null;
  if (payload.v !== SHARE_PAYLOAD_VERSION) return null;
  if (!Array.isArray(payload.placeIds)) return null;

  const run = normalizeRunRecord(
    {
      id: createRunId("shared"),
      title: payload.title,
      vibe: payload.vibe,
      placeIds: payload.placeIds,
      source: payload.source || "share-link",
      isPublished: false,
      isFeatured: false,
    },
    placeById,
    "shared"
  );

  return run;
}
