#!/usr/bin/env python3
"""Generate sample campground data for campmap.

Usage:
    python3 generate_points.py              # 40,000 points -> points.json
    python3 generate_points.py 100000       # custom count

Points are scattered around major US cities (weighted by population) so the
map looks plausible and the clustering gets exercised. Swap in your own real
data whenever you have it — points.json just needs to be a GeoJSON
FeatureCollection of Points with properties like name / category / price /
rating / location / description.
"""

import json
import math
import random
import sys

# (name, lat, lng, population in millions)
CITIES = [
    ("New York, NY", 40.7128, -74.0060, 8.8),
    ("Los Angeles, CA", 34.0522, -118.2437, 3.9),
    ("Chicago, IL", 41.8781, -87.6298, 2.7),
    ("Houston, TX", 29.7604, -95.3698, 2.3),
    ("Phoenix, AZ", 33.4484, -112.0740, 1.6),
    ("Philadelphia, PA", 39.9526, -75.1652, 1.6),
    ("San Antonio, TX", 29.4241, -98.4936, 1.5),
    ("San Diego, CA", 32.7157, -117.1611, 1.4),
    ("Dallas, TX", 32.7767, -96.7970, 1.3),
    ("San Jose, CA", 37.3382, -121.8863, 1.0),
    ("Austin, TX", 30.2672, -97.7431, 1.0),
    ("Jacksonville, FL", 30.3322, -81.6557, 0.95),
    ("Columbus, OH", 39.9612, -82.9988, 0.9),
    ("Charlotte, NC", 35.2271, -80.8431, 0.87),
    ("Indianapolis, IN", 39.7684, -86.1581, 0.88),
    ("San Francisco, CA", 37.7749, -122.4194, 0.87),
    ("Seattle, WA", 47.6062, -122.3321, 0.74),
    ("Denver, CO", 39.7392, -104.9903, 0.72),
    ("Washington, DC", 38.9072, -77.0369, 0.7),
    ("Boston, MA", 42.3601, -71.0589, 0.68),
    ("Nashville, TN", 36.1627, -86.7816, 0.69),
    ("Oklahoma City, OK", 35.4676, -97.5164, 0.68),
    ("Portland, OR", 45.5152, -122.6784, 0.65),
    ("Las Vegas, NV", 36.1699, -115.1398, 0.65),
    ("Memphis, TN", 35.1495, -90.0490, 0.63),
    ("Louisville, KY", 38.2527, -85.7585, 0.63),
    ("Baltimore, MD", 39.2904, -76.6122, 0.59),
    ("Milwaukee, WI", 43.0389, -87.9065, 0.58),
    ("Albuquerque, NM", 35.0844, -106.6504, 0.56),
    ("Tucson, AZ", 32.2226, -110.9747, 0.54),
    ("Fresno, CA", 36.7378, -119.7871, 0.54),
    ("Sacramento, CA", 38.5816, -121.4944, 0.52),
    ("Kansas City, MO", 39.0997, -94.5786, 0.51),
    ("Atlanta, GA", 33.7490, -84.3880, 0.5),
    ("Miami, FL", 25.7617, -80.1918, 0.44),
    ("Minneapolis, MN", 44.9778, -93.2650, 0.43),
    ("New Orleans, LA", 29.9511, -90.0715, 0.38),
    ("Cleveland, OH", 41.4993, -81.6944, 0.37),
    ("Tampa, FL", 27.9506, -82.4572, 0.39),
    ("Pittsburgh, PA", 40.4406, -79.9959, 0.3),
    ("St. Louis, MO", 38.6270, -90.1994, 0.29),
    ("Salt Lake City, UT", 40.7608, -111.8910, 0.2),
    ("Boise, ID", 43.6150, -116.2023, 0.24),
    ("Des Moines, IA", 41.5868, -93.6250, 0.21),
    ("Raleigh, NC", 35.7796, -78.6382, 0.47),
    ("Orlando, FL", 28.5383, -81.3792, 0.31),
    ("Detroit, MI", 42.3314, -83.0458, 0.63),
]

CONUS = {"lat_min": 24.5, "lat_max": 49.5, "lng_min": -125.0, "lng_max": -66.5}

ADJ = [
    "Birch", "Cedar", "Maple", "Pine", "Coyote", "Eagle", "Bear", "Loon",
    "Wolf", "Falcon", "Aspen", "Juniper", "Sagebrush", "Willow", "Granite",
    "Meadow", "Summit", "Riverside", "Whispering", "Hidden", "Silver",
    "Golden", "High", "Crooked", "Lazy", "Lost", "Black", "Red", "Wild",
    "Blue", "Clear", "Deep", "Big", "Little", "Old", "Rocky", "Stony",
]

NOUN = [
    "Creek", "Lake", "Mountain", "Valley", "Falls", "Ridge", "Rock",
    "Bluff", "Canyon", "Grove", "Flats", "Pass", "Peak", "Pond",
    "Prairie", "Rapids", "Spring", "Trail", "Woods", "Hollow",
    "Butte", "Mesa", "Pines", "Fir", "Oak", "Elm",
]

CATEGORIES = [
    ("Tent", 40),
    ("RV", 25),
    ("Cabin", 15),
    ("Primitive", 20),
]

PRICE_RANGE = {
    "Tent": (15, 45),
    "RV": (25, 70),
    "Cabin": (60, 180),
    "Primitive": (0, 20),
}


def make_name(rng):
    return f"{rng.choice(ADJ)} {rng.choice(NOUN)} Campground"


def scatter(rng, clat, clng, pop):
    # Tighter scatter around big cities, wider in rural areas.
    radius_deg = 0.2 + (1.8 - 0.2) * (1 - min(pop, 8.0) / 8.0)
    dist = radius_deg * rng.random() ** 0.6
    bearing = rng.uniform(0, 2 * math.pi)
    dlat = dist * math.sin(bearing)
    dlng = dist * math.cos(bearing) / max(math.cos(math.radians(clat)), 0.2)
    return clat + dlat, clng + dlng


def main():
    count = int(sys.argv[1]) if len(sys.argv) > 1 else 40_000
    rng = random.Random(42)
    weights = [p for _, _, _, p in CITIES]

    features = []
    remote = max(1, count // 10)
    for i in range(count):
        if i < remote:
            lat = rng.uniform(CONUS["lat_min"], CONUS["lat_max"])
            lng = rng.uniform(CONUS["lng_min"], CONUS["lng_max"])
            city = "United States"
        else:
            city, clat, clng, pop = rng.choices(CITIES, weights=weights, k=1)[0]
            lat, lng = scatter(rng, clat, clng, pop)

        category = rng.choices(
            [c for c, _ in CATEGORIES],
            weights=[w for _, w in CATEGORIES],
            k=1,
        )[0]
        lo, hi = PRICE_RANGE[category]
        price = None if hi == 0 else rng.randint(lo, hi)
        rating = None if rng.random() < 0.15 else round(rng.uniform(3.0, 5.0), 1)
        name = make_name(rng)

        features.append({
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [round(lng, 6), round(lat, 6)],
            },
            "properties": {
                "id": i + 1,
                "name": name,
                "category": category,
                "price": price,
                "rating": rating,
                "location": city,
                "description": f"{name} is a {category.lower()} camping area near {city}.",
            },
        })

    out = {"type": "FeatureCollection", "features": features}
    with open("points.json", "w", encoding="utf-8") as fh:
        json.dump(out, fh, separators=(",", ":"))

    print(f"Wrote {len(features)} features to points.json")


if __name__ == "__main__":
    main()
