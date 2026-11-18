// lib/adapter.ts
import { haversineKm } from './geo';
import type { MidpointResult, Participant, TravelInfo } from './types';

/** dy 알고리즘 결과 → 이동시간 차트(TravelChart)용 데이터 */
export function toTravelInfos(result: MidpointResult, participants: Participant[]): TravelInfo[] {
  return result.times.map((t, i) => {
    const p = participants.find((x) => x.id === t.participantId);
    const distanceKm = p?.place ? Math.round(haversineKm(p.place, result.place) * 10) / 10 : 0;
    
    // 출발지 역명/장소명이 존재하면 "김OO (역촌역)" 형태로 표기
    const rawName = t.name || `참석자 ${i + 1}`;
    const placeName = p?.place?.name;
    const displayName = placeName ? `${rawName} (${placeName})` : rawName;

    return {
      memberId: t.participantId,
      memberName: displayName, // 차트 Y축에 [이름 (출발지)]로 표시
      durationMinutes: Math.round(t.minutes),
      distanceKm,
      // 1km 미만이거나 알고리즘이 도보 모드로 판정하면 도보
      isWalking: result.mode === 'walk' || distanceKm < 1,
      origin: p?.place ? { name: p.place.name, lat: p.place.lat, lng: p.place.lng } : undefined,
    };
  });
}