// lib/types.ts
export interface LatLng { lat: number; lng: number; }

export interface Place extends LatLng {
  id: string; name: string; address: string;
  categoryName?: string; url?: string; distance?: number;
  category?: PlaceCategory;
  rating?: number; kakaoMapUrl?: string; description?: string;
}

export interface Participant { id: string; name: string; place: Place | null; }

export interface SavedGroup { id: string; title: string; savedAt: string; participants: Participant[]; }

export type PlaceCategory = "cafe" | "meal" | "drink" | "drinks" | "restaurant" | "parking";

export type DataSource = "kakao" | "sample";

export interface NamedPoint extends LatLng { name: string; }

export interface TravelInfo {
  memberId: string; memberName: string;
  durationMinutes: number; distanceKm: number;
  isWalking?: boolean; origin?: NamedPoint;
}

export interface TravelTime { participantId: string; name: string; minutes: number; }

export interface MidpointResult {
  rank: number; mode: "transit" | "walk"; place: Place;
  times: TravelTime[]; meanMinutes: number;
  rangeMinutes: number; stdDevMinutes: number; fairness: number;
}

export interface SharePayload {
  v: 1; plan: number;
  members: { n: string; o: string; lat: number; lng: number }[];
  dest: NamedPoint;
}