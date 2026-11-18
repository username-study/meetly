import { haversineKm } from "./geo";
import type { LatLng } from "./types";

/**
 * 두 지점 사이 이동시간(분)을 돌려주는 공급자.
 *
 * ⚠️ Kakao Local/Maps API 에는 '대중교통 소요시간' 을 주는 공개 API 가 없습니다
 *    (카카오모빌리티 길찾기는 자동차 기준). 그래서 기본값은 아래 '추정 모델'이고,
 *    실제 대중교통 API(ODsay, TMAP 대중교통 등)를 쓰고 싶으면 이 인터페이스만 구현해서
 *    findFairMidpoints 의 provider 옵션으로 넘기면 알고리즘은 그대로 동작합니다.
 */
export interface TravelTimeProvider {
  getMinutes(from: LatLng, to: LatLng): Promise<number>;
}

export const WALK_SPEED_KMH = 4.5;

/** 도보 이동시간(분) - 직선거리 × 우회계수 1.3 */
export function walkingMinutes(from: LatLng, to: LatLng): number {
  const km = haversineKm(from, to) * 1.3;
  return (km / WALK_SPEED_KMH) * 60;
}

export interface EstimateOptions {
  /** 직선거리 대비 실제 경로 길이 배율 */
  detourFactor?: number;
  /** 대중교통 평균 속도(km/h) - 정차·환승 포함 */
  transitSpeedKmh?: number;
  /** 승강장 접근 + 대기 등 고정 시간(분) */
  fixedMinutes?: number;
  /** 이 거리(km) 미만이면 걸어가는 것으로 계산 */
  walkUnderKm?: number;
}

/** 거리 기반 대중교통 이동시간 추정 모델 (API 키 없이 동작) */
export class EstimatedTransitProvider implements TravelTimeProvider {
  private readonly o: Required<EstimateOptions>;

  constructor(options: EstimateOptions = {}) {
    this.o = {
      detourFactor: 1.35,
      transitSpeedKmh: 25,
      fixedMinutes: 8,
      walkUnderKm: 1.2,
      ...options,
    };
  }

  async getMinutes(from: LatLng, to: LatLng): Promise<number> {
    const km = haversineKm(from, to);
    if (km < this.o.walkUnderKm) return walkingMinutes(from, to);
    return this.o.fixedMinutes + ((km * this.o.detourFactor) / this.o.transitSpeedKmh) * 60;
  }
}
