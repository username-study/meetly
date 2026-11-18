import type { LatLng } from "./types";

const EARTH_RADIUS_KM = 6371;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/** 두 좌표 사이의 직선거리(km) - Haversine */
export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** 좌표들의 단순 평균(무게중심). 한국 범위에서는 이 정도 근사로 충분 */
export function centroid(points: LatLng[]): LatLng {
  if (points.length === 0) throw new Error("centroid: 좌표가 없습니다.");
  const sum = points.reduce((s, p) => ({ lat: s.lat + p.lat, lng: s.lng + p.lng }), { lat: 0, lng: 0 });
  return { lat: sum.lat / points.length, lng: sum.lng / points.length };
}

/** 가장 멀리 떨어진 두 점 사이 거리(km) */
export function maxPairwiseKm(points: LatLng[]): number {
  let max = 0;
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      max = Math.max(max, haversineKm(points[i], points[j]));
    }
  }
  return max;
}
