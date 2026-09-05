import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const [bookId, assetId] = process.argv.slice(2);
const expectedRef = "agzcvkdmlrumuqefbtcb";
if (process.env.BRAIN_IMPORT_PROJECT_REF !== expectedRef || !["true", "yes"].includes(process.env.BRAIN_IMPORT_ACKNOWLEDGE_NON_PRODUCTION || "")) {
  throw new Error("Refusing to run outside the acknowledged isolated staging project.");
}
if (!/^[0-9a-f-]{36}$/i.test(bookId || "") || !/^[0-9a-f-]{36}$/i.test(assetId || "")) throw new Error("Book and asset UUIDs are required.");
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const storagePath = `book-covers/control-center/manual/${bookId}/${assetId}.webp`;
const downloaded = await supabase.storage.from("brain-public-media").download(storagePath);
if (downloaded.error) throw downloaded.error;
const bytes = Buffer.from(await downloaded.data.arrayBuffer());
const [width, height] = execFileSync(process.env.WORKSPACE_PYTHON || "python3", ["-c", "from PIL import Image; import sys,io; im=Image.open(io.BytesIO(sys.stdin.buffer.read())); print(f'{im.width}x{im.height}')"], { input: bytes, encoding: "utf8" }).trim().split("x").map(Number);
const media = await supabase.from("media_assets").upsert({
  id: assetId, kind: "book_cover", storage_path: storagePath, provider: "manual_control_center",
  provider_identifier: `${bookId}:${assetId}`, mime_type: "image/webp", byte_size: bytes.length,
  width, height, sha256: createHash("sha256").update(bytes).digest("hex"), confidence: 1,
  editorial_state: "approved", provenance: { source: "control_center_manual_cover_repair", canonicalOverride: true },
}, { onConflict: "id" });
if (media.error) throw media.error;
const book = await supabase.from("books").update({ cover_asset_id: assetId }).eq("entity_id", bookId);
if (book.error) throw book.error;
console.log(`Applied ${bytes.length} byte cover to ${bookId}`);
