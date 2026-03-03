const EARTH_RADIUS_KM = 6371;
const MILES_PER_KM = 0.621371;

export function distanceKm(aCoordinates, bCoordinates) {
  if (!Array.isArray(aCoordinates) || !Array.isArray(bCoordinates)) return 0;
  const [aLng, aLat] = aCoordinates;
  const [bLng, bLat] = bCoordinates;
  if (![aLng, aLat, bLng, bLat].every(Number.isFinite)) return 0;

  const lat1 = (aLat * Math.PI) / 180;
  const lat2 = (bLat * Math.PI) / 180;
  const deltaLat = lat2 - lat1;
  const deltaLng = ((bLng - aLng) * Math.PI) / 180;

  const h =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

export function routeDistanceKm(places) {
  if (!Array.isArray(places) || places.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < places.length - 1; i += 1) {
    total += distanceKm(places[i].coordinates, places[i + 1].coordinates);
  }
  return total;
}

export function kmToMiles(distanceKmValue) {
  if (!Number.isFinite(distanceKmValue)) return 0;
  return distanceKmValue * MILES_PER_KM;
}

export function formatDistanceMiles(distanceKmValue, digits = 1) {
  return `${kmToMiles(distanceKmValue).toFixed(digits)} mi`;
}

export function estimateWalkingTimeMin(distanceKmValue) {
  if (!Number.isFinite(distanceKmValue) || distanceKmValue <= 0) return 0;
  const minutesPerKm = 12;
  return Math.round(distanceKmValue * minutesPerKm);
}

export function estimateDurationMin(stopCount, walkingTimeMin, dwellMinutesPerStop = 35) {
  const safeStops = Number.isFinite(stopCount) ? Math.max(0, stopCount) : 0;
  const safeWalking = Number.isFinite(walkingTimeMin) ? Math.max(0, walkingTimeMin) : 0;
  return Math.round(safeStops * dwellMinutesPerStop + safeWalking);
}

export function formatMinutes(totalMinutes) {
  const rounded = Math.max(0, Math.round(totalMinutes || 0));
  if (rounded < 60) return `${rounded}m`;
  const hours = Math.floor(rounded / 60);
  const minutes = rounded % 60;
  return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
}
