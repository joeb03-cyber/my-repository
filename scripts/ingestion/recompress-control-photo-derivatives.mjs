import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const expectedRef = "agzcvkdmlrumuqefbtcb";
if (process.env.BRAIN_IMPORT_PROJECT_REF !== expectedRef || !["true", "yes"].includes(process.env.BRAIN_IMPORT_ACKNOWLEDGE_NON_PRODUCTION || "")) {
  throw new Error("Refusing to run outside the acknowledged isolated staging project.");
}
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const python = process.env.WORKSPACE_PYTHON || "python3";
const variants = [{ name: "small", max: 480, quality: 74 }, { name: "medium", max: 1024, quality: 78 }, { name: "large", max: 1800, quality: 82 }];
const temp = await mkdtemp(path.join(tmpdir(), "synergetic-photo-optimize-"));

try {
  const assets = await supabase.from("photo_assets").select("asset_id").eq("inventory_version", "control-center-v1");
  if (assets.error) throw assets.error;
  for (const { asset_id: assetId } of assets.data || []) {
    const current = await supabase.from("photo_derivatives").select("variant,storage_path").eq("asset_id", assetId);
    if (current.error) throw current.error;
    const large = current.data.find((row) => row.variant === "large");
    if (!large) throw new Error(`Missing large source for ${assetId}`);
    const source = await supabase.storage.from("brain-public-media").download(large.storage_path);
    if (source.error) throw source.error;
    const inputPath = path.join(temp, `${assetId}.webp`);
    await writeFile(inputPath, Buffer.from(await source.data.arrayBuffer()));
    for (const variant of variants) {
      const outputPath = path.join(temp, `${assetId}-${variant.name}.webp`);
      const dimensions = execFileSync(python, ["-c", `
from PIL import Image
import sys
image = Image.open(sys.argv[1]).convert("RGB")
image.thumbnail((${variant.max}, ${variant.max}), Image.Resampling.LANCZOS)
image.save(sys.argv[2], "WEBP", quality=${variant.quality}, method=6)
print(f"{image.width}x{image.height}")
`, inputPath, outputPath], { encoding: "utf8" }).trim().split("x").map(Number);
      const bytes = await readFile(outputPath);
      const storagePath = `photos/control-center/${assetId}/optimized-v2/${variant.name}.webp`;
      const uploaded = await supabase.storage.from("brain-public-media").upload(storagePath, bytes, { contentType: "image/webp", cacheControl: "31536000", upsert: true });
      if (uploaded.error) throw uploaded.error;
      const updated = await supabase.from("photo_derivatives").update({ storage_path: storagePath, mime_type: "image/webp", width: dimensions[0], height: dimensions[1], byte_size: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") }).eq("asset_id", assetId).eq("variant", variant.name);
      if (updated.error) throw updated.error;
      if (variant.name === "large") {
        const media = await supabase.from("media_assets").update({ storage_path: storagePath, mime_type: "image/webp", width: dimensions[0], height: dimensions[1], byte_size: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") }).eq("id", assetId);
        if (media.error) throw media.error;
      }
    }
    console.log(`Optimized ${assetId}`);
  }
} finally {
  await rm(temp, { recursive: true, force: true });
}
