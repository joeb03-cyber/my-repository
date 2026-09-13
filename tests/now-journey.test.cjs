// Run: node --test tests/now-journey.test.cjs (local mock; no credentials or writes).
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");

function loadRoute(db) {
  const source = fs.readFileSync(path.join(root, "app/api/control/action/route.ts"), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const module = { exports: {} };
  new Function("require", "module", "exports", outputText)((name) => {
    if (name === "next/server") return { NextResponse: { json: (body, options) => Response.json(body, options) } };
    if (name === "@/lib/brain/control-auth.server") return { getControlAdmin: async () => ({ supabase: db, user: { id: "joe" } }) };
    throw new Error(`Unexpected dependency: ${name}`);
  }, module, module.exports);
  return module.exports.POST;
}

function mockBrain(options = {}) {
  const calls = [];
  const place = options.place || { id: "place-konjic", name: "Konjic", country_name: "Bosnia and Herzegovina", country_code: "BA", latitude: 43.65, longitude: 17.96 };
  function result(table, operation, terminal) {
    if (table === "travel_places" && operation === "select") return { data: [place], error: null };
    if (table === "travel_visits" && operation === "select" && terminal === "maybeSingle") return { data: { id: options.visitId || "visit-konjic" }, error: null };
    return { data: null, error: null };
  }
  const db = {
    from(table) {
      calls.push(["from", table]);
      let operation = "";
      const query = {
        select(...args) { operation = "select"; calls.push(["select", table, ...args]); return query; },
        insert(value) { operation = "insert"; calls.push(["insert", table, value]); return query; },
        update(value) { operation = "update"; calls.push(["update", table, value]); return query; },
        eq(...args) { calls.push(["eq", table, ...args]); return query; },
        neq(...args) { calls.push(["neq", table, ...args]); return query; },
        limit(...args) { calls.push(["limit", table, ...args]); return query; },
        maybeSingle: async () => result(table, operation, "maybeSingle"),
        then(resolve, reject) { return Promise.resolve(result(table, operation, "await")).then(resolve, reject); },
      };
      return query;
    },
  };
  return { db, calls };
}

const currentState = {
  where: { city: "Konjic", country: "Bosnia and Herzegovina", coordinates: "43.65, 17.96" },
  humanBattery: {},
};

test("one NOW save reuses an existing canonical Place/Visit before publishing current state", async () => {
  const { db, calls } = mockBrain();
  const POST = loadRoute(db);
  const response = await POST(new Request("http://localhost/api/control/action", {
    method: "POST",
    body: JSON.stringify({
      action: "save-current-state",
      state: currentState,
      syncLocationToJourney: true,
      journeyVisit: { city: "Different client value", country: "Different client value", startMonth: "2026-09", endMonth: "2026-09" },
    }),
  }));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(body.journey, { id: "visit-konjic", placeId: "place-konjic", placeName: "Konjic", countryName: "Bosnia and Herzegovina", countryCode: "BA", coordinates: "43.65, 17.96", created: false });
  const placeLookup = calls.findIndex((call) => call[0] === "from" && call[1] === "travel_places");
  const currentInsert = calls.findIndex((call) => call[0] === "insert" && call[1] === "current_state_snapshots");
  assert.ok(placeLookup >= 0 && currentInsert > placeLookup, "Journey is resolved before NOW is published");
  const insertedState = calls[currentInsert][2].state;
  assert.equal(insertedState.where.city, "Konjic");
  assert.equal(insertedState.where.country, "Bosnia and Herzegovina");
  assert.equal(insertedState.where.coordinates, "43.65, 17.96");
  assert.equal(calls.filter((call) => call[0] === "insert" && call[1] === "travel_visits").length, 0, "duplicate Visit is not inserted");
});

test("ordinary NOW edits do not touch Journey when location is unchanged", async () => {
  const { db, calls } = mockBrain();
  const POST = loadRoute(db);
  const response = await POST(new Request("http://localhost/api/control/action", {
    method: "POST",
    body: JSON.stringify({ action: "save-current-state", state: currentState, syncLocationToJourney: false }),
  }));
  assert.equal(response.status, 200);
  assert.equal(calls.some((call) => call[1] === "travel_places" || call[1] === "travel_visits"), false);
  assert.equal((await response.json()).journey, null);
});

test("punctuation variants reuse the same canonical Place and Visit", async () => {
  const { db, calls } = mockBrain({
    place: { id: "place-vernet", name: "Vernet Les-Bains", country_name: "France", country_code: "FR", latitude: null, longitude: null },
    visitId: "visit-vernet",
  });
  const POST = loadRoute(db);
  const response = await POST(new Request("http://localhost/api/control/action", {
    method: "POST",
    body: JSON.stringify({ action: "save-journey-visit", visit: { city: "Vernet-Les-Bains", country: "France", startMonth: "2026-09", endMonth: "2026-09" } }),
  }));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.placeId, "place-vernet");
  assert.equal(body.id, "visit-vernet");
  assert.equal(body.created, false);
  assert.equal(calls.some((call) => call[0] === "insert" && call[1] === "travel_places"), false);
  assert.equal(calls.some((call) => call[0] === "insert" && call[1] === "travel_visits"), false);
});

test("NOW client submits the location and Journey update through one server action", () => {
  const source = fs.readFileSync(path.join(root, "components/control/control-center.tsx"), "utf8");
  const nowEditor = source.slice(source.indexOf("function NowEditor"), source.indexOf("function ReadingBookPicker"));
  assert.match(nowEditor, /action\(\{ action: "save-current-state", state, syncLocationToJourney: locationChanged, journeyVisit: journey \}\)/);
  assert.doesNotMatch(nowEditor, /action\(\{ action: "save-journey-visit"/);
  assert.match(nowEditor, /identityChanged \? \{ coordinates: "", timezone \}/);
});

test("mistaken visits are recoverably archived rather than physically deleted", () => {
  const route = fs.readFileSync(path.join(root, "app/api/control/action/route.ts"), "utf8");
  const archiveAction = route.slice(route.indexOf('input.action === "archive-journey-visit"'), route.indexOf('input.action === "save-visit-reflection"'));
  assert.match(archiveAction, /visibility: "excluded", editorial_state: "rejected"/);
  assert.match(archiveAction, /photographs attached/);
  assert.doesNotMatch(archiveAction, /\.delete\(/);
  const control = fs.readFileSync(path.join(root, "components/control/control-center.tsx"), "utf8");
  assert.match(control, /Remove mistaken visit/);
});

test("weather and Maps no longer contain location-specific Jajce/Bosnia fallbacks", () => {
  const weather = fs.readFileSync(path.join(root, "app/api/brain/weather/route.ts"), "utf8");
  const travel = fs.readFileSync(path.join(root, "lib/brain/travel.server.ts"), "utf8");
  assert.doesNotMatch(weather, /state\.where\.city !== "Jajce"/);
  assert.doesNotMatch(weather, /latitude: "44\.3420"/);
  assert.doesNotMatch(travel, /country_code: "BA"/);
});
