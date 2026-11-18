import { centroid, haversineKm, maxPairwiseKm } from "./geo";
import { EstimatedTransitProvider, walkingMinutes, type TravelTimeProvider } from "./estimate";
import type { MidpointResult, Participant, Place } from "./types";

export interface FindOptions {
  /** 몇 개의 안을 돌려줄지 (기본 3) */
  topN?: number;
  provider?: TravelTimeProvider;
  /** 비용 = 격차(분) + meanWeight × 평균 이동시간(분). 모두가 다 같이 멀리 가는 해를 억제 */
  meanWeight?: number;
  /** Top N 후보끼리 최소 이 거리(km) 이상 떨어뜨려 다양한 안을 제시 */
  minSeparationKm?: number;
  /** 참석자 간 최대 거리가 이 값(km) 미만이면 도보 중간 장소 모드 */
  walkThresholdKm?: number;
}

export type LocatedParticipant = Participant & { place: Place };

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const stdDev = (xs: number[]) => {
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
};
const round1 = (n: number) => Math.round(n * 10) / 10;

/** 공정성 점수: 가장 짧은 사람 ÷ 가장 긴 사람 (0~100) */
export function fairnessScore(minutes: number[]): number {
  const max = Math.max(...minutes);
  const min = Math.min(...minutes);
  if (max <= 0) return 100;
  return Math.round((min / max) * 100);
}

/**
 * 참석자 간 이동시간 격차가 가장 작은 중간 거점 Top N 을 구한다.
 *
 * 1) 참석자 간 최대 거리가 walkThresholdKm 미만 → 도보 모드 (무게중심 1곳)
 * 2) 그 외 → 각 후보 거점마다 참석자별 이동시간을 구하고
 *    cost = (최장 - 최단) + meanWeight × 평균  이 작은 순으로 정렬
 * 3) 서로 minSeparationKm 이상 떨어진 후보를 우선 골라 Top N 구성
 */
export async function findFairMidpoints(
  participants: Participant[],
  candidates: Place[],
  options: FindOptions = {},
): Promise<MidpointResult[]> {
  const {
    topN = 3,
    provider = new EstimatedTransitProvider(),
    meanWeight = 0.3,
    minSeparationKm = 1.5,
    walkThresholdKm = 1,
  } = options;

  const located = participants.filter((p): p is LocatedParticipant => p.place !== null);
  if (located.length < 2) throw new Error("출발지가 입력된 참석자가 2명 이상 필요합니다.");

  const origins = located.map((p) => p.place);

  // --- 도보 전환 예외 처리 (1km 미만) ---
  if (maxPairwiseKm(origins) < walkThresholdKm) {
    const c = centroid(origins);
    const place: Place = { id: "walk-center", name: "참석자들 사이 도보 중간 지점", address: "", ...c };
    const minutes = located.map((p) => round1(walkingMinutes(p.place, c)));
    return [buildResult(1, "walk", place, located, minutes)];
  }

  if (candidates.length === 0) throw new Error("중간 거점 후보를 찾지 못했습니다.");

  // --- 후보별 이동시간 계산 ---
  const scored = await Promise.all(
    candidates.map(async (cand) => {
      const minutes = await Promise.all(located.map((p) => provider.getMinutes(p.place, cand)));
      const cost = Math.max(...minutes) - Math.min(...minutes) + meanWeight * mean(minutes);
      return { cand, minutes, cost };
    }),
  );
  scored.sort((a, b) => a.cost - b.cost);

  // --- 서로 떨어진 후보 우선 선택 ---
  const picked: typeof scored = [];
  for (const s of scored) {
    if (picked.length >= topN) break;
    if (picked.every((p) => haversineKm(p.cand, s.cand) >= minSeparationKm)) picked.push(s);
  }
  for (const s of scored) {
    if (picked.length >= topN) break;
    if (!picked.includes(s)) picked.push(s); // 부족하면 비용순으로 채움
  }
  picked.sort((a, b) => a.cost - b.cost);

  return picked.map((s, i) => buildResult(i + 1, "transit", s.cand, located, s.minutes.map(round1)));
}

function buildResult(
  rank: number,
  mode: "transit" | "walk",
  place: Place,
  located: LocatedParticipant[],
  minutes: number[],
): MidpointResult {
  return {
    rank,
    mode,
    place,
    times: located.map((p, i) => ({ participantId: p.id, name: p.name, minutes: minutes[i] })),
    meanMinutes: round1(mean(minutes)),
    rangeMinutes: round1(Math.max(...minutes) - Math.min(...minutes)),
    stdDevMinutes: round1(stdDev(minutes)),
    fairness: fairnessScore(minutes),
  };
}
