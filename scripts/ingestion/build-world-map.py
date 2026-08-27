#!/usr/bin/env python3
"""Convert public-domain Natural Earth country GeoJSON to a quiet static SVG."""
import json, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SOURCE = Path(sys.argv[1] if len(sys.argv) > 1 else "/tmp/synergetic-natural-earth-countries.geojson")
OUTPUT = ROOT / "public/maps/world-110m.svg"

def point(coordinate):
    longitude, latitude = coordinate[:2]
    return (longitude + 180) / 360 * 1000, (90 - latitude) / 180 * 500

def ring_path(ring):
    values = [point(item) for item in ring]
    return "M" + " ".join(("" if i == 0 else "L") + f"{x:.2f},{y:.2f}" for i, (x, y) in enumerate(values)) + "Z"

data = json.loads(SOURCE.read_text())
paths = []
for feature in data["features"]:
    geometry = feature.get("geometry") or {}
    coordinates = geometry.get("coordinates") or []
    polygons = [coordinates] if geometry.get("type") == "Polygon" else coordinates if geometry.get("type") == "MultiPolygon" else []
    value = "".join(ring_path(ring) for polygon in polygons for ring in polygon)
    if value: paths.append(f'<path d="{value}"/>')
OUTPUT.parent.mkdir(parents=True, exist_ok=True)
OUTPUT.write_text('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 500"><!-- Natural Earth public-domain geography --><g fill="#c9d0ce" stroke="#f6f7f5" stroke-width=".55" stroke-linejoin="round">' + "".join(paths) + "</g></svg>\n")
print(f"{OUTPUT}: {len(paths)} country shapes")
