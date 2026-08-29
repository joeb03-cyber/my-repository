#!/usr/bin/env python3
"""Create private thumbnails, visual clusters, and contact sheets from staged photo inventory."""

from __future__ import annotations

import argparse, collections, concurrent.futures, json, re, subprocess
from datetime import datetime
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_SOURCE = ROOT.parent / "Synergetic-Human-Photos-Raw"
DEFAULT_ARTIFACTS = ROOT / "artifacts/photo-inventory/raw-export-v1"


def read_jsonl(path: Path):
    return [json.loads(line) for line in path.read_text().splitlines() if line]


def make_thumbnail(source: Path, destination: Path, quicklook: Path):
    destination.parent.mkdir(parents=True, exist_ok=True)
    preview = quicklook / f"{source.name}.png"
    if preview.exists():
        with Image.open(preview) as image:
            ImageOps.exif_transpose(image).convert("RGB").save(destination, quality=88)
        return
    result = subprocess.run(
        ["/usr/bin/sips", "-Z", "420", "-s", "format", "jpeg", str(source), "--out", str(destination)],
        stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=True,
    )
    if result.returncode: raise RuntimeError(f"sips failed for {source.name}: {result.stderr.strip()}")


def dhash(path: Path) -> int:
    with Image.open(path) as image:
        pixels = list(ImageOps.grayscale(image).resize((9, 8), Image.Resampling.LANCZOS).getdata())
    value = 0
    for row in range(8):
        for column in range(8):
            value = (value << 1) | int(pixels[row * 9 + column] > pixels[row * 9 + column + 1])
    return value


def capture_second(value):
    match=re.match(r"^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})", value or "")
    return datetime(*map(int,match.groups())).timestamp() if match else None


