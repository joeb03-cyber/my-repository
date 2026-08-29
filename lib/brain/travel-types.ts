export interface TravelPlace {
  id: string;
  slug: string;
  sourceName: string;
  name: string;
  placeType: string;
  countryCode: string;
  countryName: string;
  latitude: number | null;
  longitude: number | null;
  coordinatesState: string;
  reviewState: string;
}

export interface TravelVisit {
  id: string;
  placeId: string;
  visitKind: "visit_or_stay_unspecified" | "visit" | "stay";
  sourcePosition: number;
  groupPosition: number;
  chronologyIndex: number;
  start: { year: number; month: number };
  end: { year: number; month: number };
  temporalPrecision: "month" | "month_range";
  sourceDateText: string;
  sourceValue: string;
  sourceRawLine: string;
  publicBlurb?: string | null;
  reviewState: string;
}

export interface TravelTimeline {
  schemaVersion: string;
  generatedFrom: string;
  sourceSnapshot: { id: string; capturedOn: string; contentHash: string; intro: Record<string, unknown> };
  stats: { sourceRecords: number; visits: number; movements: number; uniquePlaces: number; countries: number; resolvedPlaces: number; unresolvedPlaces: number };
  countries: string[];
  places: TravelPlace[];
  visits: TravelVisit[];
  movements: Array<Record<string, unknown>>;
  currentState?: { location: { canonical_name: string; country_code: string; country_name: string; state: string; provenance?: Record<string, string> } };
  review: { unresolvedPlaceLabels: string[]; currentLocationConflict?: Record<string, string>; currentLocationResolution?: Record<string, string> };
  mapAttribution: string;
}
