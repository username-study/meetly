'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import type { Place, PlaceCategory } from '@/lib/types';
import { searchPlaces } from '@/lib/api';
import DirectionsButton from '@/components/DirectionsButton';

export interface Item {
  kind: PlaceCategory | 'parking';
  place: Place;
}

export const pickKey = (it: Item) => `${it.kind}-${it.place.id}`;

/** 3단계 지도에 표시할 장소 마커 수 (가까운 순). 목록에는 전부 보여준다 */
export const MAP_MARKER_LIMIT = 12;

type TabCategory = PlaceCategory | 'all' | 'parking';

const PERSON_COLORS = [
  '#2f6fed',
  '#e5484d',
  '#0d9ea3',
  '#d6409f',
  '#8b5e3c',
  '#3e63dd',
  '#5b6b7f',
  '#c2410c',
];
const personColor = (i: number) => PERSON_COLORS[i % PERSON_COLORS.length];

interface Props {
  center: { lat: number; lng: number; name: string };
  onShownChange?: (items: Item[]) => void;
  picks: Item[];
  onTogglePick: (item: Item) => void;
  selectedPlaceId?: string | null;
  onSelectPlace?: (id: string) => void;
  travelInfos?: any[];
  participants?: any[];
}

const TABS: { id: TabCategory; label: string }[] = [
  { id: 'all', label: '전체' },
  { id: 'cafe', label: '카페' },
  { id: 'meal', label: '식사' },
  { id: 'drink', label: '저녁모임' },
  { id: 'parking', label: '🅿️ 주차' },
];

const CATEGORY_STYLE: Record<string, { emoji: string; bg: string }> = {
  cafe: { emoji: '☕', bg: 'bg-amber-100/80 text-amber-900' },
  meal: { emoji: '🍽️', bg: 'bg-emerald-100/80 text-emerald-900' },
  drink: { emoji: '🌙', bg: 'bg-indigo-100/80 text-indigo-900' },
  parking: { emoji: '🅿️', bg: 'bg-blue-100/80 text-blue-900' },
};

const getPlaceDetailUrl = (place: Place) => {
  if (place.url) return place.url;
  return `https://place.map.kakao.com/${place.id}`;
};

// 1. 좌표 기반 Haversine 직경 거리 계산
function getHaversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

const getDistanceMeters = (
  place: { distance?: number | string; lat: number; lng: number },
  center: { lat: number; lng: number }
): number => {
  const raw = typeof place.distance === 'string' ? parseInt(place.distance, 10) : place.distance;
  if (raw != null && !isNaN(raw) && raw > 0) return raw;
  if (place.lat && place.lng && center.lat && center.lng) {
    return getHaversineDistance(center.lat, center.lng, place.lat, place.lng);
  }
  return Infinity;
};

// 거리 및 도보 계산 결과 객체 반환
const getDistanceObj = (
  place: { distance?: number | string; lat: number; lng: number },
  center: { lat: number; lng: number; name: string }
) => {
  let dist =
    typeof place.distance === 'string'
      ? parseInt(place.distance, 10)
      : place.distance;

  if (dist == null || isNaN(dist) || dist <= 0) {
    if (place.lat && place.lng && center.lat && center.lng) {
      dist = getHaversineDistance(center.lat, center.lng, place.lat, place.lng);
    }
  }

  if (dist != null && !isNaN(dist)) {
    const approxWalkDist = Math.round(dist * 1.2);
    if (approxWalkDist < 50) {
      return { distText: `${center.name} 근처`, walkText: '도보 1분 이내', walkMin: 1 };
    }
    const min = Math.max(1, Math.round(approxWalkDist / 67));
    return { distText: `${center.name}에서 ${dist}m`, walkText: `도보 ${min}분`, walkMin: min };
  }

  return { distText: `${center.name} 인근`, walkText: '', walkMin: 1 };
};

