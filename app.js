import {
  CATEGORY_META,
  WORKOUT_AREAS_GEOJSON,
  WORKOUT_SEGMENTS_GEOJSON,
} from "./data/workout-areas.js";

const config = {
  ...(window.APP_CONFIG || {}),
  ...(window.MAPBOX_CONFIG || {}),
};

const categoryNav = document.getElementById("category-nav");
const notesToggleButton = document.getElementById("notes-toggle");
const notesPanel = document.getElementById("notes-panel");
const notesFilters = document.getElementById("notes-filters");
const notesList = document.getElementById("notes-list");
const toast = document.getElementById("toast");
const FITNESS_CATEGORIES = new Set(Object.keys(CATEGORY_META));
const ROOT_MENU_ITEMS = [
  { key: "all", label: "all" },
  { key: "coffee", label: "coffee" },
  { key: "fitness", label: "fitness" },
];
const NOTES_FILTER_ITEMS = [
  { key: "all", label: "all" },
  { key: "calisthenics", label: "calisthenics" },
  { key: "trail", label: "trails" },
  { key: "track", label: "tracks" },
  { key: "hill", label: "hills" },
];

const state = {
  activeDomain: "all",
  notesOpen: false,
  notesCategory: "all",
};

let toastTimeoutId = null;
const CALISTHENICS_ICON_ID = "calisthenics-emblem";
const CALISTHENICS_ICON_PATH = "./assets/marker_lightblue-removebg-preview.png";
const HILL_ICON_ID = "hill-emblem";
const HILL_ICON_PATH = "./assets/marker_yellow-removebg-preview.png";

function showToast(message) {
  if (!message || !toast) return;
  toast.textContent = message;
  toast.classList.remove("hidden");
  if (toastTimeoutId) clearTimeout(toastTimeoutId);
  toastTimeoutId = window.setTimeout(() => {
    toast.classList.add("hidden");
  }, 1800);
}

function featureCollection(features) {
  return {
    type: "FeatureCollection",
    features,
  };
}

function showFatalConfigError(message) {
  if (toast) {
    toast.textContent = message;
    toast.classList.remove("hidden");
  }

  const existing = document.getElementById("fatal-config-error");
  if (existing) return;

  const banner = document.createElement("div");
  banner.id = "fatal-config-error";
  banner.style.position = "fixed";
  banner.style.left = "28px";
  banner.style.bottom = "28px";
  banner.style.zIndex = "20";
  banner.style.maxWidth = "420px";
  banner.style.padding = "14px 16px";
  banner.style.background = "rgba(32, 37, 44, 0.94)";
  banner.style.color = "#f4f6f9";
  banner.style.borderRadius = "12px";
  banner.style.fontSize = "14px";
  banner.style.lineHeight = "1.4";
  banner.textContent = message;
  document.body.appendChild(banner);
}

function categoryColorExpression() {
  return [
    "match",
    ["get", "category"],
    "calisthenics",
    CATEGORY_META.calisthenics.color,
    "track",
    CATEGORY_META.track.color,
    "trail",
    CATEGORY_META.trail.color,
    "hill",
    CATEGORY_META.hill.color,
    "#6e7782",
  ];
}

function ensureMapImage(imageId, imagePath, label) {
  if (map.hasImage(imageId)) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    map.loadImage(imagePath, (error, image) => {
      if (error || !image) {
        console.error(error || new Error(`Failed to load ${label} icon`));
        resolve();
        return;
      }

      if (!map.hasImage(imageId)) {
        map.addImage(imageId, image);
      }
      resolve();
    });
  });
}

function ensureMapImages() {
  return Promise.all([
    ensureMapImage(CALISTHENICS_ICON_ID, CALISTHENICS_ICON_PATH, "calisthenics"),
    ensureMapImage(HILL_ICON_ID, HILL_ICON_PATH, "hill"),
  ]);
}

function allAreaFeatures() {
  return Array.isArray(WORKOUT_AREAS_GEOJSON.features) ? WORKOUT_AREAS_GEOJSON.features : [];
}

