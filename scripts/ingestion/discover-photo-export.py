#!/usr/bin/env python3
"""Build a private, read-only logical inventory of an Apple Photos raw export."""

from __future__ import annotations

import argparse, collections, concurrent.futures, hashlib, json, math, os, re, uuid, zipfile
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_SOURCE = ROOT.parent / "Synergetic-Human-Photos-Raw"
DEFAULT_OUTPUT = ROOT / "artifacts/photo-inventory/raw-export-v1"
METADATA = DEFAULT_OUTPUT / "exiftool.private.json"
TIMELINE = ROOT / "data/brain/travel/travel-timeline.v1.json"
ROUTE_CORRECTIONS = ROOT / "data/brain/travel/editorial-route-corrections.v1.json"
GEONAMES = Path("/tmp/synergetic-geonames-cities500.zip")
NAMESPACE = uuid.UUID("29cad3af-fbb0-45f3-8c6e-82b77bb0f222")
STILL_TYPES = {"HEIC", "HEIF", "JPEG", "JPG", "PNG", "TIFF"}


def digest(path: Path) -> str:
    value = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""): value.update(chunk)
    return value.hexdigest()


def first(row: dict, *keys):
    return next((row[key] for key in keys if row.get(key) is not None), None)


def capture_value(row: dict) -> str | None:
    return first(row, "Composite:SubSecDateTimeOriginal", "ExifIFD:DateTimeOriginal", "Keys:CreationDate", "QuickTime:CreateDate", "XMP-xmp:CreateDate")


def capture_parts(value: str | None) -> tuple[int, int, int] | None:
    if not value: return None
    match = re.match(r"^(\d{4}):?(\d{2}):?(\d{2})", value)
    return tuple(map(int, match.groups())) if match else None


def haversine(lat1, lon1, lat2, lon2):
    radius = 6371.0088
    a1, a2 = math.radians(lat1), math.radians(lat2)
    da, do = math.radians(lat2-lat1), math.radians(lon2-lon1)
    value = math.sin(da/2)**2 + math.cos(a1)*math.cos(a2)*math.sin(do/2)**2
    return radius * 2 * math.asin(math.sqrt(value))


def country_names() -> dict[str, str]:
    result = {}
    for line in Path("/usr/share/zoneinfo/iso3166.tab").read_text().splitlines():
        if line and not line.startswith("#"):
            code, name = line.split("\t", 1); result[code] = name
    return result


def load_geonames(path: Path):
    countries = country_names(); grid = collections.defaultdict(list)
    with zipfile.ZipFile(path) as archive:
        member = next(name for name in archive.namelist() if name.endswith(".txt"))
        with archive.open(member) as lines:
            for raw in lines:
                c = raw.decode("utf-8").rstrip("\n").split("\t")
                if len(c) < 19: continue
                lat, lon = float(c[4]), float(c[5]); population = int(c[14] or 0)
                record = (lat, lon, c[1], c[8], countries.get(c[8], c[8]), population, int(c[0]))
                grid[(math.floor(lat), math.floor(lon))].append(record)
    return grid


def nearest_city(grid, lat, lon):
    candidates = []
    base_lat, base_lon = math.floor(lat), math.floor(lon)
    for radius in range(0, 6):
        candidates.clear()
        for y in range(base_lat-radius, base_lat+radius+1):
            for x in range(base_lon-radius, base_lon+radius+1): candidates.extend(grid.get((y, x), []))
        if candidates: break
    if not candidates: return None
    ranked = sorted(((haversine(lat, lon, row[0], row[1]), row) for row in candidates), key=lambda item: (item[0], -item[1][5]))
    distance, row = ranked[0]
    return {"city": row[2], "country_code": row[3], "country": row[4], "distance_km": round(distance, 2), "geoname_id": row[6], "confidence": "strong" if distance <= 25 else "moderate" if distance <= 80 else "uncertain"}


def corrected_travel():
    timeline = json.loads(TIMELINE.read_text())
    places = {place["id"]: place for place in timeline["places"]}
    visits = list(timeline["visits"])
    correction = json.loads(ROUTE_CORRECTIONS.read_text())["corrections"][0]
    place_id = str(uuid.uuid5(NAMESPACE, "travel-place:vaduz"))
    p = correction["place"]
    places[place_id] = {"id":place_id,"slug":p["slug"],"name":p["name"],"countryCode":p["countryCode"],"countryName":p["countryName"],"latitude":p["latitude"],"longitude":p["longitude"]}
    for visit in visits:
        if visit["chronologyIndex"] >= correction["visit"]["chronologyIndex"]: visit["chronologyIndex"] += 1
    v = correction["visit"]
    visits.append({"id":str(uuid.uuid5(NAMESPACE,"travel-visit:vaduz:2026-05:joe-direct")),"placeId":place_id,"chronologyIndex":v["chronologyIndex"],"start":{"year":v["startYear"],"month":v["startMonth"]},"end":{"year":v["endYear"],"month":v["endMonth"]},"sourceValue":"vaduz"})
    visits.sort(key=lambda row: row["chronologyIndex"])
    return places, visits


