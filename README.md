# campmap

A password-protected map of US campgrounds. Built with MapLibre GL + OpenFreeMap
tiles + built-in clustering. Static site, no backend, no API keys, no cost.

Live site: `https://xb4r7x.github.io/campmap/`

## How it works

- **Base map**: [OpenFreeMap](https://openfreemap.org) vector tiles (free, no usage
  limits, no registration). Attribution is included automatically by the style.
- **Data**: GeoJSON is gzip-compressed and **AES-256-GCM encrypted** (key derived
  via PBKDF2 from a password) into `points.json.enc`. The page asks for the
  password, decrypts in the browser, and renders the map. Without the password the
  data is unreadable, even though it's served publicly.
- **Rendering**: MapLibre clusters points at low zoom; clicking a cluster zooms in;
  clicking a marker opens a popup. Categories can be toggled on/off in the top-right
  panel.

## Project layout

```
index.html            page + library includes + password gate + filter UI
style.css             page styling
map.js                map init, clustering, popups, decrypt, category filters
points.json.enc       your data (encrypted, committed)
generate_points.py    sample-data generator (also encrypts with --password)
gpx_to_geojson.py     converts GPX waypoints into points.json
.gitignore            ignores points.json — never commit the plain data
```

## Use your own data

### From GPX files

Drop `.gpx` files into `gpx/`, then:

```bash
python3 gpx_to_geojson.py                      # writes points.json
python3 gpx_to_geojson.py --category-map "Tent Site=Tent,RV Site=RV"
```

Waypoints become campgrounds. The category comes from each waypoint's `<type>`
element, else `<sym>`, else "Unknown" — run it once without a map to see what raw
values your files contain, then map them to clean names.

### Directly

`points.json` is a GeoJSON `FeatureCollection` of Points. Properties shown in the
popup / filters:

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

Only `name` and `category` are required — the rest is optional. Extra fields render
if you extend the popup in `map.js`.

### After changing data: re-encrypt

```bash
python3 generate_points.py --password 'your password'   # reads points.json, writes points.json.enc
```

Use the **same password** the site already uses, or update it if you're changing it.
`points.json` (plaintext) is gitignored and must never be committed.

## Run locally

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

(`file://` won't work — `fetch()` needs an HTTP server.) If `points.json` is
present locally it renders without a password; otherwise you get the gate and it
reads `points.json.enc`.

## Deploy (GitHub Pages)

```bash
git push            # GitHub builds automatically
```

Site lives at `https://xb4r7x.github.io/campmap/`. No build step, no config.

## Notes

- Tile service is the only external dependency. To switch providers, change
  `MAP_STYLE` in `map.js` (e.g. to an OSM raster style) — one line.
- Security model: one shared password, no accounts or revocation. Data security
  equals password strength, and friends who know the password can share it.
- 40,000 points is well within MapLibre's comfort zone. Beyond ~100k, consider a
  PMTiles archive.