function allSegmentFeatures() {
  return Array.isArray(WORKOUT_SEGMENTS_GEOJSON.features) ? WORKOUT_SEGMENTS_GEOJSON.features : [];
}

function inferFeatureDomain(feature) {
  const explicitDomain = feature?.properties?.domain;
  if (explicitDomain) return explicitDomain;

  const category = feature?.properties?.category;
  if (FITNESS_CATEGORIES.has(category)) return "fitness";
  if (category === "coffee" || category === "cafe") return "coffee";
  return "all";
}

function filteredAreaFeatures() {
  const features = allAreaFeatures();
  if (state.activeDomain === "all") return features;
  if (state.activeDomain === "coffee") {
    return features.filter((feature) => inferFeatureDomain(feature) === "coffee");
  }
  return features.filter((feature) => inferFeatureDomain(feature) === "fitness");
}

function filteredSegmentFeatures() {
  const features = allSegmentFeatures().filter((feature) => feature?.properties?.hidden !== true);
  if (state.activeDomain === "all") return features;
  if (state.activeDomain === "coffee") {
    return features.filter((feature) => inferFeatureDomain(feature) === "coffee");
  }
  return features.filter((feature) => inferFeatureDomain(feature) === "fitness");
}

function buildRailButton({ label, key, kind }) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.dataset.key = key;

  button.className = "rail-link";
  button.dataset.action = "select";

  const isActive = state.activeDomain === key;
  if (isActive) {
    button.classList.add("is-active");
  }
  return button;
}

function renderNav() {
  if (!categoryNav) return;
  categoryNav.innerHTML = "";

  ROOT_MENU_ITEMS.forEach((item) => {
    categoryNav.appendChild(buildRailButton({ ...item, kind: "item" }));
  });
}

function getNotesFeatures() {
  const features = [...allAreaFeatures(), ...allSegmentFeatures().filter((feature) => feature?.properties?.hidden !== true)].filter(
    (feature) => inferFeatureDomain(feature) === "fitness",
  );

  if (state.notesCategory === "all") {
    return features;
  }

  return features.filter((feature) => feature?.properties?.category === state.notesCategory);
}

function renderNotesFilters() {
  if (!notesFilters) return;
  notesFilters.innerHTML = "";

  NOTES_FILTER_ITEMS.forEach((item) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "notes-filter";
    if (state.notesCategory === item.key) {
      button.classList.add("is-active");
    }
    button.dataset.key = item.key;
    button.textContent = item.label;
    notesFilters.appendChild(button);
  });
}

function focusFeature(feature) {
  if (!feature) return;

  if (feature.geometry?.type === "Point") {
    focusArea(feature, true);
    return;
  }

  if (feature.geometry?.type === "LineString") {
    const coordinates = feature.geometry.coordinates || [];
    if (!coordinates.length) return;

    const bounds = new mapboxgl.LngLatBounds(coordinates[0], coordinates[0]);
    coordinates.forEach((coord) => bounds.extend(coord));
    map.fitBounds(bounds, {
      padding: { top: 120, right: 120, bottom: 120, left: 120 },
      duration: 760,
    });

    const midpoint = coordinates[Math.floor(coordinates.length / 2)];
    new mapboxgl.Popup({ offset: 10 })
      .setLngLat(midpoint)
      .setHTML(segmentPopupHtml(feature.properties || {}))
      .addTo(map);
  }
}

