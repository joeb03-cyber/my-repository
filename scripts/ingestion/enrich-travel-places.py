#!/usr/bin/env python3
"""Resolve source labels against a downloaded GeoNames dataset, entirely offline."""

from __future__ import annotations

import json, re, sys, unicodedata, zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "data/brain/travel/travel-source-inventory.v1.json"
OUTPUT = ROOT / "data/brain/travel/place-candidates.v1.json"
DECISIONS = ROOT / "data/brain/travel/editorial-decisions.v1.json"

COUNTRIES = {
    "PL": "warsaw", "LT": "kaunas|vilnius", "LV": "riga", "EE": "tallinn", "FI": "helsinki", "SE": "stockholm",
    "ME": "tivat|ulcinj", "XK": "pristina", "MK": "skopje", "RS": "nis", "BG": "sofia",
    "AL": "saranda|dhermi|himare|vlore|tirana", "SI": "bohinj|bled|ljubljana",
    "AT": "salzburg|muhlbach am hochkonig|innsbruck", "CH": "zurich|geneva",
    "ES": "seville|el rompido|barcelona|galicia", "MA": "marrakesh|casablanca",
    "US": "miami|island heights|st. petersburg|austin|new york city", "AW": "aruba",
    "CO": "medellin|jardin|bogota|cali", "GT": "el paredon|lake atitlan|antigua",
    "SV": "el tunco|la libertad|san salvador", "HN": "tegucigalpa|roatan",
    "MX": "puerto vallarta|guadalajara|san miguel de allende|guanajuato|mexico city|cancun", "CA": "montreal",
    "JP": "tokyo|kyoto|osaka", "TW": "taiwan", "VN": "hoi an|phu quoc|sapa|hanoi|da nang",
    "KH": "siem reap|phnom penh|kampot", "TH": "phuket|chiang rai|chiang mai|pattaya|bangkok",
    "MY": "kuala lumpur", "ID": "bali", "PH": "palawan|manila|siargao|cebu city", "HU": "budapest",
    "IT": "tropea|pizzo|matera|taranto|gallipoli|lecce|polignano de mare|bari|spello|rimini|sicily",
    "GB": "london", "DO": "punta cana", "PE": "lima", "CL": "santiago",
    "AR": "mendoza|buenos aires|el bolson|lago puelo|bariloche", "BR": "rio de janeiro", "PR": "isabela",
}
COUNTRY_FOR = {name: code for code, values in COUNTRIES.items() for name in values.split("|")}
QUERY_OVERRIDES = {"muhlbach am hochkonig": "mühlbach am hochkönig", "jardin": "jardín", "el bolson": "el bolsón", "polignano de mare": "polignano a mare"}
NON_LOCALITIES = {
    "aruba": "country", "taiwan": "country_or_territory", "bali": "island", "palawan": "island",
    "siargao": "island", "sicily": "island", "galicia": "region", "lake atitlan": "lake",
}
CONTEXT_FLAGS = {
    "st. petersburg": ["country_and_region_inferred_from_route_context"],
    "isabela": ["country_and_region_inferred_from_route_context"],
    "antigua": ["country_inferred_from_route_context"],
    "la libertad": ["country_inferred_from_route_context"],
    "santiago": ["country_inferred_from_route_context"],
}

def normalized(value: str) -> str:
    value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", " ", value).strip()

def load_geonames(archive: Path) -> dict[tuple[str, str], list[dict]]:
    index: dict[tuple[str, str], list[dict]] = {}
    with zipfile.ZipFile(archive) as source:
        member = next(name for name in source.namelist() if name.endswith(".txt"))
        with source.open(member) as lines:
            for raw in lines:
                c = raw.decode("utf-8").rstrip("\n").split("\t")
                if len(c) < 19: continue
                record = {"geoname_id": int(c[0]), "name": c[1], "latitude": float(c[4]), "longitude": float(c[5]), "country_code": c[8], "feature_code": c[7], "population": int(c[14] or 0), "timezone": c[17]}
                labels = {normalized(c[1]), normalized(c[2]), *(normalized(v) for v in c[3].split(",") if v)}
                for label in labels:
                    if label: index.setdefault((c[8], label), []).append(record)
    return index

def main() -> None:
    archive = Path(sys.argv[1] if len(sys.argv) > 1 else "/tmp/synergetic-geonames-cities500.zip")
    if not archive.exists(): raise SystemExit(f"GeoNames archive not found: {archive}")
    inventory = json.loads(SOURCE.read_text())
    decisions = json.loads(DECISIONS.read_text())["place_identity_decisions"]
    names = []
    for record in inventory["records"]:
        for place in record["candidate_places"]:
            if place["source_name"] not in names: names.append(place["source_name"])
    missing = sorted(set(names) - set(COUNTRY_FOR))
    if missing: raise ValueError(f"Country context missing for: {missing}")
    index = load_geonames(archive)
    places = []
    for name in names:
        country = COUNTRY_FOR[name]
        candidates = sorted(index.get((country, normalized(QUERY_OVERRIDES.get(name, name))), []), key=lambda row: row["population"], reverse=True)
        decision = decisions.get(name)
        if decision and decision.get("provider_geoname_id"):
            candidates.sort(key=lambda row: row["geoname_id"] != decision["provider_geoname_id"])
        flags = list(CONTEXT_FLAGS.get(name, []))
        accepted = None if name in NON_LOCALITIES else (candidates[0] if candidates else None)
        if name in NON_LOCALITIES: flags.append("non_locality_requires_manual_or_full_geodata_resolution")
        elif not accepted: flags.append("geocoding_unresolved")
        if len(candidates) > 1: flags.append("multiple_provider_candidates")
        if decision:
            flags = []
        places.append({
            "source_name": name, "canonical_name_candidate": decision["canonical_name"] if decision else accepted["name"] if accepted else name.title(),
            "country_code_candidate": decision.get("country_code", country) if decision else country, "place_type_candidate": NON_LOCALITIES.get(name, "locality"),
            "latitude": accepted["latitude"] if accepted else None, "longitude": accepted["longitude"] if accepted else None,
            "provider": {"name": "GeoNames cities500", "license": "CC BY 4.0", "geoname_id": accepted["geoname_id"] if accepted else None, "feature_code": accepted["feature_code"] if accepted else None, "query": QUERY_OVERRIDES.get(name, name), "candidate_count": len(candidates), "candidate_ids": [item["geoname_id"] for item in candidates[:5]]},
            "review": {"state": decision.get("state", "approved") if decision else "needs_review" if flags else "unreviewed", "flags": flags, "editorial_decision": decision},
        })
    payload = {"schema_version": "synergetic-place-candidates.v1", "generated_from": str(SOURCE.relative_to(ROOT)), "provider_attribution": "GeoNames geographical database, CC BY 4.0", "place_count": len(places), "resolved_count": sum(p["latitude"] is not None for p in places), "places": places}
    OUTPUT.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n")
    print(json.dumps({"output": str(OUTPUT), "places": len(places), "resolved": payload["resolved_count"], "unresolved": [p["source_name"] for p in places if p["latitude"] is None]}, indent=2))

if __name__ == "__main__": main()
