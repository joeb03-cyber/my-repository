#!/usr/bin/env python3
"""Cache and verify the explicitly reviewed cover override manifest."""

import hashlib
import io
import json
import shutil
import sys
import urllib.request
import os
from pathlib import Path

from PIL import Image

if len(sys.argv) != 4:
    raise SystemExit("Usage: cache-book-cover-overrides.py <manifest.json> <public-cover-dir> <cache-dir>")

manifest_path, cover_dir, cache_dir = map(Path, sys.argv[1:])
manifest = json.loads(manifest_path.read_text())
cover_dir.mkdir(parents=True, exist_ok=True)
cache_dir.mkdir(parents=True, exist_ok=True)
results = []

for cover in manifest["covers"]:
    slug = cover["slug"]
    existing_path = cover.get("publicPath")
    if cover.get("status") == "cached" and existing_path and (cover_dir.parent / existing_path.lstrip("/")).exists():
        results.append({"slug": slug, "status": "cached", "reused": True})
        continue
    if cover.get("status") == "failed" and os.environ.get("RETRY_FAILED") != "1":
        results.append({"slug": slug, "status": "failed", "error": cover.get("error", "previous download failed"), "reused": True})
        continue
    request = urllib.request.Request(cover["sourceUrl"], headers={"User-Agent": "SynergeticHumanCoverCurator/2.0", "Accept": "image/*"})
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            body = response.read()
            content_type = response.headers.get("content-type")
        image = Image.open(io.BytesIO(body))
        image.verify()
        verified = Image.open(io.BytesIO(body))
        if verified.width < 100 or verified.height < 140:
            raise ValueError(f"image too small: {verified.size}")
        extension = "jpg" if (verified.format or "JPEG").lower() in {"jpg", "jpeg"} else (verified.format or "png").lower()
        cache_path = cache_dir / f"{slug}.{extension}"
        cache_path.write_bytes(body)
        destination = cover_dir / f"{slug}.{extension}"
        shutil.copyfile(cache_path, destination)
        cover.update({
            "status": "cached",
            "publicPath": f"/book-covers/{destination.name}",
            "mimeType": content_type or Image.MIME.get(verified.format),
            "width": verified.width,
            "height": verified.height,
            "byteSize": len(body),
            "sha256": hashlib.sha256(body).hexdigest(),
            "confidence": 1,
        })
        results.append({"slug": slug, "status": "cached", "size": [verified.width, verified.height]})
    except Exception as error:
        cover.update({"status": "failed", "error": f"{type(error).__name__}: {error}"})
        results.append({"slug": slug, "status": "failed", "error": str(error)})

manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")
print(json.dumps({"cached": sum(item["status"] == "cached" for item in results), "failed": [item for item in results if item["status"] == "failed"], "results": results}, indent=2))
