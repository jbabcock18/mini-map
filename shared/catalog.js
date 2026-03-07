const FALLBACK_CENTER = [-97.7431, 30.2672];

const CATEGORY_ALIASES = {
  calisthenics: "calisthenics",
  "calisthenics-park": "calisthenics",
  "outdoor-gym": "calisthenics",
  track: "track",
  "public-track": "track",
  "running-track": "track",
  trail: "trail",
  trailhead: "trail",
  "multi-use-trail": "trail",
  hill: "hill",
  "steep-hill": "hill",
  incline: "hill",
  stairs: "stairs",
  "stadium-steps": "stairs",
  "stairs-workout": "stairs",
  coffee: "coffee",
  restaurant: "restaurant",
  bar: "bar",
};

function normalizeCategory(rawCategory) {
  if (typeof rawCategory !== "string" || !rawCategory.trim()) return "trail";
  const normalized = rawCategory.trim().toLowerCase().replace(/\s+/g, "-");
  return CATEGORY_ALIASES[normalized] || normalized;
}

function normalizePlace(rawPlace, index) {
  if (!rawPlace || typeof rawPlace !== "object") return null;
  if (!Array.isArray(rawPlace.coordinates) || rawPlace.coordinates.length !== 2) return null;
  const [lng, lat] = rawPlace.coordinates;
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;

  const id = typeof rawPlace.id === "string" && rawPlace.id.trim() ? rawPlace.id.trim() : `place-${index + 1}`;
  const name = typeof rawPlace.name === "string" && rawPlace.name.trim() ? rawPlace.name.trim() : `Place ${index + 1}`;
  const address = typeof rawPlace.address === "string" ? rawPlace.address : "";
  const website = typeof rawPlace.website === "string" ? rawPlace.website : "";
  const category = normalizeCategory(rawPlace.category);

  return {
    id,
    name,
    address,
    website,
    category,
    coordinates: [lng, lat],
  };
}

export function getConfig() {
  return window.MAPBOX_CONFIG || {};
}

export function getDefaultCenter() {
  const config = getConfig();
  if (Array.isArray(config.center) && config.center.length === 2) {
    const [lng, lat] = config.center;
    if (Number.isFinite(lng) && Number.isFinite(lat)) {
      return [lng, lat];
    }
  }
  return [...FALLBACK_CENTER];
}

export function getPlacesCatalog() {
  const config = getConfig();
  const source = Array.isArray(config.placesCatalog)
    ? config.placesCatalog
    : Array.isArray(config.selectedPlaces)
      ? config.selectedPlaces
      : [];

  return source
    .map((place, index) => normalizePlace(place, index))
    .filter(Boolean);
}

export function buildPlaceById(placesCatalog) {
  return new Map((placesCatalog || []).map((place) => [place.id, place]));
}

export function normalizePlaceIds(placeIds, placeById) {
  if (!Array.isArray(placeIds)) return [];
  const seen = new Set();
  const normalized = [];

  placeIds.forEach((id) => {
    if (typeof id !== "string") return;
    const value = id.trim();
    if (!value || seen.has(value)) return;
    if (placeById && !placeById.has(value)) return;
    seen.add(value);
    normalized.push(value);
  });

  return normalized;
}

export function getPlacesForIds(placeIds, placeById) {
  return normalizePlaceIds(placeIds, placeById)
    .map((id) => placeById.get(id))
    .filter(Boolean);
}

export function categoryLabel(category) {
  const labels = {
    calisthenics: "Calisthenics",
    track: "Track",
    trail: "Trail",
    hill: "Hill",
    stairs: "Stairs",
    coffee: "Coffee",
    bar: "Drinks",
    restaurant: "Dinner",
  };
  return labels[category] || "Location";
}

export function categoryPillClass(category) {
  const classes = {
    calisthenics: "pill pill-calisthenics",
    track: "pill pill-track",
    trail: "pill pill-trail",
    hill: "pill pill-hill",
    stairs: "pill pill-stairs",
    coffee: "pill pill-coffee",
    bar: "pill pill-bar",
    restaurant: "pill pill-restaurant",
  };
  return classes[category] || "pill pill-generic";
}

export function categoryToneClass(category) {
  const classes = {
    calisthenics: "tone-calisthenics",
    track: "tone-track",
    trail: "tone-trail",
    hill: "tone-hill",
    stairs: "tone-stairs",
    coffee: "tone-coffee",
    bar: "tone-bar",
    restaurant: "tone-restaurant",
  };
  return classes[category] || "tone-generic";
}

function hashStringToSeed(input) {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function descriptorForPlace(place) {
  const seed = hashStringToSeed(place.id);
  const intensity = ["easy", "moderate", "hard"][seed % 3];
  const tagsByCategory = {
    calisthenics: ["pull-up bars", "bodyweight-focused", "open-air setup"],
    track: ["flat laps", "interval-friendly", "marked lanes"],
    trail: ["scenic route", "mixed terrain", "steady mileage"],
    hill: ["steep grade", "hill repeats", "power climbs"],
    stairs: ["stair sets", "leg burner", "high-intensity"],
    coffee: ["quiet", "bright", "cozy"],
    restaurant: ["chef-driven", "date spot", "local fave"],
    bar: ["cocktails", "late-night", "lively"],
  };
  const tagPool = tagsByCategory[place.category] || ["training-friendly"];
  const tag = tagPool[seed % tagPool.length];
  return `${tag} • ${intensity} effort`;
}
