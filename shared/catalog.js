const FALLBACK_CENTER = [-97.7431, 30.2672];

function normalizePlace(rawPlace, index) {
  if (!rawPlace || typeof rawPlace !== "object") return null;
  if (!Array.isArray(rawPlace.coordinates) || rawPlace.coordinates.length !== 2) return null;
  const [lng, lat] = rawPlace.coordinates;
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;

  const id = typeof rawPlace.id === "string" && rawPlace.id.trim() ? rawPlace.id.trim() : `place-${index + 1}`;
  const name = typeof rawPlace.name === "string" && rawPlace.name.trim() ? rawPlace.name.trim() : `Place ${index + 1}`;
  const address = typeof rawPlace.address === "string" ? rawPlace.address : "";
  const website = typeof rawPlace.website === "string" ? rawPlace.website : "";
  const category = typeof rawPlace.category === "string" ? rawPlace.category.toLowerCase() : "restaurant";

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
  if (category === "coffee") return "Coffee";
  if (category === "bar") return "Drinks";
  return "Dinner";
}

export function categoryPillClass(category) {
  if (category === "coffee") return "pill pill-coffee";
  if (category === "bar") return "pill pill-bar";
  return "pill pill-restaurant";
}

export function categoryToneClass(category) {
  if (category === "coffee") return "tone-coffee";
  if (category === "bar") return "tone-bar";
  return "tone-restaurant";
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
  const rating = (4.1 + ((seed % 8) * 0.1)).toFixed(1);
  const price = ["$", "$$", "$$$"][seed % 3];
  const tagsByCategory = {
    coffee: ["quiet", "bright", "cozy"],
    restaurant: ["chef-driven", "date spot", "local fave"],
    bar: ["cocktails", "late-night", "lively"],
  };
  const tagPool = tagsByCategory[place.category] || ["local"];
  const tag = tagPool[seed % tagPool.length];
  return `${rating} stars, ${price}, ${tag}`;
}
