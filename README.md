# campmap

A free, static map of ~40,000 US campgrounds. Built with MapLibre GL + OpenFreeMap
tiles + built-in clustering. No backend, no API keys, no cost.

Live site: `https://<your-username>.github.io/campmap/`

## How it works

- **Base map**: [OpenFreeMap](https://openfreemap.org) vector tiles (free, no usage
  limits, no registration). Attribution is included automatically by the style.
- **Data**: `points.json` — a GeoJSON `FeatureCollection` of Points. 40k points is
  ~12 MB raw / ~1.3 MB gzipped (hosts serve it compressed automatically).
- **Rendering**: MapLibre clusters points at low zoom; clicking a cluster zooms in;
  clicking a marker opens a popup with details.

## Project layout

```
index.html            page + library includes
style.css             page styling
map.js                map init, clustering, popups
points.json           your data (generated sample data by default)
generate_points.py    regenerates sample points.json (for testing)
netlify.toml          deploy config for Netlify
```

## Run locally

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

(`file://` won't work — `fetch()` needs an HTTP server.)

## Use your own data

Replace `points.json` with a GeoJSON `FeatureCollection` of Points. Each point's
`properties` are shown in the popup; the map expects:

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": { "type": "Point", "coordinates": [-118.24, 34.05] },
      "properties": {
        "name": "Griffith Observatory Campground",
        "category": "Tent",
        "price": 20,
        "rating": 4.5,
        "location": "Los Angeles, CA",
        "description": "Views of the city at night."
      }
    }
  ]
}
```

Any fields are fine — `map.js` only requires `name`; everything else is optional.
Add extra fields (URL, phone, …) and they'll render if you extend the popup in
`map.js`.

## Deploy (free)

### Option A — Netlify (fastest, no git repo needed)

1. Go to https://app.netlify.com/drop
2. Drag the `campmap` folder onto the page
3. Done — you get a `*.netlify.app` URL; gzip + global CDN included

### Option B — GitHub Pages

1. Create a repo, push this folder to it
2. Repo → **Settings → Pages** → Source: **Deploy from a branch**, branch `main`, folder `/ (root)`
3. Your site is live at `https://<username>.github.io/<repo>/`

## Notes

- Tile service is the only external dependency. To switch providers later, change
  `MAP_STYLE` in `map.js` (e.g. to an OSM raster style) — one line.
- 40,000 points is well within MapLibre's comfort zone. If you grow past ~100k,
  consider a vectorized tile source or dropping to a PMTiles archive.