function renderNotesList() {
  if (!notesList) return;
  notesList.innerHTML = "";

  const features = getNotesFeatures().sort((a, b) =>
    (a.properties?.name || "").localeCompare(b.properties?.name || ""),
  );

  if (!features.length) {
    const empty = document.createElement("div");
    empty.className = "notes-empty";
    empty.textContent = "No mapped spots in this category yet.";
    notesList.appendChild(empty);
    return;
  }

  features.forEach((feature, index) => {
    const props = feature.properties || {};
    const category = props.category || "fitness";
    const item = document.createElement("button");
    item.type = "button";
    item.className = "notes-item";
    item.dataset.index = String(index);

    const categoryLabel = CATEGORY_META[category]?.label || category;

    item.innerHTML = `
      <div class="notes-item-head">
        <p class="notes-item-title">${props.name || "Untitled spot"}</p>
        <span class="notes-item-leader" aria-hidden="true"></span>
        <p class="notes-item-meta is-${category}">
          <span class="notes-item-meta-dot" aria-hidden="true"></span>
          <span>${categoryLabel}</span>
        </p>
      </div>
    `;

    item.addEventListener("click", () => {
      focusFeature(features[index]);
    });

    notesList.appendChild(item);
  });
}

function syncNotesPanel() {
  if (!notesPanel || !notesToggleButton) return;

  notesPanel.classList.toggle("hidden", !state.notesOpen);
  notesToggleButton.classList.toggle("is-active", state.notesOpen);
  notesToggleButton.setAttribute("aria-expanded", String(state.notesOpen));
  notesToggleButton.textContent = state.notesOpen ? "close notes" : "notes";

  if (state.notesOpen) {
    renderNotesFilters();
    renderNotesList();
  }
}

if (!config.accessToken) {
  showFatalConfigError("Mapbox token missing. Check deployed config.js or Render MAPBOX_ACCESS_TOKEN.");
  throw new Error("MAPBOX_CONFIG.accessToken is required");
}

mapboxgl.accessToken = config.accessToken;

const map = new mapboxgl.Map({
  container: "map",
  style: config.style || "mapbox://styles/mapbox/light-v11",
  center: config.center || [-97.7431, 30.2672],
  zoom: config.zoom ?? 11.8,
  pitch: config.pitch ?? 0,
  bearing: config.bearing ?? 0,
  antialias: true,
});

map.addControl(new mapboxgl.NavigationControl(), "top-right");
map.addControl(new mapboxgl.ScaleControl(), "bottom-right");

let hoverSegmentPopup = null;

