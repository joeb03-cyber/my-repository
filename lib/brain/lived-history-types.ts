export type PhotoRelationshipState = "strong" | "moderate" | "editorial_confident" | "unresolved";

export interface LivedPhotoDerivative {
  url: string;
  width: number;
}

export interface LivedPhoto {
  id: string;
  captureDate: string | null;
  capturedYear: number | null;
  capturedMonth: number | null;
  datePrecision: "day" | "month" | null;
  width: number | null;
  height: number | null;
  orientation: "portrait" | "landscape" | "square" | "unknown";
  visitId: string | null;
  placeId: string | null;
  visitPlace: string | null;
  displayPlace: string | null;
  country: string | null;
  relationshipState: PhotoRelationshipState;
  wallpaper: boolean;
  mediaKind: "live_photo" | "still_photo";
  hasPrivateMotion: boolean;
  derivatives: {
    small: LivedPhotoDerivative;
    medium: LivedPhotoDerivative;
    large: LivedPhotoDerivative;
  };
}

export interface LivedVisit {
  id: string;
  chronologyIndex: number;
  placeId: string;
  place: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
  start: { year: number; month: number };
  end: { year: number; month: number };
  sourceDateText?: string;
  publicBlurb?: string | null;
  photoCount: number;
}

export interface LivedHistory {
  schemaVersion: string;
  stats: {
    photos: number;
    wallpapers: number;
    visits: number;
    visitsWithPhotos: number;
    lifetimeCountries: number;
    recentCountries: number;
    relationshipStates: Record<string, number>;
  };
  journeyStart: string;
  lifetimeCountries: string[];
  currentLocation: {
    canonical_name: string;
    country_name: string;
    latitude?: number;
    longitude?: number;
  } | null;
  visits: LivedVisit[];
  photos: LivedPhoto[];
}
