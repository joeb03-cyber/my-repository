#!/usr/bin/env python3
"""Prepare a deduplicated private photo delta and open the existing review tool."""

from __future__ import annotations

import hashlib, json, os, shutil, subprocess, sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
INBOX = ROOT.parent / "Synergetic-Human-Photos-Inbox"
ORIGINALS = ROOT.parent / "Synergetic-Human-Photos-Raw"
BASE_INVENTORY = ROOT / "artifacts/photo-inventory/raw-export-v1/logical-assets.private.jsonl"
BASE_CURATION = ROOT / "artifacts/photo-curation/stage2/curation-manifest.private.json"
BASE_PREVIEWS = ROOT / "artifacts/photo-curation/stage2/previews.private"
BATCH = ROOT / "artifacts/photo-intake/current.private"
WORKSPACE = BATCH / "source-links.private"
INVENTORY = BATCH / "inventory.private"
CURATION = BATCH / "curation.private"
PREVIEWS = CURATION / "previews.private"
SUPPORTED = {".heic", ".heif", ".jpg", ".jpeg", ".png", ".tif", ".tiff", ".mov", ".mp4"}

def digest(path: Path) -> str:
    value = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""): value.update(chunk)
    return value.hexdigest()

def link(source: Path, name: str) -> None:
    target = WORKSPACE / name
    if not target.exists(): target.symlink_to(source.resolve())

def main() -> int:
    if not INBOX.is_dir():
        INBOX.mkdir(parents=True, exist_ok=True)
        print(f"Created private intake folder:\n{INBOX}\n\nAdd the new Apple Photos originals there, then run this command again.")
        return 2
    incoming = sorted(path for path in INBOX.iterdir() if path.is_file() and path.suffix.lower() in SUPPORTED)
    if not incoming: print(f"No supported photos found in {INBOX}"); return 2
    if not ORIGINALS.is_dir() or not BASE_INVENTORY.is_file() or not BASE_CURATION.is_file(): print("The validated original photo source/inventory/curation is unavailable."); return 2
    prior_hashes = {json.loads(line)["primary_sha256"] for line in BASE_INVENTORY.read_text().splitlines() if line.strip()}
    new_files, duplicates = [], []
    for path in incoming:
        (duplicates if digest(path) in prior_hashes else new_files).append(path)
    if not new_files: print(json.dumps({"incoming": len(incoming), "new": 0, "duplicatesSkipped": len(duplicates)}, indent=2)); return 0
    if WORKSPACE.exists(): shutil.rmtree(WORKSPACE)
    WORKSPACE.mkdir(parents=True); INVENTORY.mkdir(parents=True, exist_ok=True); PREVIEWS.mkdir(parents=True, exist_ok=True)
    shutil.copy2(BASE_CURATION, CURATION / "curation-manifest.private.json")
    if BASE_PREVIEWS.is_dir():
        for preview in BASE_PREVIEWS.iterdir():
            if preview.is_file(): (PREVIEWS / preview.name).symlink_to(preview.resolve())
    for path in ORIGINALS.iterdir():
        if path.is_file() and path.suffix.lower() in SUPPORTED: link(path, path.name)
    for path in new_files:
        name = path.name if not (WORKSPACE / path.name).exists() else f"intake-{digest(path)[:10]}-{path.name}"
        link(path, name)
    metadata = INVENTORY / "exiftool.private.json"
    with metadata.open("w") as output:
        subprocess.run(["exiftool", "-json", "-G1", "-n", *map(str, sorted(WORKSPACE.iterdir()))], check=True, stdout=output)
    subprocess.run([sys.executable, str(ROOT / "scripts/ingestion/discover-photo-export.py"), "--source", str(WORKSPACE), "--output", str(INVENTORY), "--metadata", str(metadata)], check=True)
    logical = [json.loads(line) for line in (INVENTORY / "logical-assets.private.jsonl").read_text().splitlines() if line]
    new_names = {path.name for path in new_files}
    new_assets = [row for row in logical if row["primary_filename"] in new_names or row["primary_filename"].startswith("intake-")]
    for asset in new_assets:
        source = WORKSPACE / asset["primary_filename"]
        subprocess.run(["qlmanage", "-t", "-s", "1600", "-o", str(PREVIEWS), str(source)], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        rendered = PREVIEWS / f"{source.name}.png"
        if rendered.exists():
            destination = PREVIEWS / f"{asset['logical_asset_id']}.jpg"
            subprocess.run(["sips", "-s", "format", "jpeg", str(rendered), "--out", str(destination)], check=True, stdout=subprocess.DEVNULL)
            rendered.unlink()
    (BATCH / "intake-summary.private.json").write_text(json.dumps({"schemaVersion":"synergetic-photo-intake.v1","preparedAt":datetime.now(timezone.utc).isoformat(),"incoming":len(incoming),"newFiles":len(new_files),"duplicatesSkipped":len(duplicates),"newLogicalAssets":len(new_assets),"sourceFilesModified":False,"supabaseWritten":False}, indent=2)+"\n")
    env = {**os.environ, "SYNERGETIC_PHOTO_INVENTORY": str(INVENTORY), "SYNERGETIC_PHOTO_CURATION_DATA": str(CURATION), "SYNERGETIC_PHOTO_PREVIEWS": str(PREVIEWS), "SYNERGETIC_PHOTO_SOURCE": str(WORKSPACE)}
    print("Prepared the private incremental batch. Opening review at http://127.0.0.1:3210 — use Keep/Wallpaper and visit correction as before.")
    return subprocess.call([sys.executable, str(ROOT / "tools/photo-curation/server.py")], env=env)

if __name__ == "__main__": raise SystemExit(main())