function setupMapSourcesAndLayers() {
  if (!map.getSource("workout-areas")) {
    map.addSource("workout-areas", {
      type: "geojson",
      data: featureCollection([]),
    });
  }

  if (!map.getSource("workout-segments")) {
    map.addSource("workout-segments", {
      type: "geojson",
      data: featureCollection([]),
    });
  }

  if (!map.getLayer("workout-segment-casing")) {
    map.addLayer({
      id: "workout-segment-casing",
      type: "line",
      source: "workout-segments",
      layout: {
        "line-cap": "round",
        "line-join": "round",
      },
      paint: {
        "line-color": "rgba(255,255,255,0.92)",
        "line-width": ["interpolate", ["linear"], ["zoom"], 10, 6, 15, 10.5],
        "line-opacity": 0.95,
      },
    });
  }

  if (!map.getLayer("workout-segment-line")) {
    map.addLayer({
      id: "workout-segment-line",
      type: "line",
      source: "workout-segments",
      layout: {
        "line-cap": "round",
        "line-join": "round",
      },
      paint: {
        "line-color": [
          "match",
          ["get", "category"],
          "trail",
          CATEGORY_META.trail.color,
          "track",
          CATEGORY_META.track.color,
          "calisthenics",
          CATEGORY_META.calisthenics.color,
          "hill",
          CATEGORY_META.hill.color,
          "#8791a0",
        ],
        "line-width": ["interpolate", ["linear"], ["zoom"], 10, 4.2, 15, 7.2],
        "line-opacity": [
          "match",
          ["get", "category"],
          "trail",
          0.5,
          "hill",
          0.9,
          "track",
          0.9,
          "calisthenics",
          0.9,
          0.9,
        ],
      },
    });
  }

  if (!map.getLayer("workout-area-marker")) {
    map.addLayer({
      id: "workout-area-marker",
      type: "symbol",
      source: "workout-areas",
      layout: {
        "icon-image": [
          "match",
          ["get", "category"],
          "calisthenics",
          CALISTHENICS_ICON_ID,
          "marker-15",
        ],
        "icon-size": [
          "interpolate",
          ["linear"],
          ["zoom"],
          10,
          ["match", ["get", "category"], "calisthenics", 0.042, 0.8],
          15,
          ["match", ["get", "category"], "calisthenics", 0.078, 1],
        ],
        "icon-allow-overlap": true,
      },
      paint: {
        "icon-opacity": 0.96,
      },
    });
  }

  if (!map.getLayer("workout-segment-marker")) {
    map.addLayer({
      id: "workout-segment-marker",
      type: "symbol",
      source: "workout-segments",
      filter: ["==", ["get", "category"], "hill"],
      layout: {
        "symbol-placement": "line-center",
        "icon-image": HILL_ICON_ID,
        "icon-size": ["interpolate", ["linear"], ["zoom"], 10, 0.045, 15, 0.08],
        "icon-allow-overlap": true,
      },
      paint: {
        "icon-opacity": 0.97,
      },
    });
  }

  if (!map.getLayer("workout-area-label")) {
    map.addLayer({
      id: "workout-area-label",
      type: "symbol",
      source: "workout-areas",
      layout: {
        "text-field": ["get", "name"],
        "text-font": ["DIN Pro Medium", "Arial Unicode MS Regular"],
        "text-size": ["interpolate", ["linear"], ["zoom"], 11, 11, 15, 13],
        "text-offset": [0, 2.05],
        "text-anchor": "top",
        "text-allow-overlap": false,
      },
      paint: {
        "text-color": "rgba(72, 82, 95, 0.92)",
        "text-halo-color": "rgba(247, 245, 240, 0.96)",
        "text-halo-width": 1.4,
        "text-opacity": ["interpolate", ["linear"], ["zoom"], 11, 0, 12, 1],
      },
    });
  }

  if (!map.getLayer("workout-segment-label")) {
    map.addLayer({
      id: "workout-segment-label",
      type: "symbol",
      source: "workout-segments",
      filter: ["==", ["get", "category"], "hill"],
      layout: {
        "symbol-placement": "line-center",
        "text-field": ["get", "name"],
        "text-font": ["DIN Pro Medium", "Arial Unicode MS Regular"],
        "text-size": ["interpolate", ["linear"], ["zoom"], 11, 11, 15, 13],
        "text-allow-overlap": false,
        "text-ignore-placement": false,
      },
      paint: {
        "text-color": "#ECAA24",
        "text-halo-color": "rgba(247, 245, 240, 0.98)",
        "text-halo-width": 1.4,
        "text-opacity": ["interpolate", ["linear"], ["zoom"], 11, 0, 12, 1],
      },
    });
  }
}

function refreshMapSources() {
  const areaFeatures = filteredAreaFeatures();
  const segmentFeatures = filteredSegmentFeatures();

  map.getSource("workout-areas")?.setData(featureCollection(areaFeatures));
  map.getSource("workout-segments")?.setData(featureCollection(segmentFeatures));
}

function popupHtml(feature) {
  const props = feature.properties || {};
  const category = CATEGORY_META[props.category]?.label || "workout";
  const neighborhood = props.neighborhood || "austin";
  return `<p class="popup-title">${props.name || "Workout Area"}</p><p class="popup-meta">${category} • ${neighborhood}</p>`;
}

function segmentPopupHtml(props = {}) {
  const category = CATEGORY_META[props.category]?.label || "segment";
  const metaParts = [category];
  if (props.distanceMi) metaParts.push(`${props.distanceMi} mi`);
  if (props.elevationFt) metaParts.push(`${props.elevationFt} ft gain`);
  return `<p class="popup-title">${props.name || "Training Segment"}</p><p class="popup-meta">${metaParts.join(" • ")}</p>`;
}

function focusArea(feature, fly = true) {
  if (!feature) return;

  const coords = feature.geometry?.coordinates;
  if (!Array.isArray(coords)) return;

  if (fly) {
    map.easeTo({
      center: coords,
      zoom: Math.max(map.getZoom(), 13.9),
      duration: 720,
    });
  }

  new mapboxgl.Popup({ offset: 10 }).setLngLat(coords).setHTML(popupHtml(feature)).addTo(map);
}

