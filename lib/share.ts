// URL 파라미터 기반 공유 로직
import type { PlaceCategory } from './types';

// 'parking' 추가
const KINDS: PlaceCategory[] = ['cafe', 'meal', 'drink', 'drinks', 'restaurant', 'parking'];

/** 공유할 때 같이 담는 ⭐ 후보 장소 (짧은 키로 URL 길이를 줄인다) */
export interface SharePick {
  k: PlaceCategory; // 종류
  n: string; // 이름
  a: string; // 주소
  lat: number;
  lng: number;
  u?: string; // 카카오맵 상세 URL
}

export interface SharePayload {
  v: 1;
  plan: number; // 0 = 1안, 1 = 2안, 2 = 3안
  members: { n: string; o: string; lat: number; lng: number }[];
  dest: { name: string; lat: number; lng: number };
  picks?: SharePick[]; // 예전 링크에는 없을 수 있음
}

/** SharePayload 를 URL 에서 안전한 base64 로 인코딩 (+ / = 를 쓰지 않는다) */
function encodePayload(payload: SharePayload): string {
  const json = JSON.stringify(payload);
  const b64 = btoa(unescape(encodeURIComponent(json)));
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

/** URL-safe base64 를 SharePayload 로 디코딩 (예전 방식 링크도 읽는다) */
export function decodePayload(token: string): SharePayload | null {
  try {
    let b64 = token.replace(/ /g, '+').replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    const json = decodeURIComponent(escape(atob(b64)));
    const data = JSON.parse(json);
    if (data.v !== 1) return null;

    // picks 는 모양이 맞는 항목만 남긴다
    if (Array.isArray(data.picks)) {
      data.picks = data.picks.filter(
        (p: SharePick) =>
          p &&
          KINDS.includes(p.k) &&
          typeof p.n === 'string' &&
          Number.isFinite(p.lat) &&
          Number.isFinite(p.lng),
      );
    } else {
      data.picks = [];
    }
    return data as SharePayload;
  } catch {
    return null;
  }
}

/** 공유 URL 생성: https://도메인/?share=토큰 */
export function buildShareUrl(payload: SharePayload): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/?share=${encodePayload(payload)}`;
}

/** 현재 URL 의 ?share= 파라미터를 읽어 SharePayload 반환 (공유 링크로 들어왔을 때) */
export function parseShareParams(): SharePayload | null {
  if (typeof window === 'undefined') return null;
  const token = new URLSearchParams(window.location.search).get('share');
  if (!token) return null;
  return decodePayload(token);
}