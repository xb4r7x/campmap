#!/usr/bin/env python3
"""Convert GPX files into campmap's points.json.

Usage:
    python3 gpx_to_geojson.py                          # scan ./gpx/*.gpx
    python3 gpx_to_geojson.py path/to/gpxfiles
    python3 gpx_to_geojson.py --category-map "Tent Site=Tent,RV Site=RV"

Scans a directory for *.gpx, reads every <wpt> (waypoint) as a campsite and
writes points.json — plain GeoJSON, ready to be encrypted with:

    python3 generate_points.py --password 'your password'

Category mapping: GPX has no standard category field. The converter uses the
<type> element if present, else <sym>, else "Unknown", then applies any
--category-map overrides. Run it once WITHOUT a map to see what raw values
your files contain, then re-run with a mapping to clean them up.
"""

import argparse
import glob
import json
import os
import sys
import xml.etree.ElementTree as ET

NS = {"g": "http://www.topografix.com/GPX/1/1"}


def child_text(el, tag):
    node = el.find(f"g:{tag}", NS)
    return node.text.strip() if node is not None and node.text else None


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("gpx_dir", nargs="?", default="gpx",
                        help="directory containing *.gpx files (default: gpx)")
    parser.add_argument("--category-map", default="",
                        help='e.g. "Tent Site=Tent,RV Site=RV"')
    parser.add_argument("--out", default="points.json")
    args = parser.parse_args()

    category_map = dict(kv.split("=", 1) for kv in args.category_map.split(",") if kv)

    files = sorted(glob.glob(os.path.join(args.gpx_dir, "*.gpx")))
    if not files:
        print(f"No .gpx files found in {args.gpx_dir}/")
        sys.exit(1)

    features = []
    raw_values = set()
    for path in files:
        root = ET.parse(path).getroot()
        for wpt in root.findall("g:wpt", NS):
            lat = float(wpt.get("lat"))
            lon = float(wpt.get("lon"))
            name = child_text(wpt, "name") or "Unnamed"
            desc = child_text(wpt, "desc")
            raw = child_text(wpt, "type") or child_text(wpt, "sym") or "Unknown"
            raw_values.add(raw)
            features.append({
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [round(lon, 6), round(lat, 6)],
                },
                "properties": {
                    "id": len(features) + 1,
                    "name": name,
                    "category": category_map.get(raw, raw),
                    "price": None,
                    "rating": None,
                    "location": None,
                    "description": desc,
                },
            })

    out = {"type": "FeatureCollection", "features": features}
    with open(args.out, "w", encoding="utf-8") as fh:
        json.dump(out, fh, separators=(",", ":"))

    print(f"Wrote {len(features)} features to {args.out} from {len(files)} file(s)")
    print(f"Raw category values seen: {sorted(raw_values)}")
    if not category_map:
        print('Re-run with --category-map "RAW=Clean,..." to tidy category names.')


if __name__ == "__main__":
    main()
