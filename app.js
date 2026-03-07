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
const toast = document.getElementById("toast");

const state = {
  activeCategory: "all",
};

let toastTimeoutId = null;
const CALISTHENICS_ICON_ID = "calisthenics-emblem";
const CALISTHENICS_ICON_PATH =
  "./assets/circle-greek-frame-round-meander-border-decoration-elements-pattern-png.png";

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

function ensureMapImages() {
  if (map.hasImage(CALISTHENICS_ICON_ID)) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    map.loadImage(CALISTHENICS_ICON_PATH, (error, image) => {
      if (error || !image) {
        console.error(error || new Error("Failed to load calisthenics icon"));
        resolve();
        return;
      }

      if (!map.hasImage(CALISTHENICS_ICON_ID)) {
        map.addImage(CALISTHENICS_ICON_ID, image);
      }
      resolve();
    });
  });
}

function allAreaFeatures() {
  return Array.isArray(WORKOUT_AREAS_GEOJSON.features) ? WORKOUT_AREAS_GEOJSON.features : [];
}

function allSegmentFeatures() {
  return Array.isArray(WORKOUT_SEGMENTS_GEOJSON.features) ? WORKOUT_SEGMENTS_GEOJSON.features : [];
}

function filteredAreaFeatures() {
  const features = allAreaFeatures();
  if (state.activeCategory === "all") return features;
  return features.filter((feature) => feature?.properties?.category === state.activeCategory);
}

function filteredSegmentFeatures() {
  const features = allSegmentFeatures();
  if (state.activeCategory === "all") return features;
  return features.filter((feature) => feature?.properties?.category === state.activeCategory);
}

if (!config.accessToken) {
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
        "icon-size": ["interpolate", ["linear"], ["zoom"], 10, 0.09, 15, 0.13],
        "icon-allow-overlap": true,
      },
      paint: {
        "icon-opacity": 0.96,
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
        "text-color": "rgba(120, 77, 70, 0.94)",
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

function applyCategorySelection(category) {
  state.activeCategory = category;

  categoryNav.querySelectorAll(".rail-link").forEach((button) => {
    if (!(button instanceof HTMLButtonElement)) return;
    button.classList.toggle("is-active", button.dataset.category === state.activeCategory);
  });

  refreshMapSources();
}

function wireUiEvents() {
  categoryNav.querySelectorAll(".rail-link").forEach((button) => {
    if (!(button instanceof HTMLButtonElement)) return;
    button.addEventListener("click", () => {
      applyCategorySelection(button.dataset.category || "all");
    });
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
  wireUiEvents();
  wireMapEvents();
  applyCategorySelection("all");

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
