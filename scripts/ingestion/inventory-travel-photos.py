#!/usr/bin/env python3
"""Read-only photo inventory. Never modifies originals or publishes exact GPS."""

from __future__ import annotations

import argparse, concurrent.futures, hashlib, json, mimetypes, os, plistlib, shutil, subprocess, sys, uuid
from datetime import datetime, timezone
from pathlib import Path

DEFAULT_SOURCE = Path.home() / "Pictures/Synergetic Human Photos/Originals"
DEFAULT_OUTPUT = Path(__file__).resolve().parents[2] / "artifacts/photo-inventory"
EXTENSIONS = {".jpg", ".jpeg", ".png", ".heic", ".heif", ".tif", ".tiff", ".gif", ".webp", ".dng", ".cr2", ".cr3", ".nef", ".arw", ".raf"}
NAMESPACE = uuid.UUID("29cad3af-fbb0-45f3-8c6e-82b77bb0f222")

def digest(path: Path) -> str:
    value = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""): value.update(chunk)
    return value.hexdigest()

def mdls_metadata(path: Path) -> dict:
    command = ["mdls", "-plist", "-", str(path)]
    result = subprocess.run(command, check=True, capture_output=True)
    values = plistlib.loads(result.stdout)
    return {
        "mime_type": values.get("kMDItemContentType"), "width": values.get("kMDItemPixelWidth"), "height": values.get("kMDItemPixelHeight"),
        "capture_at": str(values.get("kMDItemContentCreationDate") or "") or None,
        "camera_make": values.get("kMDItemAcquisitionMake"), "camera_model": values.get("kMDItemAcquisitionModel"),
        "lens_model": values.get("kMDItemLensModel"), "orientation": values.get("kMDItemOrientation"),
        "latitude": values.get("kMDItemLatitude"), "longitude": values.get("kMDItemLongitude"),
        "altitude": values.get("kMDItemAltitude"), "provider": "macOS mdls",
    }

def exiftool_metadata(files: list[Path]) -> dict[str, dict]:
    requested = ["-json", "-n", "-MIMEType", "-ImageWidth", "-ImageHeight", "-DateTimeOriginal", "-CreateDate", "-OffsetTimeOriginal", "-Make", "-Model", "-LensModel", "-Orientation", "-GPSLatitude", "-GPSLongitude", "-GPSAltitude", "-ISO", "-ExposureTime", "-FNumber", "-FocalLength"]
    output = {}
    for offset in range(0, len(files), 100):
        chunk = files[offset:offset + 100]
        result = subprocess.run(["exiftool", *requested, *(str(path) for path in chunk)], check=True, capture_output=True, text=True)
        for row in json.loads(result.stdout):
            output[str(Path(row["SourceFile"]).resolve())] = {
                "mime_type": row.get("MIMEType"), "width": row.get("ImageWidth"), "height": row.get("ImageHeight"),
                "capture_at": row.get("DateTimeOriginal") or row.get("CreateDate"), "capture_timezone": row.get("OffsetTimeOriginal"),
                "camera_make": row.get("Make"), "camera_model": row.get("Model"), "lens_model": row.get("LensModel"),
                "orientation": row.get("Orientation"), "latitude": row.get("GPSLatitude"), "longitude": row.get("GPSLongitude"), "altitude": row.get("GPSAltitude"),
                "safe_exif": {key: row.get(key) for key in ["ISO", "ExposureTime", "FNumber", "FocalLength"] if row.get(key) is not None}, "provider": "ExifTool",
            }
    return output

def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--check", action="store_true", help="Check prerequisites and source presence without scanning")
    args = parser.parse_args()
    source, output = args.source.expanduser().resolve(), args.output.expanduser().resolve()
    if not source.is_dir():
        print(json.dumps({"status":"source_not_available","source":str(source),"action":"No files inspected. Export/copy the selected Originals folder here when ready."}, indent=2))
        return 2
    if source == output or source in output.parents:
        raise SystemExit("Output must be outside the read-only source tree.")
    provider = "ExifTool" if shutil.which("exiftool") else "macOS mdls"
    if args.check:
        print(json.dumps({"status":"ready","source":str(source),"metadata_provider":provider,"writes_to_source":False}, indent=2)); return 0

    files = sorted(path for path in source.rglob("*") if path.is_file() and path.suffix.lower() in EXTENSIONS)
    output.mkdir(parents=True, exist_ok=True)
    metadata = exiftool_metadata(files) if provider == "ExifTool" else {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=min(8, os.cpu_count() or 4)) as pool:
        hashes = dict(zip(files, pool.map(digest, files)))
    private_rows, safe_rows, issues = [], [], []
    for ordinal, path in enumerate(files, start=1):
        try: details = metadata.get(str(path.resolve())) or mdls_metadata(path)
        except Exception as error:
            details = {}; issues.append({"filename":path.name,"issue":"metadata_unreadable","message":str(error)})
        sha256 = hashes[path]; asset_id = str(uuid.uuid5(NAMESPACE, sha256))
        common = {"asset_id":asset_id,"ordinal":ordinal,"filename":path.name,"extension":path.suffix.lower(),"mime_type":details.get("mime_type") or mimetypes.guess_type(path.name)[0],"byte_size":path.stat().st_size,"width":details.get("width"),"height":details.get("height"),"capture_at":details.get("capture_at"),"capture_timezone":details.get("capture_timezone"),"camera_make":details.get("camera_make"),"camera_model":details.get("camera_model"),"lens_model":details.get("lens_model"),"orientation":details.get("orientation"),"sha256":sha256,"metadata_provider":details.get("provider",provider)}
        safe_rows.append({**common,"has_private_gps":details.get("latitude") is not None,"suggested_place_id":None,"suggested_visit_id":None,"association_state":"unreviewed","is_photos_visible":False,"is_favorite":False,"is_wallpaper_candidate":False})
        private_rows.append({**common,"source_relative_path":str(path.relative_to(source)),"exact_gps":{"latitude":details.get("latitude"),"longitude":details.get("longitude"),"altitude_meters":details.get("altitude")},"safe_exif":details.get("safe_exif",{})})
    def write_jsonl(path: Path, rows: list[dict]): path.write_text("".join(json.dumps(row,ensure_ascii=False)+"\n" for row in rows))
    write_jsonl(output / "private-inventory.jsonl", private_rows); write_jsonl(output / "review-candidates.safe.jsonl", safe_rows); write_jsonl(output / "issues.jsonl", issues)
    summary = {"schema_version":"synergetic-photo-inventory.v1","generated_at":datetime.now(timezone.utc).isoformat(),"source":str(source),"metadata_provider":provider,"files":len(files),"with_capture_date":sum(bool(row["capture_at"]) for row in safe_rows),"with_dimensions":sum(bool(row["width"] and row["height"]) for row in safe_rows),"with_private_gps":sum(row["has_private_gps"] for row in safe_rows),"issues":len(issues),"privacy":{"exact_gps_public":False,"original_paths_public":False,"publication_flags_default":False},"source_modified":False}
    (output / "summary.json").write_text(json.dumps(summary,indent=2)+"\n"); print(json.dumps(summary,indent=2)); return 0

if __name__ == "__main__": sys.exit(main())
