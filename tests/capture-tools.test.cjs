// Run: node --test tests/capture-tools.test.cjs (no credentials or live writes).
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("capture and podcast tables remain private, owner-scoped admin records", () => {
  const sql = read("supabase/migrations/20261008120000_private_capture_inbox_podcasts.sql");
  assert.match(sql, /alter table public\.capture_inbox enable row level security/);
  assert.match(sql, /alter table public\.podcast_episode_captures enable row level security/);
  assert.equal((sql.match(/public\.is_brain_admin\(\) and created_by = auth\.uid\(\)/g) || []).length, 4);
  assert.doesNotMatch(sql, /grant\s+[^;]*\s+to\s+anon/i);
  assert.doesNotMatch(sql, /create\s+(?:or\s+replace\s+)?view/i);
});

test("control actions validate ownership, canonical visits, and safe external links", () => {
  const route = read("app/api/control/action/route.ts");
  assert.match(route, /if \(!auth\) return NextResponse\.json\(\{ error: "Unauthorized" \}, \{ status: 401 \}\)/);
  assert.match(route, /if \(input\.action === "save-capture"\)/);
  assert.match(route, /brain_public_travel_visits/);
  assert.match(route, /created_by: auth\.user\.id/);
  assert.match(route, /\.eq\("created_by", auth\.user\.id\)/);
  assert.match(route, /if \(!\["http:", "https:"\]\.includes\(url\.protocol\)\)/);
  assert.match(route, /if \(input\.action === "save-podcast-capture"\)/);
});

test("Control Center exposes the two private capture modules", () => {
  const center = read("components/control/control-center.tsx");
  const content = read("app/api/control/content/route.ts");
  assert.match(center, /id="capture" label="Capture"/);
  assert.match(center, /id="podcasts" label="Podcasts"/);
  assert.match(center, /<CaptureInbox/);
  assert.match(center, /<PodcastCaptures/);
  assert.match(content, /db\.from\("capture_inbox"\)/);
  assert.match(content, /db\.from\("podcast_episode_captures"\)/);
});

test("Finder is removed while its old URL safely redirects home", () => {
  const data = read("data/prototype.ts");
  const shell = read("components/os/prototype-shell.tsx");
  const finderRoute = read("app/(os)/finder/page.tsx");
  assert.doesNotMatch(data, /\| "finder"/);
  assert.doesNotMatch(shell, /id:\s*"finder"/);
  assert.doesNotMatch(shell, />Finder</);
  assert.match(finderRoute, /redirect\("\/"\)/);
});

test("Spotlight is a lightweight search over existing public Brain endpoints", () => {
  const spotlight = read("components/os/spotlight.tsx");
  const shell = read("components/os/prototype-shell.tsx");
  for (const endpoint of ["books", "notes", "people", "browser", "human", "messages", "travel"]) {
    assert.match(spotlight, new RegExp(`"${endpoint}"`));
  }
  assert.doesNotMatch(spotlight, /embedding|vector|semantic/i);
  assert.match(shell, /event\.(?:metaKey \|\| event\.ctrlKey)/);
  assert.match(shell, /event\.key\.toLocaleLowerCase\(\) === "k"/);
});