function fitToCurrentData() {
  const features = [...filteredAreaFeatures(), ...filteredSegmentFeatures()];
  if (!features.length) return;

  const firstFeature = features[0];
  const firstCoordinate =
    firstFeature.geometry.type === "Point"
      ? firstFeature.geometry.coordinates
      : firstFeature.geometry.coordinates[0];

  const bounds = new mapboxgl.LngLatBounds(firstCoordinate, firstCoordinate);
  features.forEach((feature) => {
    if (feature.geometry.type === "Point") {
      bounds.extend(feature.geometry.coordinates);
      return;
    }
    feature.geometry.coordinates.forEach((coord) => bounds.extend(coord));
  });

  map.fitBounds(bounds, {
    padding: { top: 120, right: 60, bottom: 90, left: 60 },
    duration: 760,
  });
}

function applyDomainSelection(domain) {
  state.activeDomain = domain;
  renderNav();
  refreshMapSources();

  if (domain === "coffee" && !filteredAreaFeatures().length && !filteredSegmentFeatures().length) {
    showToast("No coffee spots loaded yet.");
  }
}

function wireUiEvents() {
  if (!categoryNav) return;

  categoryNav.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement)) return;

    const key = target.dataset.key || "all";
    applyDomainSelection(key);
  });

  notesToggleButton?.addEventListener("click", () => {
    state.notesOpen = !state.notesOpen;
    syncNotesPanel();
  });

  notesFilters?.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement)) return;
    state.notesCategory = target.dataset.key || "all";
    renderNotesFilters();
    renderNotesList();
  });
}

function wireMapEvents() {
  map.on("click", "workout-area-marker", (event) => {
    const feature = event.features && event.features[0];
    if (!feature) return;
    focusArea(feature, true);
  });

  map.on("click", "workout-segment-line", (event) => {
    const feature = event.features && event.features[0];
    if (!feature) return;

    new mapboxgl.Popup({ offset: 10 })
      .setLngLat(event.lngLat)
      .setHTML(segmentPopupHtml(feature.properties || {}))
      .addTo(map);
  });

  map.on("mouseenter", "workout-segment-line", (event) => {
    const feature = event.features && event.features[0];
    if (!feature) return;

    if (hoverSegmentPopup) {
      hoverSegmentPopup.remove();
    }
    hoverSegmentPopup = new mapboxgl.Popup({
      offset: 10,
      closeButton: false,
      closeOnClick: false,
    })
      .setLngLat(event.lngLat)
      .setHTML(segmentPopupHtml(feature.properties || {}))
      .addTo(map);
  });

  map.on("mousemove", "workout-segment-line", (event) => {
    const feature = event.features && event.features[0];
    if (!feature || !hoverSegmentPopup) return;
    hoverSegmentPopup
      .setLngLat(event.lngLat)
      .setHTML(segmentPopupHtml(feature.properties || {}));
  });

  map.on("mouseleave", "workout-segment-line", () => {
    if (!hoverSegmentPopup) return;
    hoverSegmentPopup.remove();
    hoverSegmentPopup = null;
  });

  ["workout-area-marker", "workout-segment-line"].forEach((layerId) => {
    map.on("mouseenter", layerId, () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", layerId, () => {
      map.getCanvas().style.cursor = "";
    });
  });
}

map.on("load", async () => {
  await ensureMapImages();
  setupMapSourcesAndLayers();
  renderNav();
  syncNotesPanel();
  wireUiEvents();
  wireMapEvents();
  refreshMapSources();

  if (!allAreaFeatures().length && !allSegmentFeatures().length) {
    showToast("No workout data loaded yet.");
  } else {
    fitToCurrentData();
  }
});

map.on("error", (event) => {
  console.error(event.error);
  showToast("Mapbox error. Check token or style permissions.");
});
