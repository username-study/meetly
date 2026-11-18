import { NextRequest, NextResponse } from "next/server";
import { findFairMidpoints } from "@/lib/algorithm";
import { centroid, haversineKm } from "@/lib/geo";
import { dataSource, searchStationsAround } from "@/lib/kakao";
import { handleError, inKorea, isFiniteNum, jsonError } from "@/lib/apiHelpers";
import type { Participant } from "@/lib/types";

const MAX_PARTICIPANTS = 8;

/**
 * POST /api/midpoints
 * body: { participants: [{ id, name, place: { lat, lng, name, ... } }] }
 * → 이동시간 격차가 가장 작은 중간 거점 Top 3
 */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError("요청 본문이 올바른 JSON 이 아닙니다.");
  }

  const raw = (body as { participants?: unknown })?.participants;
  if (!Array.isArray(raw)) return jsonError("participants 배열이 필요합니다.");
  if (raw.length > MAX_PARTICIPANTS) return jsonError(`참석자는 최대 ${MAX_PARTICIPANTS}명까지 가능합니다.`);

  const participants: Participant[] = [];
  for (const item of raw as Array<Partial<Participant>>) {
    const p = item?.place;
    if (!p) continue; // 출발지 미입력 참석자는 계산에서 제외
    if (!isFiniteNum(p.lat) || !isFiniteNum(p.lng) || !inKorea(p.lat, p.lng)) {
      return jsonError(`'${item.name ?? "참석자"}'의 출발지 좌표가 올바르지 않습니다.`);
    }
    participants.push({
      id: String(item.id ?? participants.length),
      name: String(item.name ?? "").slice(0, 20) || `참석자${participants.length + 1}`,
      place: { id: String(p.id ?? ""), name: String(p.name ?? ""), address: String(p.address ?? ""), lat: p.lat, lng: p.lng },
    });
  }
  if (participants.length < 2) return jsonError("출발지가 입력된 참석자가 2명 이상 필요합니다.");

  try {
    const origins = participants.map((p) => p.place!);
    const center = centroid(origins);
    // 후보 탐색 반경: 무게중심에서 가장 먼 출발지까지 거리의 80% (3km ~ 20km)
    const farthestM = Math.max(...origins.map((o) => haversineKm(center, o))) * 1000;
    const radiusM = Math.min(20000, Math.max(3000, farthestM * 0.8));

    const candidates = await searchStationsAround(center, radiusM);
    const results = await findFairMidpoints(participants, candidates);
    return NextResponse.json({ results, source: dataSource(), candidateCount: candidates.length });
  } catch (e) {
    return handleError(e);
  }
}
