// TravelChart에서 사용하는 도우미 함수

export const MAX_CHART_MINUTES = 40;

/**
 * 거리(km)를 보기 좋은 문자열로 변환
 */
export function formatDistance(km: number): string {
  if (km < 1) return '1km 미만';
  return `${km.toFixed(1)}km`;
}

/**
 * TravelInfo를 받아 차트용 모드('walk' | 'transit')와 표시 텍스트를 반환
 * isWalking 필드 대신 distanceKm 기준으로 자동 판정
 */
export function formatTravel(info: {
  durationMinutes: number;
  distanceKm: number;
}): { mode: 'walk' | 'transit'; text: string; label: string } {
  const isWalk = info.distanceKm < 1;
  const mode: 'walk' | 'transit' = isWalk ? 'walk' : 'transit';
  const text = `${info.durationMinutes}분 · ${formatDistance(info.distanceKm)}`;
  const label = `${info.durationMinutes}분`;
  return { mode, text, label };
}
