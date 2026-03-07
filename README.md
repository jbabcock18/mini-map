# Mini Map - Austin Workout Explorer

Mini Map is now a map-first fitness discovery app for Austin.

The app helps users answer one question quickly:

**Where should I work out right now?**

It is intentionally not a list-heavy product. The map is the primary interface.

## Product Vision

Mini Map should feel like an exploration tool, not a directory.

Users can discover:
- Calisthenics parks
- Public tracks
- Running trails
- Hill workout zones

Each spot is interactive, filterable, and easy to open in directions.

## Experience Design

### Design goals
- Map-first UI with lightweight floating controls
- Fast, playful exploration (`Surprise Me`)
- High legibility over the basemap
- Minimal friction from discovery to action

### Interaction model
- Category chips filter the map in-place
- Clustered markers keep dense areas readable
- Segment overlays show notable training lines (tempo segments, hill repeats, track loops)
- Detail card appears when a spot is selected
- One-tap `Open Directions`

### Visual style
- Daytime Mapbox Standard basemap
- Soft glassmorphism panels
- Category-coded color system
- Optional heat layer for dense workout regions
- Optional 3D terrain for elevation context

## Mapbox Features Used

- Mapbox GL JS v3
- Standard style with configurable basemap labels
- Marker clustering
- Heatmap layer
- Terrain DEM + exaggeration toggle
- 3D building extrusions (when supported)
- Geolocate, fullscreen, navigation, and scale controls
- Interactive popups and map-driven filtering

## Project Structure

- `/index.html` - app shell and floating UI
- `/styles.css` - visual system and responsive layout
- `/app.js` - map logic and interactions
- `/data/workout-areas.js` - Austin workout points and segments
- `/config.js` - local Mapbox configuration
- `/config.example.js` - starter config template

## Local Development

1. Set your token in `config.js` (or copy from `config.example.js`).

2. Start a static server:

```bash
python3 -m http.server 8000
```

3. Open:

- `http://localhost:8000/`

## Notes

- `/data/workout-areas.js` is intentionally empty right now.
- Add your own point features to `WORKOUT_AREAS_GEOJSON.features` and line features to `WORKOUT_SEGMENTS_GEOJSON.features`.
