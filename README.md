# Mini Map

Mini Map is a route-planning app for social food and drink adventures.
It is designed for two moments:

1. I want an idea.
2. I want to send a plan.

The product keeps planning simple, visual, and shareable on top of a Mapbox-first experience.

## Product

### Core concept

Users create ordered plans ("runs") across coffee shops, restaurants, and bars, then share them.
Each plan is a sequence of stops with route guidance, quick edit controls, and lightweight notes.

### Core experience

- Builder mode:
  - Create and edit a run
  - Reorder and optimize stop order
  - Add notes per stop
  - Share and save
- Discover mode:
  - Run of the Day
  - Random run
  - Saved runs
  - Community runs
  - Preview any run on the map before using it

### Product principles

- Builder is a tool:
  Focus on clean editing and route clarity.
- Discover is inspiration:
  Browse, preview, then load with one action.
- Every discovery flow ends in:
  `Use this plan`.
- Avoid clutter:
  Progressive disclosure over dense controls.

## Design

### Visual direction

- Map-first interface using Mapbox daytime basemap styling.
- Light, airy sidebar UI with high contrast and clean typography.
- Route-forward visuals:
  primary route and preview route are intentionally prominent.
- Sidebar can hide to maximize full-screen map context.

### Interaction language

- Edit mode vs view mode:
  edit controls appear only when needed.
- Timeline as primary planning object:
  each stop is an itinerary card with order and metadata.
- Fast preview loop:
  selecting discover cards immediately draws route + stops on map.
- Low-friction sharing:
  share actions are always accessible from the header.

### Content language

- "Plan", "Stops", "Timeline", "Travel time", "Share plan", "Save plan"
- Friendly but utility-first copy style.

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
  - curated runs: `/data/curated-runs.json`
  - trail polyline: `/data/trails.js`

### Data contracts

- Share payload via URL query:
  - `?p=<base64url-json>`
  - schema: `{ v: 1, title, vibe, placeIds, source? }`
- localStorage v2 keys:
  - `miniMap.savedRuns.v2`
  - `miniMap.historyRuns.v2`
  - `miniMap.publishedRuns.v2`
  - `miniMap.planMeta.v2`

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
