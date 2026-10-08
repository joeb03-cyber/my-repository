// Run: node --test tests/control-app-auth.test.cjs (no credentials or live writes).
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("Home Screen login verifies the emailed OTP inside the same browser context", () => {
  const login = read("components/control/control-login.tsx");
  assert.match(login, /verifyOtp\(\{ email: email\.trim\(\), token, type: "email" \}\)/);
  assert.match(login, /autoComplete="one-time-code"/);
  assert.match(login, /inputMode="numeric"/);
  assert.match(login, /fetch\("\/api\/control\/content", \{ cache: "no-store" \}\)/);
  assert.match(login, /await supabase\.auth\.signOut\(\)/);
  assert.match(login, /window\.location\.replace\("\/control"\)/);
});

test("requesting a code cannot create another administrator", () => {
  const login = read("components/control/control-login.tsx");
  assert.match(login, /shouldCreateUser: false/);
  assert.match(login, /emailRedirectTo: `\$\{window\.location\.origin\}\/control\/auth\/callback`/);
});

test("Control Center has a dedicated standalone manifest and Home Screen icons", () => {
  const manifest = read("public/control-center.webmanifest");
  const layout = read("app/control/layout.tsx");
  assert.match(manifest, /"start_url": "\/control"/);
  assert.match(manifest, /"scope": "\/control"/);
  assert.match(manifest, /"display": "standalone"/);
  assert.match(layout, /manifest: "\/control-center\.webmanifest"/);
  assert.match(layout, /appleWebApp: \{ capable: true/);
  for (const size of [192, 512]) {
    const file = path.join(root, `public/control-center-icon-${size}.png`);
    assert.ok(fs.statSync(file).size > 1_000, `${size}px icon should be a real PNG`);
  }
});
