#!/usr/bin/env python3
"""Validate the private Stage 2 photo curation tool and immutable source boundary."""

from __future__ import annotations

import collections, json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
INVENTORY_DIR=ROOT/"artifacts/photo-inventory/raw-export-v1"
CURATION=ROOT/"artifacts/photo-curation/stage2"
SOURCE=ROOT.parent/"Synergetic-Human-Photos-Raw"


def check(condition,message):
    if not condition: raise AssertionError(message)


def main():
    assets=[json.loads(line) for line in (INVENTORY_DIR/"logical-assets.private.jsonl").read_text().splitlines() if line]
    ids={asset["logical_asset_id"] for asset in assets}; kinds=collections.Counter(asset["asset_kind"] for asset in assets)
    check(len(assets)==728,"inventory must contain 728 logical assets")
    check(len(ids)==728,"every logical asset must have a unique ID")
    check(kinds=={"live_photo":369,"still_photo":358,"standalone_video":1},f"unexpected asset kinds: {kinds}")
    preview_ids={path.stem for path in (CURATION/"previews.private").glob("*.jpg")}
    check(preview_ids==ids,"review previews must cover every logical asset exactly once")
    manifest=json.loads((CURATION/"curation-manifest.private.json").read_text())
    check(manifest["schemaVersion"]=="synergetic-photo-curation.v1","manifest schema mismatch")
    check(manifest["sourceInventory"]["logicalAssetCount"]==728,"manifest inventory count mismatch")
    server=(ROOT/"tools/photo-curation/server.py").read_text(); client=(ROOT/"tools/photo-curation/static/app.js").read_text(); html=(ROOT/"tools/photo-curation/static/index.html").read_text()
    check('ThreadingHTTPServer(("127.0.0.1", args.port)' in server,"server must bind only to loopback")
    for token in ['"keep"','"maybe"','"private"','"wallpaper"','"hero"','associationOverride','curation-events.private.jsonl']:
        check(token in server,f"server missing {token}")
    for token in ['event.key.toLowerCase()','"1"','"2"','"3"','"w"','"h"','"arrowleft"','"arrowright"']:
        check(token in client,f"client shortcut missing {token}")
    check("Wallpaper" in html and "Place Hero" in html and "Correct visit" in html,"review controls missing")
    before=json.loads((INVENTORY_DIR/"source-baseline.before.json").read_text())
    baseline={item["filename"]:(item["byte_size"],item["mtime_ns"]) for item in before["files"]}
    current={path.name:(path.stat().st_size,path.stat().st_mtime_ns) for path in SOURCE.iterdir() if path.is_file()}
    check(current==baseline,"immutable source files changed since discovery baseline")
    result={"schemaVersion":"synergetic-photo-curation-validation.v1","passed":True,"logicalAssets":len(assets),"uniqueLogicalAssetIds":len(ids),"assetKinds":dict(kinds),"reviewPreviews":len(preview_ids),"visitChronology":111,"manifestSchema":manifest["schemaVersion"],"loopbackOnly":True,"sourceUnchanged":True,"supabaseUsed":False,"uploaded":False,"publicRoutesAdded":False}
    (CURATION/"validation.private.json").write_text(json.dumps(result,indent=2)+"\n")
    print(json.dumps(result,indent=2))


if __name__=="__main__": main()
