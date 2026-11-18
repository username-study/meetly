import { NextResponse } from "next/server";
import { KakaoApiError } from "./kakao";

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/** Kakao 오류를 사용자에게 보여줄 한국어 안내로 바꾼다 */
export function handleError(e: unknown) {
  if (e instanceof KakaoApiError) {
    if (e.status === 401) return jsonError("Kakao REST API 키가 올바르지 않습니다. .env.local 을 확인하세요.", 502);
    if (e.status === 403) return jsonError("Kakao 앱에서 '카카오맵(Local)' 사용 설정이 꺼져 있습니다.", 502);
    if (e.status === 429) return jsonError("Kakao API 호출 한도를 초과했습니다. 잠시 후 다시 시도하세요.", 429);
    return jsonError(e.message, 502);
  }
  const message = e instanceof Error ? e.message : "알 수 없는 오류가 발생했습니다.";
  return jsonError(message, 500);
}

export const isFiniteNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
export const inKorea = (lat: number, lng: number) => lat >= 32 && lat <= 39.5 && lng >= 123 && lng <= 132.5;
