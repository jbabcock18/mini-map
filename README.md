# Fitness Finder

Fitness Finder is a map-first app for finding and organizing outdoor fitness locations.

The initial product focuses on:

1. Discovering fitness spots on a map.
2. Filtering by location type (calisthenics parks, tracks, trails, hills, stairs).
3. Building a route of locations you want to visit.

## Product

### Core concept

Users browse a curated catalog of fitness locations and can build/share an ordered route.

### Core experience

- Builder mode:
  - Browse map markers and inspect location details
  - Filter by category
  - Add locations to a route
  - Reorder route and share/save it
- Discover mode:
  - Route of the day
  - Random route
  - Saved routes
  - Community routes

## Tech Overview

### Runtime architecture

- Main app: `/` (`/index.html` + `/builder/builder.js`)
- Optional discover page entry: `/discover/`
- Shared domain modules in `/shared`:
  - `catalog.js`
  - `metrics.js`
  - `run-model.js`
  - `share-link.js`
  - `storage.js`
- Data files:
  - curated routes: `/data/curated-runs.json`
  - trail overlay sample: `/data/trails.js`

## Local Setup

1. Copy config:

```bash
cp config.example.js config.js
```

2. Add your Mapbox token to `config.js`.

3. Start a static server:

```bash
python3 -m http.server 8000
```

4. Open:

- `http://localhost:8000/`
