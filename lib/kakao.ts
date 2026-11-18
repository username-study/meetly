import { sampleKeywordSearch, sampleNearby, SAMPLE_STATIONS } from "./mock";
import { haversineKm } from "./geo";
import type { DataSource, LatLng, Place, PlaceCategory } from "./types";

/**
 * Kakao Local REST API 래퍼 (서버 전용).
 * REST API 키는 브라우저에 노출되면 안 되므로 /api/* 라우트에서만 호출한다.
 * 문서: https://developers.kakao.com/docs/latest/ko/local/dev-guide
 */
const BASE = "https://dapi.kakao.com/v2/local/search";

export class KakaoApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export const hasKakaoKey = () => Boolean(process.env.KAKAO_REST_API_KEY?.trim());
export const dataSource = (): DataSource => (hasKakaoKey() ? "kakao" : "sample");

interface KakaoDoc {
  id: string;
  place_name: string;
  category_name?: string;
  category_group_code?: string;
  address_name?: string;
  road_address_name?: string;
  x: string; // 경도
  y: string; // 위도
  place_url?: string;
  distance?: string; // m (x,y 를 줬을 때만)
}

export function mapDoc(d: KakaoDoc): Place {
  return {
    id: d.id,
    name: d.place_name,
    address: d.road_address_name || d.address_name || "",
    categoryName: d.category_name,
    url: d.place_url,
    lat: Number(d.y),
    lng: Number(d.x),
    distance: d.distance ? Number(d.distance) : undefined,
  };
}

async function kakaoGet(path: string, params: Record<string, string | number | undefined>): Promise<Place[]> {
  const url = new URL(`${BASE}/${path}`);
  for (const [k, v] of Object.entries(params)) if (v !== undefined) url.searchParams.set(k, String(v));

  const res = await fetch(url, {
    headers: { Authorization: `KakaoAK ${process.env.KAKAO_REST_API_KEY!.trim()}` },
    cache: "no-store",
  });
  if (!res.ok) {
    let msg = `Kakao API 오류 (${res.status})`;
    try {
      const body = (await res.json()) as { message?: string };
      if (body.message) msg += `: ${body.message}`;
    } catch {
      /* 본문이 JSON 이 아니면 무시 */
    }
    throw new KakaoApiError(res.status, msg);
  }
  const json = (await res.json()) as { documents: KakaoDoc[] };
  return json.documents.map(mapDoc);
}

/** 출발지 키워드 검색 → 장소 + 좌표 */
export async function searchKeyword(query: string, size = 10): Promise<Place[]> {
  if (!hasKakaoKey()) return sampleKeywordSearch(query, size);
  return kakaoGet("keyword.json", { query, size });
}

/** 지하철역(SW8) 후보를 중심 좌표 주변에서 최대 45개(3페이지) 가져온다 */
export async function searchStationsAround(center: LatLng, radiusM: number): Promise<Place[]> {
  if (!hasKakaoKey()) {
    return SAMPLE_STATIONS.filter((s) => haversineKm(center, s) * 1000 <= radiusM);
  }
  const pages = await Promise.all(
    [1, 2, 3].map((page) =>
      kakaoGet("category.json", {
        category_group_code: "SW8",
        x: center.lng,
        y: center.lat,
        radius: Math.min(20000, Math.round(radiusM)),
        sort: "distance",
        size: 15,
        page,
      }).catch((e) => {
        // 2~3페이지가 비어서 오는 경우는 정상. 1페이지 실패만 에러로 취급
        if (page === 1) throw e;
        return [] as Place[];
      }),
    ),
  );
  return dedupeStations(pages.flat());
}

/** '강남역 2호선', '강남역 신분당선' 처럼 노선별로 나뉜 같은 역을 하나로 합친다 */
export function dedupeStations(stations: Place[]): Place[] {
  const seen = new Map<string, Place>();
  for (const s of stations) {
    const base = s.name.split(/\s+/)[0];
    const prev = seen.get(base);
    if (!prev || (s.distance ?? Infinity) < (prev.distance ?? Infinity)) seen.set(base, { ...s, name: base });
  }
  return [...seen.values()];
}

const CATEGORY_CODE: Partial<Record<PlaceCategory, string>> = { cafe: "CE7", meal: "FD6" };

/** 중간 지점 주변 추천 장소: 카페(CE7) / 식당(FD6) / 술집(키워드 검색) */
export async function searchNearby(
  category: PlaceCategory,
  center: LatLng,
  radiusM = 700,
  size = 15,
): Promise<Place[]> {
  if (!hasKakaoKey()) return sampleNearby(category, center.lat, center.lng, radiusM);

  const common = { x: center.lng, y: center.lat, radius: Math.min(20000, radiusM), sort: "distance", size };
  const code = CATEGORY_CODE[category];
  if (code) return kakaoGet("category.json", { category_group_code: code, ...common });
  // 술집은 카카오 카테고리 그룹 코드가 없어 키워드로 검색한다
  return kakaoGet("keyword.json", { query: "술집", ...common });
}
