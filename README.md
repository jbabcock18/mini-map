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
- `/app-config.js` - tracked app configuration
- `/config.js` - local Mapbox token only
- `/config.example.js` - starter token template

## Local Development

1. Copy `config.example.js` to `config.js`.

2. Set your Mapbox token in `config.js`.

3. Start a static server:

```bash
python3 -m http.server 8000
```

4. Open:

- `http://localhost:8000/`

## Notes

- App settings live in `app-config.js` and are committed to git.
- `config.js` is intentionally gitignored so only the access token stays local.
- Add your own point features to `WORKOUT_AREAS_GEOJSON.features` and line features to `WORKOUT_SEGMENTS_GEOJSON.features`.
