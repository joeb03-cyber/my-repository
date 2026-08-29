import { NextResponse } from "next/server";
import { getCurrentState } from "@/lib/brain/notes.server";

export const dynamic = "force-dynamic";

const weatherLabels: Record<number, string> = {
  0: "Clear", 1: "Mostly clear", 2: "Partly cloudy", 3: "Overcast",
  45: "Fog", 48: "Fog", 51: "Drizzle", 53: "Drizzle", 55: "Drizzle",
  61: "Rain", 63: "Rain", 65: "Heavy rain", 71: "Snow", 73: "Snow",
  75: "Heavy snow", 80: "Showers", 81: "Showers", 82: "Heavy showers", 95: "Thunderstorms",
  96: "Thunderstorms", 99: "Thunderstorms",
};

export async function GET() {
  const state = await getCurrentState();
  if (state.where.city !== "Jajce" || state.where.country !== "Bosnia and Herzegovina") {
    return NextResponse.json({ unavailable: true }, { status: 503 });
  }
  try {
    const endpoint = new URL("https://api.open-meteo.com/v1/forecast");
    endpoint.search = new URLSearchParams({
      latitude: "44.3420", longitude: "17.2706", current: "temperature_2m,weather_code",
      timezone: state.where.timezone || "Europe/Sarajevo",
    }).toString();
    const response = await fetch(endpoint, { next: { revalidate: 900 } });
    if (!response.ok) throw new Error("Weather provider unavailable");
    const data = await response.json();
    return NextResponse.json({
      city: state.where.city,
      timezone: state.where.timezone || "Europe/Sarajevo",
      temperature: data.current.temperature_2m,
      unit: data.current_units.temperature_2m,
      label: weatherLabels[data.current.weather_code] || "Current weather",
      code: data.current.weather_code,
      provider: "Open-Meteo",
      observedAt: data.current.time,
    }, { headers: { "Cache-Control": "public, s-maxage=900, stale-while-revalidate=1800" } });
  } catch {
    return NextResponse.json({ unavailable: true, city: state.where.city }, { status: 503 });
  }
}