def sheet(path: Path, title: str, assets: list[dict], thumbnails: Path, columns=6):
    if not assets: return
    cell_w, cell_h, header = 224, 210, 54
    rows = (len(assets) + columns - 1) // columns
    canvas = Image.new("RGB", (columns * cell_w, header + rows * cell_h), "#f3f0ea")
    draw = ImageDraw.Draw(canvas); font = ImageFont.load_default()
    draw.text((16, 18), title, fill="#1d1d1f", font=font)
    for index, asset in enumerate(assets):
        x, y = (index % columns) * cell_w, header + (index // columns) * cell_h
        thumb = thumbnails / f'{asset["logical_asset_id"]}.jpg'
        try:
            with Image.open(thumb) as image:
                image = ImageOps.exif_transpose(image).convert("RGB")
                image.thumbnail((204, 158), Image.Resampling.LANCZOS)
                canvas.paste(image, (x + (cell_w-image.width)//2, y + 4 + (158-image.height)//2))
        except Exception:
            draw.rectangle((x+10,y+4,x+214,y+162), fill="#dad6cf")
        date = (asset.get("capture_at") or "unknown date")[:10].replace(":", "-")
        place = (asset.get("nearest_geonames") or {}).get("city") or "location unknown"
        draw.text((x+10,y+168), asset["primary_filename"][:31], fill="#222", font=font)
        draw.text((x+10,y+184), f"{date} · {place}"[:35], fill="#666", font=font)
    path.parent.mkdir(parents=True, exist_ok=True); canvas.save(path, quality=90)


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    parser.add_argument("--artifacts", type=Path, default=DEFAULT_ARTIFACTS)
    args=parser.parse_args(); source=args.source.resolve(); artifacts=args.artifacts.resolve()
    if source == artifacts or source in artifacts.parents: raise SystemExit("Artifacts must remain outside the source export")
    assets=read_jsonl(artifacts/"logical-assets.private.jsonl")
    stills=[asset for asset in assets if asset["asset_kind"] != "standalone_video"]
    thumbs=artifacts/"thumbnails.private"; sheets=artifacts/"contact-sheets.private"; quicklook=artifacts/"quicklook.private"
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        jobs=[pool.submit(make_thumbnail, source/asset["primary_filename"], thumbs/f'{asset["logical_asset_id"]}.jpg', quicklook) for asset in stills]
        for job in concurrent.futures.as_completed(jobs): job.result()
    for asset in stills: asset["dhash"] = f'{dhash(thumbs/f"{asset["logical_asset_id"]}.jpg"):016x}'

    near=[]
    for i,left in enumerate(stills):
        lh=int(left["dhash"],16)
        for right in stills[i+1:]:
            distance=(lh ^ int(right["dhash"],16)).bit_count()
            if distance <= 4: near.append({"left":left["logical_asset_id"],"right":right["logical_asset_id"],"distance":distance})
    parent={asset["logical_asset_id"]:asset["logical_asset_id"] for asset in stills}
    def find(value):
        while parent[value] != value: parent[value]=parent[parent[value]]; value=parent[value]
        return value
    for pair in near:
        a,b=find(pair["left"]),find(pair["right"])
        if a != b: parent[b]=a
    groups=collections.defaultdict(list)
    lookup={asset["logical_asset_id"]:asset for asset in stills}
    for asset in stills: groups[find(asset["logical_asset_id"])].append(asset)
    near_groups=sorted((group for group in groups.values() if len(group)>1), key=lambda group:(-len(group),group[0]["primary_filename"]))
    (artifacts/"visual-similarity.private.json").write_text(json.dumps({
        "method":"64-bit difference hash on private 420px derivatives; candidates only, not duplicate truth",
        "pair_count":len(near),"group_count":len(near_groups),
        "groups":[{"count":len(group),"assets":[{"id":a["logical_asset_id"],"filename":a["primary_filename"]} for a in group]} for group in near_groups]
    },indent=2)+"\n")

    timed=sorted(((capture_second(a.get("capture_at")),a) for a in stills if capture_second(a.get("capture_at")) is not None), key=lambda item:(item[0],item[1]["primary_filename"]))
    bursts=[]; current=[]; previous=None
    for second,asset in timed:
        if previous is not None and second-previous <= 10: current.append(asset)
        else:
            if len(current)>=3: bursts.append(current)
            current=[asset]
        previous=second
    if len(current)>=3: bursts.append(current)
    (artifacts/"burst-candidates.private.json").write_text(json.dumps({
        "method":"three or more chronological stills separated by no more than ten seconds; editorial review required",
        "group_count":len(bursts),"groups":[{"count":len(group),"assets":[{"id":a["logical_asset_id"],"filename":a["primary_filename"],"capture_at":a.get("capture_at")} for a in group]} for group in bursts]
    },indent=2)+"\n")

    chronological=stills[::max(1,len(stills)//48)][:48]
    no_gps=[a for a in stills if a.get("latitude") is None][:48]
    country=collections.defaultdict(list)
    for asset in stills: country[(asset.get("nearest_geonames") or {}).get("country","Unknown")].append(asset)
    top_countries=sorted(country.items(),key=lambda item:-len(item[1]))[:8]
    sheet(sheets/"00-chronological-overview.jpg","Chronological overview — evenly sampled",chronological,thumbs)
    sheet(sheets/"01-location-unknown.jpg","Location metadata missing — review sample",no_gps,thumbs)
    for index,(name,group) in enumerate(top_countries,2):
        sample=group[::max(1,len(group)//36)][:36]
        sheet(sheets/f"{index:02d}-country-{name.lower().replace(' ','-').replace('/','-')}.jpg",f"{name} — {len(group)} assets",sample,thumbs)
    similarity_sample=[asset for group in near_groups[:12] for asset in group][:48]
    sheet(sheets/"10-near-duplicate-candidates.jpg","Visually similar / burst candidates",similarity_sample,thumbs)
    screenshot_candidates=[a for a in stills if Path(a["primary_filename"]).suffix.lower()==".png" or not a.get("camera_model")]
    sheet(sheets/"11-non-camera-candidates.jpg","Possible screenshots, saved images, or non-camera material",screenshot_candidates[:48],thumbs)
    burst_sample=[asset for group in bursts[:12] for asset in group][:48]
    sheet(sheets/"12-temporal-burst-candidates.jpg","Temporal burst candidates",burst_sample,thumbs)
    print(json.dumps({"thumbnails":len(stills),"near_pairs":len(near),"near_groups":len(near_groups),"burst_groups":len(bursts),"contact_sheets":len(list(sheets.glob('*.jpg')))},indent=2))


if __name__ == "__main__": main()
