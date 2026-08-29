#!/usr/bin/env python3
"""Generate private WebP derivatives for curated Keeps; never edits originals."""

from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import tempfile
from pathlib import Path

from PIL import Image, ImageOps, ImageStat

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT.parent / "Synergetic-Human-Photos-Raw"
STAGE4 = ROOT / "artifacts/photo-curation/stage4"
INVENTORY = ROOT / "artifacts/photo-inventory/raw-export-v1/logical-assets.private.jsonl"
SNAPSHOT = STAGE4 / "public-photo-snapshot.private.json"
SIZES = {"small": 480, "medium": 1024, "large": 1800}
HEIF_CONVERT = os.environ.get("HEIF_CONVERT") or shutil.which("heif-convert")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=SOURCE)
    parser.add_argument("--output", type=Path, default=STAGE4 / "derivatives.private")
    parser.add_argument("--force", action="store_true", help="Rebuild existing derivatives")
    parser.add_argument("--asset-id", help="Rebuild one logical asset while still validating the complete set")
    args = parser.parse_args()
    source, output = args.source.resolve(), args.output.resolve()
    if not source.is_dir():
        raise SystemExit(f"Source photo export not found: {source}")
    if source == output or source in output.parents:
        raise SystemExit("Derivative output must remain outside the immutable source tree")
    inventory = {row["logical_asset_id"]: row for row in map(json.loads, INVENTORY.read_text().splitlines())}
    snapshot = json.loads(SNAPSHOT.read_text())
    built, reused, missing = 0, 0, []
    output.mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory(prefix="synergetic-photo-derivatives-") as temporary:
        temp = Path(temporary)
        for photo in snapshot["photos"]:
            if args.asset_id and photo["id"] != args.asset_id:
                continue
            asset = inventory[photo["id"]]
            original = source / asset["primary_filename"]
            if not original.exists():
                missing.append(asset["primary_filename"])
                continue
            destinations = {name: output / photo["id"] / f"{name}.webp" for name in SIZES}
            if not args.force and all(path.exists() for path in destinations.values()):
                reused += 1
                continue
            intermediate = temp / f'{photo["id"]}.jpg'
            if original.suffix.lower() in {".heic", ".heif"}:
                if not HEIF_CONVERT:
                    raise SystemExit("HEIC decoder unavailable. Install libheif or set HEIF_CONVERT to its executable path.")
                # sips can silently render HDR HEIC exports as all-black JPEGs.
                # libheif is used explicitly and the pixels are validated below.
                result = subprocess.run([HEIF_CONVERT, str(original), str(intermediate)], capture_output=True, text=True)
                decode_source = intermediate
            else:
                # Pillow reads the exported JPEG/PNG pixels directly. Some
                # iPhone-edited JPEGs also render black when round-tripped via sips.
                result = subprocess.CompletedProcess([], 0)
                decode_source = original
            if result.returncode or not decode_source.exists():
                missing.append(asset["primary_filename"])
                continue
            with Image.open(decode_source) as raw:
                image = ImageOps.exif_transpose(raw).convert("RGB")
                for name, maximum in SIZES.items():
                    destination = destinations[name]
                    destination.parent.mkdir(parents=True, exist_ok=True)
                    derivative = image.copy()
                    derivative.thumbnail((maximum, maximum), Image.Resampling.LANCZOS)
                    derivative.save(destination, "WEBP", quality=84 if name == "large" else 81, method=6)
            built += 1

    invalid_content = []
    for photo in snapshot["photos"]:
        derivative = output / photo["id"] / "large.webp"
        if not derivative.exists():
            continue
        with Image.open(derivative) as image:
            sample = image.convert("RGB").resize((32, 32))
            statistics = ImageStat.Stat(sample)
            if max(statistics.mean) < 1 and max(statistics.var) < 1:
                invalid_content.append(photo["id"])

    validation = {
        "schemaVersion": "synergetic-photo-derivatives.v1",
        "sourceModified": False,
        "photosExpected": len(snapshot["photos"]),
        "photosBuilt": built,
        "photosReused": reused,
        "missing": missing,
        "invalidContent": invalid_content,
        "variants": SIZES,
        "format": "WebP",
        "publicOriginalsIncluded": False,
        "livePhotoMotionIncluded": False,
    }
    (STAGE4 / "derivative-validation.private.json").write_text(json.dumps(validation, indent=2) + "\n")
    print(json.dumps(validation, indent=2))
    if missing or invalid_content:
        raise SystemExit("Derivative validation failed; no import is safe.")


if __name__ == "__main__":
    main()
