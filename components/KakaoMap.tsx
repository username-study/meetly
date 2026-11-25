'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  label: string;
  subLabel?: string;
  emoji?: string;
  color?: string;
  big?: boolean;
  compact?: boolean;
  selected?: boolean;
  selectId?: string;
}

interface KakaoMapProps {
  markers: MapMarker[];
  selectedMarkerId?: string | null;
  onMarkerClick?: (id: string) => void;
  /** true 이면 선택된 장소 마커로 지도를 확대한다 (3단계 장소 카드 선택용) */
  zoomOnSelect?: boolean;
}

// 장소 선택 시 확대 레벨 (숫자가 작을수록 더 확대)
const FOCUS_LEVEL = 4;

declare global {
  interface Window {
    kakao: any;
  }
}

export default function KakaoMap({
  markers,
  selectedMarkerId,
  onMarkerClick,
  zoomOnSelect = false,
}: KakaoMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const mapMarkersRef = useRef<any[]>([]);
  const polylinesRef = useRef<any[]>([]);
  const boundsRef = useRef<any>(null);
  const [mapReady, setMapReady] = useState(false);
  const [legendCollapsed, setLegendCollapsed] = useState(false);
  const clickHandlerRef = useRef(onMarkerClick);

  useEffect(() => {
    clickHandlerRef.current = onMarkerClick;
  }, [onMarkerClick]);

  // 범례 카드용 참석자(출발지) & 중간지점 목록 추출
  const legendItems = useMemo(() => {
    const starts = markers
      .filter((m) => m.id.startsWith('start-'))
      .map((m, idx) => ({
        id: m.selectId ?? m.id,
        order: idx + 1,
        label: m.label,
        subLabel: m.subLabel,
        color: m.color || '#2f6fed',
        lat: m.lat,
        lng: m.lng,
        selected: m.selected || (selectedMarkerId && (m.selectId ?? m.id) === selectedMarkerId),
      }));

    const mid = markers.find((m) => m.id === 'mid');
    return { starts, mid };
  }, [markers, selectedMarkerId]);

  // [전체 보기] 클릭 시 모든 마커가 한눈에 들어오도록 지도 범위 초기화
  const handleFitAll = () => {
    if (!mapRef.current || !boundsRef.current) return;
    mapRef.current.setBounds(boundsRef.current, 80, 80, 80, 80);
  };

  // 범례 항목 클릭 시 해당 핀 위치로 중심 이동 및 선택 이벤트 전달
  const handleLegendItemClick = (item: { id: string; lat: number; lng: number }) => {
    if (mapRef.current && window.kakao?.maps) {
      mapRef.current.panTo(new window.kakao.maps.LatLng(item.lat, item.lng));
    }
    clickHandlerRef.current?.(item.id);
  };

  // 1. 지도 초기화
  useEffect(() => {
    if (!containerRef.current) return;

    const initMap = () => {
      if (!window.kakao?.maps) return;

      window.kakao.maps.load(() => {
        if (!mapRef.current && containerRef.current) {
          mapRef.current = new window.kakao.maps.Map(
            containerRef.current,
            {
              center: new window.kakao.maps.LatLng(37.5665, 126.978),
              level: 7,
            }
          );
        }
        setMapReady(true);
      });
    };

    if (window.kakao?.maps) {
      initMap();
    } else {
      const script = document.createElement('script');
      script.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${process.env.NEXT_PUBLIC_KAKAO_MAP_KEY}&autoload=false&libraries=services`;
      script.onload = initMap;
      document.head.appendChild(script);
    }
  }, []);

  // 2. 마커 생성 및 선택 상태 반영
  useEffect(() => {
    if (!mapReady || !mapRef.current || !window.kakao?.maps) return;

    mapMarkersRef.current.forEach((m) => m.setMap(null));
    mapMarkersRef.current = [];

    polylinesRef.current.forEach((p) => p.setMap(null));
    polylinesRef.current = [];

    if (markers.length === 0) {
      boundsRef.current = null;
      return;
    }

    const bounds = new window.kakao.maps.LatLngBounds();
    const midMarker = markers.find((mk) => mk.id === 'mid');
    const startMarkers: MapMarker[] = [];
    const midMarkers: MapMarker[] = [];

    // 가까운 위치에 있는 장소 마커를 그룹화
    const nearbyGroups = new Map<string, number[]>();

    markers.forEach((m, index) => {
      if (!m.compact) return;

      const key = `${m.lat.toFixed(4)}-${m.lng.toFixed(4)}`;
      const group = nearbyGroups.get(key) ?? [];
      group.push(index);
      nearbyGroups.set(key, group);
    });

    const horizontalOffsets = new Map<number, number>();

    nearbyGroups.forEach((indexes) => {
      if (indexes.length <= 1) return;

      indexes.forEach((index, position) => {
        horizontalOffsets.set(
          index,
          (position - (indexes.length - 1) / 2) * 20
        );
      });
    });

    let startOrder = 0;
    let nearMidPickCount = 0;

    markers.forEach((m, index) => {
      const position = new window.kakao.maps.LatLng(m.lat, m.lng);
      bounds.extend(position);

      const isStart = m.id.startsWith('start-');
      const isMid = m.id === 'mid';

      if (isStart) {
        startOrder += 1;
        startMarkers.push(m);
      }
      if (isMid) midMarkers.push(m);

      const wrapper = document.createElement('div');
      wrapper.className = 'relative group cursor-pointer transition-all';

      let offsetX = horizontalOffsets.get(index) ?? 0;
      let offsetY = 0;

      // 중간지점(mid) 근처에 있는 후보 장소(⭐) 핀이 역 라벨에 가리지 않도록 좌우/상하로 분리 배치
      if (
        midMarker &&
        !isMid &&
        !isStart &&
        !m.compact &&
        Math.abs(m.lat - midMarker.lat) < 0.0012 &&
        Math.abs(m.lng - midMarker.lng) < 0.0015
      ) {
        const isEastOfMid = m.lng >= midMarker.lng;
        offsetX += isEastOfMid ? 68 : -68;
        offsetY = nearMidPickCount % 2 === 0 ? -18 : 18;
        nearMidPickCount += 1;
      }

      wrapper.style.transform = `translate(${offsetX}px, ${offsetY}px)`;

      wrapper.onclick = () => {
        clickHandlerRef.current?.(m.selectId ?? m.id);
      };

      const baseZ = isMid ? 1000 : m.selected ? 999 : m.compact ? 10 : 20;

      const overlay = new window.kakao.maps.CustomOverlay({
        position,
        content: wrapper,
        yAnchor: 1.2,
        zIndex: baseZ,
      });

      wrapper.onmouseenter = () => overlay.setZIndex(9999);
      wrapper.onmouseleave = () => overlay.setZIndex(baseZ);

      if (m.compact) {
        const tooltip = document.createElement('div');
        tooltip.className =
          'absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-slate-900/95 px-3 py-1.5 text-xs font-bold text-white shadow-2xl pointer-events-none z-[9999]';
        tooltip.textContent = `${m.emoji || '📍'} ${m.label}`;
        wrapper.appendChild(tooltip);
      }

      const pin = document.createElement('div');
      pin.className =
        'flex items-center gap-1.5 rounded-full font-bold text-white transition-all duration-200 whitespace-nowrap';

      const pinColor = isMid ? '#059669' : m.color || '#3b82f6';
      pin.style.backgroundColor = pinColor;
      pin.style.color = '#ffffff';
      pin.style.border = m.selected
        ? '3px solid #facc15'
        : isMid
        ? '2.5px solid #ffffff'
        : '2px solid #ffffff';

      if (m.compact) {
        const size = m.selected ? 28 : 22;
        pin.style.width = `${size}px`;
        pin.style.height = `${size}px`;
        pin.style.padding = '0';
        pin.style.justifyContent = 'center';
        pin.style.fontSize = m.selected ? '14px' : '11px';
        pin.style.transform = m.selected ? 'scale(1.15)' : 'scale(1)';
      } else if (isMid) {
        pin.style.padding = '7px 14px';
        pin.style.fontSize = '14px';
        pin.style.fontWeight = '800';
        pin.style.letterSpacing = '-0.01em';
      } else {
        pin.style.fontSize = '12px';
        pin.style.padding = m.selected ? '7px 12px' : '4px 10px';
        pin.style.transform = m.selected ? 'scale(1.25)' : 'scale(1)';
      }

      pin.style.boxShadow = m.selected
        ? '0 0 0 5px rgba(250,204,21,0.3), 0 5px 12px rgba(0,0,0,0.3)'
        : isMid
        ? '0 4px 14px rgba(5,150,105,0.42), 0 2px 6px rgba(0,0,0,0.2)'
        : '0 2px 6px rgba(0,0,0,0.2)';

      if (m.compact) {
        pin.innerHTML = `<span>${m.emoji || '📍'}</span>`;
      } else if (isStart) {
        pin.innerHTML = `<span style="display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;border-radius:9999px;background:#ffffff;color:${pinColor};font-size:10px;font-weight:900;line-height:1;">${startOrder}</span><span>${m.label}</span>`;
      } else if (isMid) {
        pin.innerHTML = `<span style="font-size:15px;line-height:1;">★</span><span>${m.label}</span>`;
      } else {
        pin.innerHTML = `<span>${m.emoji || '📍'}</span><span>${m.label}</span>`;
      }

      wrapper.appendChild(pin);
      overlay.setMap(mapRef.current);
      mapMarkersRef.current.push(overlay);
    });

    boundsRef.current = bounds;

    // 출발지에서 중간지점까지 연결선
    const midMarkerTarget = midMarkers[0];

    if (midMarkerTarget && startMarkers.length > 0) {
      const midPos = new window.kakao.maps.LatLng(
        midMarkerTarget.lat,
        midMarkerTarget.lng
      );

      startMarkers.forEach((start) => {
        const startPos = new window.kakao.maps.LatLng(
          start.lat,
          start.lng
        );

        const polyline = new window.kakao.maps.Polyline({
          path: [startPos, midPos],
          strokeWeight: 3,
          strokeColor: start.color || '#2f6fed',
          strokeOpacity: 0.8,
          strokeStyle: 'dash',
        });

        polyline.setMap(mapRef.current);
        polylinesRef.current.push(polyline);
      });
    }

    const selectedMarker = markers.find(
      (m) =>
        m.selected ||
        (selectedMarkerId && m.selectId === selectedMarkerId)
    );

    const zoomTarget =
      zoomOnSelect && selectedMarker && !selectedMarker.id.startsWith('start-')
        ? selectedMarker
        : null;

    if (zoomTarget) {
      mapRef.current.setLevel(FOCUS_LEVEL);
      mapRef.current.setCenter(
        new window.kakao.maps.LatLng(zoomTarget.lat, zoomTarget.lng)
      );
    } else {
      mapRef.current.setBounds(bounds, 80, 80, 80, 80);

      if (selectedMarker) {
        mapRef.current.setCenter(
          new window.kakao.maps.LatLng(selectedMarker.lat, selectedMarker.lng)
        );
      }
    }
  }, [markers, selectedMarkerId, mapReady, zoomOnSelect]);

  return (
    <div className="relative h-full w-full rounded-[16px] overflow-hidden" style={{ minHeight: '400px' }}>
      <div ref={containerRef} className="h-full w-full" />

      {/* 지도 왼쪽 하단 범례 카드 (참석자 핀이 1개 이상일 때 표시) */}
      {legendItems.starts.length > 0 && (
        <div className="absolute bottom-3 left-3 z-20 max-w-[230px] rounded-xl border border-slate-200/90 bg-white/95 p-2.5 shadow-lg backdrop-blur-xs">
          {/* 상단 컨트롤 바: 전체 보기 / 접기 */}
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleFitAll}
              className="text-[11px] font-extrabold text-primary hover:underline transition"
            >
              전체 보기
            </button>
            <button
              type="button"
              onClick={() => setLegendCollapsed((prev) => !prev)}
              className="text-[11px] font-bold text-slate-400 hover:text-slate-700 transition"
            >
              {legendCollapsed ? `펼치기 (${legendItems.starts.length}) ▲` : '접기 ▼'}
            </button>
          </div>

          {/* 범례 리스트 */}
          {!legendCollapsed && (
            <ul className="mt-2 space-y-1.5 border-t border-slate-100 pt-2 max-h-40 overflow-y-auto">
              {legendItems.starts.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => handleLegendItemClick(item)}
                    className={`w-full flex items-center gap-1.5 rounded-lg px-1.5 py-1 text-left transition ${
                      item.selected ? 'bg-blue-50/90' : 'hover:bg-slate-50'
                    }`}
                  >
                    <span
                      style={{ backgroundColor: item.color }}
                      className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-extrabold text-white"
                    >
                      {item.order}
                    </span>
                    <span className="truncate text-[11px] font-bold text-slate-800">
                      {item.label}
                    </span>
                    {item.subLabel && (
                      <span className="truncate text-[10px] text-slate-400">
                        {item.subLabel}
                      </span>
                    )}
                  </button>
                </li>
              ))}

              {legendItems.mid && (
                <li className="pt-1 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() =>
                      handleLegendItemClick({
                        id: legendItems.mid!.selectId ?? legendItems.mid!.id,
                        lat: legendItems.mid!.lat,
                        lng: legendItems.mid!.lng,
                      })
                    }
                    className="w-full flex items-center gap-1.5 rounded-lg px-1.5 py-1 text-left hover:bg-emerald-50/70 transition"
                  >
                    <span
                      style={{ backgroundColor: '#059669' }}
                      className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-extrabold text-white"
                    >
                      ★
                    </span>
                    <span className="truncate text-[11px] font-bold text-emerald-700">
                      {legendItems.mid.label}
                    </span>
                  </button>
                </li>
              )}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}