export function NearbyPlaces({
  center,
  onShownChange,
  picks,
  onTogglePick,
  selectedPlaceId,
  onSelectPlace,
  travelInfos = [],
  participants = [], // 👈 [수정 포인트] props에서 받아오도록 기본값 포함하여 선언
}: Props) {
  const [tab, setTab] = useState<TabCategory>('all');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [items, setItems] = useState<Item[]>([]);

  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const fetchData = () => {
    let active = true;
    const controller = new AbortController();
    setLoading(true);
    setError('');

    Promise.allSettled([
      searchPlaces(`${center.name} 카페`, controller.signal).then((res: { places: Place[] }) =>
        (res.places || []).map((p) => ({ kind: 'cafe' as const, place: p }))
      ),
      searchPlaces(`${center.name} 맛집`, controller.signal).then((res: { places: Place[] }) =>
        (res.places || []).map((p) => ({ kind: 'meal' as const, place: p }))
      ),
      searchPlaces(`${center.name} 모임 장소`, controller.signal).then((res: { places: Place[] }) =>
        (res.places || []).map((p) => ({ kind: 'drink' as const, place: p }))
      ),
      searchPlaces(`${center.name} 주차장`, controller.signal).then((res: { places: Place[] }) =>
        (res.places || []).map((p) => ({ kind: 'parking' as const, place: p }))
      ),
    ])
      .then((results) => {
        if (!active) return;
        const fetchedItems: Item[] = [];
        const seenIds = new Set<string>();

        results.forEach((res) => {
          if (res.status === 'fulfilled') {
            res.value.forEach((item) => {
              if (!seenIds.has(item.place.id)) {
                seenIds.add(item.place.id);
                fetchedItems.push(item);
              }
            });
          }
        });

        setItems(fetchedItems);
      })
      .catch((e: Error) => {
        if (!active || e.name === 'AbortError') return;
        setError(e.message || '장소 데이터를 불러오는 중 오류가 발생했습니다.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  };

  useEffect(() => {
    const cleanup = fetchData();
    return cleanup;
  }, [center.name]);

  const shown: Item[] = useMemo(() => {
    let list: Item[];
    if (tab === 'all') {
      list = items.filter((it) => it.kind !== 'parking');
    } else if (tab === 'parking') {
      list = items.filter(
        (it) => it.kind === 'parking' || it.place.name.includes('주차') || it.place.address?.includes('주차')
      );
    } else {
      list = items.filter((it) => it.kind === tab);
    }
    return [...list].sort(
      (a, b) => getDistanceMeters(a.place, center) - getDistanceMeters(b.place, center)
    );
  }, [items, tab, center.lat, center.lng]);

  useEffect(() => {
    onShownChange?.(shown);
  }, [shown, onShownChange]);

  useEffect(() => {
    if (selectedPlaceId && cardRefs.current[selectedPlaceId]) {
      cardRefs.current[selectedPlaceId]?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [selectedPlaceId]);

  const pickedSet = new Set(picks.map(pickKey));

  return (
    <div className="space-y-4">
      <div className="space-y-3 border-b border-slate-100 pb-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900">📍 주변 추천 장소</h2>
          <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
            담은 장소 {picks.length}곳
          </span>
        </div>
        <p className="text-xs text-slate-400">
          {center.name}에서 가까운 장소부터 보여드려요
        </p>
        {shown.length > MAP_MARKER_LIMIT && (
          <p className="text-[11px] text-slate-400">
            지도에는 가까운 {MAP_MARKER_LIMIT}곳만 표시돼요
          </p>
        )}
        <div className="grid grid-cols-5 gap-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`rounded-md py-1.5 text-center text-xs font-bold transition ${
                tab === t.id
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="py-12 text-center space-y-2">
          <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
          <p className="text-xs text-slate-500">주변 추천 장소를 검색하고 있습니다…</p>
        </div>
      )}

      {error && !loading && (
        <div className="rounded-xl bg-red-50/80 p-3 text-center border border-red-200/60 space-y-2">
          <p className="text-xs font-bold text-red-800">⚠️ 장소를 불러올 수 없습니다</p>
          <p className="text-[11px] text-red-600">{error}</p>
          <button
            type="button"
            onClick={fetchData}
            className="inline-flex items-center justify-center rounded-lg bg-red-100 px-3 py-1 text-xs font-bold text-red-700 hover:bg-red-200 transition"
          >
            🔄 다시 시도하기
          </button>
        </div>
      )}

      {!loading && !error && shown.length === 0 && (
        <div className="py-10 text-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-6 space-y-1.5">
          <p className="text-xl">🔍</p>
          <p className="text-xs font-bold text-slate-700">추천 장소 검색 결과가 없습니다</p>
          <p className="text-[11px] text-slate-400">
            {tab === 'all'
              ? '주변에 등록된 장소 정보를 찾지 못했습니다.'
              : `선택하신 '${TABS.find((t) => t.id === tab)?.label}' 카테고리의 추천 장소가 없습니다.`}
          </p>
        </div>
      )}

      {!loading && !error && shown.length > 0 && (
        <div className="space-y-3">
          {shown.map((it) => {
            const key = pickKey(it);
            const isPicked = pickedSet.has(key);
            const isSelected = selectedPlaceId === it.place.id;
            const detailUrl = getPlaceDetailUrl(it.place);
            const style = CATEGORY_STYLE[it.kind] || CATEGORY_STYLE.cafe;
            const { distText, walkText, walkMin } = getDistanceObj(it.place, center);

            return (
              <div
                key={key}
                ref={(el) => { cardRefs.current[it.place.id] = el; }}
                onClick={(event) => {
                  const target = event.target as HTMLElement;
                  if (target.closest('button, a')) return;
                  onSelectPlace?.(it.place.id);
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.target !== event.currentTarget) return;
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onSelectPlace?.(it.place.id);
                  }
                }}
                className={`cursor-pointer rounded-2xl border p-4 transition-all duration-200 ${
                  isSelected
                    ? 'border-emerald-600 bg-emerald-50/30 ring-2 ring-emerald-500 shadow-md'
                    : isPicked
                    ? 'border-amber-400 bg-amber-50/70'
                    : 'border-slate-200/80 bg-white hover:border-slate-300'
                }`}
              >
                {/* 1줄: 아이콘 + 이름/별점 + 담기 */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${style.bg} text-base`}>
                      {style.emoji}
                    </div>
                    <div className="flex min-w-0 items-center gap-1.5">
                      <b className="truncate text-sm font-bold text-slate-800">
                        {it.place.name}
                      </b>
                      {it.place.rating != null && (
                        <span className="shrink-0 text-xs font-bold text-amber-600">
                          ★ {Number(it.place.rating).toFixed(1)}
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onTogglePick(it)}
                    className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold transition-all active:scale-95 ${
                      isPicked
                        ? 'bg-amber-400 text-white hover:bg-amber-500'
                        : 'border border-slate-200/60 bg-slate-100 text-slate-700 hover:bg-amber-100 hover:text-amber-800'
                    }`}
                  >
                    {isPicked ? '★ 담김' : '☆ 담기'}
                  </button>
                </div>

                {/* 2줄: 역 거리 · 도보 시간 및 주소 */}
                <div className="mt-2.5">
                  <p className="text-xs font-semibold text-emerald-700">
                    📍 {distText}{walkText ? ` · ${walkText}` : ''}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-slate-400">
                    {it.place.address || '주소 정보 없음'}
                  </p>
                </div>

                {/* 🌟 참석자별 총 이동 예상 시간 칩 (입력된 이름 우선 노출) */}
                {travelInfos.length > 0 && (
                  <div className="mt-3 rounded-xl bg-slate-50 p-2.5 border border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 mb-1.5">⏱️ 참석자별 총 이동 예상 시간</p>
                    <div className="flex flex-wrap gap-1.5">
                      {travelInfos.map((info: any, idx: number) => {
                        const baseTime = info.timeMinutes ?? info.durationMinutes ?? info.time ?? 0;
                        const totalTime = baseTime + walkMin;
                        
                        const matchingParticipant = participants[idx];
                        const displayName = 
                          matchingParticipant?.name && matchingParticipant.name.trim() !== ''
                            ? matchingParticipant.name
                            : info.name && !info.name.startsWith('참석자')
                            ? info.name
                            : matchingParticipant?.place?.name || `참석자 ${idx + 1}`;

                        return (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 border border-slate-200/80 shadow-2xs"
                          >
                            <span
                              className="h-2 w-2 rounded-full shrink-0"
                              style={{ backgroundColor: personColor(idx) }}
                            />
                            <span>{displayName}</span>
                            <b className="text-emerald-700">{totalTime}분</b>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 3줄: 링크 버튼 */}
                <div className="mt-3 flex items-center justify-end gap-1.5 border-t border-slate-100 pt-2.5">
                  <a
                    href={detailUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                  >
                    상세 ↗
                  </a>
                  <div className="[&_a]:!px-2.5 [&_a]:!py-1 [&_a]:!text-xs [&_a]:!rounded-md">
                    <DirectionsButton place={it.place} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}