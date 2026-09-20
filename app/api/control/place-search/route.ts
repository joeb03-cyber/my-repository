import { NextRequest, NextResponse } from "next/server";
import { getControlAdmin } from "@/lib/brain/control-auth.server";

export const dynamic = "force-dynamic";

let lastLookupAt = 0;
let lookupQueue: Promise<unknown> = Promise.resolve();

function limitedLookup(url: URL) {
  const pending = lookupQueue.then(async () => {
    const wait = Math.max(0, 1100 - (Date.now() - lastLookupAt));
    if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
    lastLookupAt = Date.now();
    return fetch(url, {
      headers: { "User-Agent": "SynergeticHuman/1.0 (personal location editor; https://www.synergetichuman.com)", "Accept-Language": "en" },
      next: { revalidate: 86400 },
      signal: AbortSignal.timeout(8000),
    });
  });
  lookupQueue = pending.then(() => undefined, () => undefined);
  return pending;
}

export async function GET(request: NextRequest) {
  if (!await getControlAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const city = String(request.nextUrl.searchParams.get("city") || "").trim().slice(0, 120);
  const country = String(request.nextUrl.searchParams.get("country") || "").trim().slice(0, 120);
  if (city.length < 2 || country.length < 2) return NextResponse.json({ error: "Enter a place and country first." }, { status: 400 });

  // Deliberately user-triggered, single-admin lookup, not an autocomplete or
  // bulk geocoder. Cache identical searches and identify this application.
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("city", city);
  url.searchParams.set("country", country);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", "5");
  try {
    const response = await limitedLookup(url);
    if (!response.ok) throw new Error("Place lookup is temporarily unavailable.");
    const raw = await response.json();
    const results = (Array.isArray(raw) ? raw : []).flatMap((item: any) => {
      const latitude = Number(item.lat), longitude = Number(item.lon);
      const countryCode = String(item.address?.country_code || "").toUpperCase();
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !/^[A-Z]{2}$/.test(countryCode)) return [];
      const sourceType = String(item.osm_type || "");
      const sourceId = Number(item.osm_id);
      if (!["node", "way", "relation"].includes(sourceType) || !Number.isSafeInteger(sourceId)) return [];
      return [{
        name: String(item.name || city).slice(0, 120),
        country: String(item.address?.country || country).slice(0, 120),
        countryCode, latitude, longitude,
        label: String(item.display_name || `${city}, ${country}`).slice(0, 260),
        sourceId: `${sourceType}/${sourceId}`,
      }];
    });
    return NextResponse.json({ results, attribution: "© OpenStreetMap contributors" }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Place lookup is unavailable. Please try again in a moment." }, { status: 502 });
  }
}