def write_jsonl(path: Path, rows):
    path.write_text("".join(json.dumps(row, ensure_ascii=False, sort_keys=True)+"\n" for row in rows))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()
    source, output = args.source.resolve(), args.output.resolve()
    if not source.is_dir(): raise SystemExit(f"Source unavailable: {source}")
    if source == output or source in output.parents: raise SystemExit("Output must remain outside the immutable source folder")
    output.mkdir(parents=True, exist_ok=True)
    metadata_rows = json.loads(METADATA.read_text())
    by_name = {row["System:FileName"]: row for row in metadata_rows}
    files = sorted((path for path in source.iterdir() if path.is_file()), key=lambda path:path.name.casefold())
    with concurrent.futures.ThreadPoolExecutor(max_workers=min(8, os.cpu_count() or 4)) as pool:
        hashes = dict(zip(files, pool.map(digest, files)))

    stills = [row for row in metadata_rows if row.get("File:FileType") in STILL_TYPES]
    videos = [row for row in metadata_rows if row.get("File:FileType") == "MOV"]
    still_by_id = {row["Apple:ContentIdentifier"]:row for row in stills if row.get("Apple:ContentIdentifier")}
    video_by_id = {row["Keys:ContentIdentifier"]:row for row in videos if row.get("Keys:ContentIdentifier")}
    matched_ids = sorted(set(still_by_id) & set(video_by_id))
    paired_stills = {still_by_id[value]["System:FileName"] for value in matched_ids}
    paired_videos = {video_by_id[value]["System:FileName"] for value in matched_ids}
    filename_pair_mismatches = []
    for value in matched_ids:
        still, video = still_by_id[value], video_by_id[value]
        if Path(still["System:FileName"]).stem.casefold() != Path(video["System:FileName"]).stem.casefold():
            filename_pair_mismatches.append({"identifier":value,"still":still["System:FileName"],"video":video["System:FileName"]})

    logical = []
    for still in stills:
        name = still["System:FileName"]; identifier = still.get("Apple:ContentIdentifier")
        video = video_by_id.get(identifier) if identifier else None
        names = [name] + ([video["System:FileName"]] if video else [])
        primary_path = source / name; sha = hashes[primary_path]
        capture = capture_value(still) or (capture_value(video) if video else None)
        lat = first(still, "Composite:GPSLatitude")
        lon = first(still, "Composite:GPSLongitude")
        if (lat is None or lon is None) and video:
            lat, lon = first(video,"Composite:GPSLatitude"), first(video,"Composite:GPSLongitude")
        logical.append({
            "logical_asset_id": str(uuid.uuid5(NAMESPACE, f"live:{identifier}" if video else f"still:{sha}:{name}")),
            "asset_kind": "live_photo" if video else "still_photo",
            "source_files": names,
            "pairing": {"method":"apple_content_identifier" if video else "none","content_identifier":identifier,"confidence":1 if video else None},
            "primary_filename": name,"primary_sha256":sha,"capture_at":capture,"capture_parts":capture_parts(capture),
            "latitude":lat,"longitude":lon,"altitude":first(still,"Composite:GPSAltitude") or (first(video,"Composite:GPSAltitude") if video else None),
            "width":first(still,"File:ImageWidth"),"height":first(still,"File:ImageHeight"),"orientation":first(still,"IFD0:Orientation","XMP-tiff:Orientation"),
            "camera_make":first(still,"IFD0:Make") or (first(video,"Keys:Make") if video else None),"camera_model":first(still,"IFD0:Model") or (first(video,"Keys:Model") if video else None),"lens_model":first(still,"ExifIFD:LensModel","XMP-exifEX:LensModel"),
            "total_byte_size":sum((source / filename).stat().st_size for filename in names),
        })
    for video in videos:
        name = video["System:FileName"]
        if name in paired_videos: continue
        path = source/name; sha=hashes[path]; capture=capture_value(video)
        logical.append({"logical_asset_id":str(uuid.uuid5(NAMESPACE,f"video:{sha}")),"asset_kind":"standalone_video","source_files":[name],"pairing":{"method":"unpaired_video","content_identifier":video.get("Keys:ContentIdentifier"),"confidence":1},"primary_filename":name,"primary_sha256":sha,"capture_at":capture,"capture_parts":capture_parts(capture),"latitude":first(video,"Composite:GPSLatitude"),"longitude":first(video,"Composite:GPSLongitude"),"altitude":first(video,"Composite:GPSAltitude"),"width":first(video,"Track1:ImageWidth","Track2:ImageWidth"),"height":first(video,"Track1:ImageHeight","Track2:ImageHeight"),"orientation":None,"camera_make":first(video,"Keys:Make"),"camera_model":first(video,"Keys:Model"),"lens_model":first(video,"VideoKeys:LensModel"),"duration_seconds":first(video,"QuickTime:Duration"),"total_byte_size":path.stat().st_size})

    grid = load_geonames(GEONAMES)
    places, visits = corrected_travel()
    visits_by_month = collections.defaultdict(list)
    for visit in visits: visits_by_month[(visit["start"]["year"],visit["start"]["month"])].append(visit)
    visit_counts = collections.Counter(); assignment_states=collections.Counter(); proximity_states=collections.Counter()
    for asset in logical:
        lat, lon = asset["latitude"], asset["longitude"]
        asset["nearest_geonames"] = nearest_city(grid,lat,lon) if lat is not None and lon is not None else None
        asset["nearest_travel_place"] = None
        if lat is not None and lon is not None:
            proximity=[]
            for place in places.values():
                if place.get("latitude") is not None and place.get("longitude") is not None:
                    proximity.append((haversine(lat,lon,place["latitude"],place["longitude"]),place))
            if proximity:
                distance,place=min(proximity,key=lambda item:item[0])
                state="strong" if distance <= 35 else "moderate" if distance <= 100 else "distant"
                proximity_states[state]+=1
                if distance <= 100:
                    asset["nearest_travel_place"]={"place_id":place["id"],"place_slug":place["slug"],"place_name":place["name"],"country":place["countryName"],"distance_km":round(distance,2),"state":state,"basis":"gps_proximity_only"}
        else: proximity_states["no_gps"]+=1
        asset["visit_assignment"] = None
        parts=asset["capture_parts"]
        if parts and lat is not None and lon is not None:
            candidates=[]
            for visit in visits_by_month[(parts[0],parts[1])]:
                place=places.get(visit["placeId"])
                if place and place.get("latitude") is not None:
                    candidates.append((haversine(lat,lon,place["latitude"],place["longitude"]),visit,place))
            if candidates:
                distance,visit,place=min(candidates,key=lambda item:item[0])
                if distance <= 100:
                    state="strong" if distance <= 35 else "moderate"
                    asset["visit_assignment"]={"visit_id":visit["id"],"visit_chronology_index":visit["chronologyIndex"],"place_slug":place["slug"],"place_name":place["name"],"distance_km":round(distance,2),"state":state,"basis":"capture_month_plus_gps"}
                    visit_counts[visit["id"]]+=1; assignment_states[state]+=1
                else: assignment_states["month_present_geographically_mismatched"]+=1
            else: assignment_states["no_existing_visit_in_capture_month"]+=1
        elif parts: assignment_states["date_only_insufficient"]+=1
        elif lat is not None: assignment_states["gps_only_insufficient"]+=1
        else: assignment_states["no_date_or_gps"]+=1

    logical.sort(key=lambda row: ((row["capture_parts"] or (9999,99,99)), row["primary_filename"].casefold()))
    file_rows=[]
    for path in files:
        row=by_name.get(path.name,{}); file_rows.append({"filename":path.name,"extension":path.suffix.lower(),"byte_size":path.stat().st_size,"sha256":hashes[path],"metadata_readable":path.name in by_name,"file_type":row.get("File:FileType"),"capture_at":capture_value(row),"latitude":first(row,"Composite:GPSLatitude"),"longitude":first(row,"Composite:GPSLongitude"),"content_identifier":first(row,"Apple:ContentIdentifier","Keys:ContentIdentifier")})
    hash_groups=collections.defaultdict(list)
    for row in file_rows: hash_groups[row["sha256"]].append(row["filename"])
    exact_duplicates=[{"sha256":value,"files":names,"count":len(names)} for value,names in hash_groups.items() if len(names)>1]
    orphan_stills=[row["System:FileName"] for value,row in still_by_id.items() if value not in video_by_id]
    standalone_videos=[row["primary_filename"] for row in logical if row["asset_kind"]=="standalone_video"]
    country_counts=collections.Counter((asset["nearest_geonames"] or {}).get("country") for asset in logical if asset.get("nearest_geonames"))
    city_counts=collections.Counter(((asset["nearest_geonames"] or {}).get("country"),(asset["nearest_geonames"] or {}).get("city")) for asset in logical if asset.get("nearest_geonames"))
    month_counts=collections.Counter(f"{p[0]:04d}-{p[1]:02d}" for asset in logical if (p:=asset["capture_parts"]))
    date_parts=[asset["capture_parts"] for asset in logical if asset["capture_parts"]]
    visit_coverage=[]
    for visit in visits:
        place=places.get(visit["placeId"],{}); visit_coverage.append({"visit_id":visit["id"],"chronology_index":visit["chronologyIndex"],"place_slug":place.get("slug"),"place_name":place.get("name"),"country":place.get("countryName"),"year":visit["start"]["year"],"month":visit["start"]["month"],"photo_count":visit_counts[visit["id"]]})
    device_counts=collections.Counter(" ".join(filter(None,[asset.get("camera_make"),asset.get("camera_model")])).strip() or "Unknown" for asset in logical)
    summary={
        "schema_version":"synergetic-photo-export-discovery.v1","generated_at":datetime.now(timezone.utc).isoformat(),"source":str(source),"source_immutable":True,
        "filesystem":{"files":len(files),"metadata_files_read":len(metadata_rows),"other_sidecars":[p.name for p in files if p.name not in by_name],"total_bytes":sum(p.stat().st_size for p in files),"by_extension":dict(collections.Counter((p.suffix.lower() or "[none]") for p in files))},
        "logical_assets":{"count":len(logical),"by_kind":dict(collections.Counter(row["asset_kind"] for row in logical)),"live_photo_pairs":len(matched_ids),"orphan_live_photo_stills":orphan_stills,"standalone_videos":standalone_videos,"filename_pair_mismatches":filename_pair_mismatches},
        "metadata_completeness":{"capture_date":sum(bool(row["capture_parts"]) for row in logical),"gps":sum(row["latitude"] is not None and row["longitude"] is not None for row in logical),"dimensions":sum(bool(row.get("width") and row.get("height")) for row in logical),"camera":sum(bool(row.get("camera_model")) for row in logical),"orientation":sum(row.get("orientation") is not None for row in logical)},
        "temporal":{"first_capture":f"{min(date_parts)[0]:04d}-{min(date_parts)[1]:02d}-{min(date_parts)[2]:02d}" if date_parts else None,"last_capture":f"{max(date_parts)[0]:04d}-{max(date_parts)[1]:02d}-{max(date_parts)[2]:02d}" if date_parts else None,"by_month":dict(month_counts.most_common())},
        "geography":{"represented_country_count":len(country_counts),"by_country":dict(country_counts.most_common()),"top_cities":[{"country":country,"city":city,"count":count} for (country,city),count in city_counts.most_common(100)],"geonames_confidence":dict(collections.Counter((asset.get("nearest_geonames") or {}).get("confidence","unavailable") for asset in logical))},
        "travel_comparison":{"known_visits":len(visits),"assignment_states":dict(assignment_states),"gps_proximity_states":dict(proximity_states),"visits_with_photos":sum(row["photo_count"]>0 for row in visit_coverage),"visits_without_photos":sum(row["photo_count"]==0 for row in visit_coverage)},
        "devices":dict(device_counts.most_common()),"exact_duplicate_groups":len(exact_duplicates),
        "privacy":{"exact_gps_public":False,"source_paths_public":False,"publication_default":False,"uploaded":False,"supabase_written":False},
    }
    write_jsonl(output/"file-inventory.private.jsonl",file_rows)
    write_jsonl(output/"logical-assets.private.jsonl",logical)
    (output/"summary.private.json").write_text(json.dumps(summary,indent=2,ensure_ascii=False)+"\n")
    (output/"travel-coverage.private.json").write_text(json.dumps({"visits":visit_coverage},indent=2,ensure_ascii=False)+"\n")
    (output/"duplicate-observations.private.json").write_text(json.dumps({"exact_file_duplicates":exact_duplicates},indent=2)+"\n")
    print(json.dumps(summary,indent=2,ensure_ascii=False))


if __name__ == "__main__": main()
