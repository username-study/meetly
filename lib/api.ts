import type { DataSource, MidpointResult, Participant, Place, PlaceCategory } from "./types";

/** 브라우저 → 우리 API 라우트 호출. 실패 시 사용자에게 보여줄 메시지로 Error 를 던진다 */
async function request<T>(url: string, init?: RequestInit, signal?: AbortSignal): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { ...init, signal });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new Error("서버에 연결할 수 없습니다. 네트워크를 확인해 주세요.");
  }
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? `요청에 실패했습니다 (${res.status})`);
  return data;
}

export const searchPlaces = (q: string, signal?: AbortSignal) =>
  request<{ places: Place[]; source: DataSource }>(`/api/places/search?q=${encodeURIComponent(q)}`, undefined, signal);

export const fetchNearby = (category: PlaceCategory, lat: number, lng: number, radius = 700, signal?: AbortSignal) =>
  request<{ places: Place[]; source: DataSource }>(
    `/api/places/nearby?category=${category}&lat=${lat}&lng=${lng}&radius=${radius}`,
    undefined,
    signal,
  );

export const calculateMidpoints = (participants: Participant[]) =>
  request<{ results: MidpointResult[]; source: DataSource }>("/api/midpoints", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ participants }),
  });
