#!/usr/bin/env python3
"""Convert private macOS Quick Look renders into review-size JPEG derivatives."""

from __future__ import annotations

import argparse, json
from pathlib import Path

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[2]
INVENTORY = ROOT / "artifacts/photo-inventory/raw-export-v1/logical-assets.private.jsonl"
DEFAULT_ARTIFACTS = ROOT / "artifacts/photo-curation/stage2"


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--quicklook", type=Path, default=DEFAULT_ARTIFACTS/"quicklook.private")
    parser.add_argument("--output", type=Path, default=DEFAULT_ARTIFACTS/"previews.private")
    args=parser.parse_args(); args.output.mkdir(parents=True,exist_ok=True)
    assets=[json.loads(line) for line in INVENTORY.read_text().splitlines() if line]
    missing=[]; built=0
    for asset in assets:
        source=args.quicklook/f'{asset["primary_filename"]}.png'
        destination=args.output/f'{asset["logical_asset_id"]}.jpg'
        if not source.exists(): missing.append(asset["primary_filename"]); continue
        with Image.open(source) as image:
            image=ImageOps.exif_transpose(image).convert("RGB")
            image.thumbnail((1600,1600),Image.Resampling.LANCZOS)
            image.save(destination,"JPEG",quality=89,optimize=True)
        built+=1
    summary={"schemaVersion":"synergetic-photo-review-previews.v1","inventoryAssets":len(assets),"previewsBuilt":built,"missing":missing,"maxDimensions":[1600,1600],"format":"JPEG","privateLocalOnly":True}
    (args.output.parent/"preview-build.private.json").write_text(json.dumps(summary,indent=2)+"\n")
    print(json.dumps(summary,indent=2))


if __name__=="__main__": main()
