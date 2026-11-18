
'use client';

import { useEffect, useRef, useState } from 'react';

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  label: string;
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
  const [mapReady, setMapReady] = useState(false);
  const clickHandlerRef = useRef(onMarkerClick);

  useEffect(() => {
    clickHandlerRef.current = onMarkerClick;
  }, [onMarkerClick]);

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

    if (markers.length === 0) return;

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

    markers.forEach((m, index) => {
      const position = new window.kakao.maps.LatLng(m.lat, m.lng);
      bounds.extend(position);

if (m.id.startsWith('start-')) startMarkers.push(m);
if (m.id === 'mid') midMarkers.push(m);

      const wrapper = document.createElement('div');
      wrapper.className = 'relative group cursor-pointer transition-all';

      const offset = horizontalOffsets.get(index) ?? 0;
      // 중간지점과 거의 같은 위치의 후보 장소(⭐)는 라벨을 위로 띄워 서로 가리지 않게 한다
      const overlapsMid =
        !!midMarker &&
        m.id !== 'mid' &&
        !m.id.startsWith('start-') &&
        !m.compact &&
        Math.abs(m.lat - midMarker.lat) < 0.0003 &&
        Math.abs(m.lng - midMarker.lng) < 0.0003;
      wrapper.style.transform = `translate(${offset}px, ${overlapsMid ? -34 : 0}px)`;

      wrapper.onclick = () => {
        clickHandlerRef.current?.(m.selectId ?? m.id);
      };

      // 중간지점(mid)은 선택된 마커보다도 위에 표시
      const baseZ = m.id === 'mid' ? 1000 : m.selected ? 999 : m.compact ? 10 : 20;

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
        'flex items-center gap-1 rounded-full text-xs font-bold text-white transition-all duration-200';

      pin.style.backgroundColor = m.color || '#3b82f6';
      pin.style.color = '#ffffff';
      pin.style.border = m.selected
        ? '3px solid #facc15'
        : '2px solid #ffffff';
      if (m.compact) {
        // 장소 마커: 아이콘만 있는 작은 원형 (서로 덜 겹치게)
        const size = m.selected ? 28 : 22;
        pin.style.width = `${size}px`;
        pin.style.height = `${size}px`;
        pin.style.padding = '0';
        pin.style.justifyContent = 'center';
        pin.style.fontSize = m.selected ? '14px' : '11px';
        pin.style.transform = m.selected ? 'scale(1.15)' : 'scale(1)';
      } else {
        pin.style.padding = m.selected ? '7px 12px' : '4px 10px';
        pin.style.transform = m.selected ? 'scale(1.25)' : 'scale(1)';
      }
      pin.style.boxShadow = m.selected
        ? '0 0 0 5px rgba(250,204,21,0.3), 0 5px 12px rgba(0,0,0,0.3)'
        : '0 2px 6px rgba(0,0,0,0.2)';

      pin.innerHTML = m.compact
        ? `<span>${m.emoji || '📍'}</span>`
        : `<span>${m.emoji || '📍'}</span><span>${m.label}</span>`;

      wrapper.appendChild(pin);
      overlay.setMap(mapRef.current);
      mapMarkersRef.current.push(overlay);
    });

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

    // 장소 카드를 선택했을 때만 해당 마커로 확대 (출발지 선택은 기존처럼 전체 보기)
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
      // 전체 마커가 가장자리에 잘리지 않도록 여백을 두고 맞춤
      mapRef.current.setBounds(bounds, 80, 80, 80, 80);

      if (selectedMarker) {
        mapRef.current.setCenter(
          new window.kakao.maps.LatLng(selectedMarker.lat, selectedMarker.lng)
        );
      }
    }
  }, [markers, selectedMarkerId, mapReady, zoomOnSelect]);

  return (
    <div
      ref={containerRef}
      className="h-full w-full rounded-[16px] overflow-hidden"
      style={{ minHeight: '400px' }}
    />
  );
}
