'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { MapPin, Users, ChevronDown, ChevronUp, Sparkles, BookmarkCheck, Check } from 'lucide-react';
import Footer from '@/components/Footer';
import KakaoMap, { type MapMarker } from '@/components/KakaoMap';
import ShareButton from '@/components/ShareButton';
import DirectionsButton from '@/components/DirectionsButton';
import { InputForm } from '@/components/InputForm';
import { ResultsPanel } from '@/components/ResultsPanel';
import { NearbyPlaces, pickKey, MAP_MARKER_LIMIT, type Item } from '@/components/NearbyPlaces';
import { SavedGroupsPanel } from '@/components/SavedGroupsPanel';

import { useMeetlyForm } from '@/lib/useMeetlyForm';
import { calculateMidpoints } from '@/lib/api';
import { toTravelInfos } from '@/lib/adapter';
import { parseShareParams } from '@/lib/share';
import type { MidpointResult, Participant, PlaceCategory } from '@/lib/types';

const TravelChart = dynamic(() => import('@/components/TravelChart'), { ssr: false });

const TABS = [
  { id: 1, step: '01', label: '출발지 입력' },
  { id: 2, step: '02', label: '중간지점 · 이동시간' },
  { id: 3, step: '03', label: '추천 장소' },
  { id: 4, step: '04', label: '약속 공유' },
];
const LAST_STEP = TABS.length;
const SAVED_TAB = 6;

const COLOR = {
  mid: '#059669',
  place: '#7c5cd6',
  pick: '#f59e0b',
};

const PERSON_COLORS = [
  '#2f6fed', // 1: 파랑
  '#ef4444', // 2: 빨강
  '#10b981', // 3: 초록
  '#f59e0b', // 4: 주황
  '#8b5cf6', // 5: 보라
  '#ec4899', // 6: 핑크
  '#06b6d4', // 7: 청록
  '#64748b', // 8: 슬레이트
];
const personColor = (i: number) => PERSON_COLORS[i % PERSON_COLORS.length];

const PREV_LABEL: Record<number, string> = {
  2: '← 출발지 수정',
  3: '← 중간지점 보기',
  4: '← 추천 장소',
};
const NEXT_LABEL: Record<number, string> = {
  1: '중간지점 계산하기 →',
  2: '주변 약속장소 보기 →',
  3: '약속 후보 공유하기 →',
};

const PIN: Record<string, string> = { cafe: '☕', meal: '🍽️', restaurant: '🍽️', drink: '🌙', drinks: '🌙', parking: '🅿️' };

const PICK_GROUPS: { title: string; kinds: PlaceCategory[] }[] = [
  { title: '☕ 카페', kinds: ['cafe'] },
  { title: '🍽️ 식사', kinds: ['meal', 'restaurant'] },
  { title: '🌙 저녁 모임', kinds: ['drink', 'drinks'] },
  { title: '🅿️ 주차', kinds: ['parking'] },
];

const enc = (s: string) => encodeURIComponent(s.replace(/,/g, ' '));
const routeUrl = (from: { name: string; lat: number; lng: number }, to: { name: string; lat: number; lng: number }) =>
  `https://map.kakao.com/link/by/transit/${enc(from.name)},${from.lat},${from.lng}/${enc(to.name)},${to.lat},${to.lng}`;

function EmptyState({ text, onGo }: { text: string; onGo: () => void }) {
  return (
    <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-8 text-center">
      <p className="text-base font-bold text-slate-700">{text}</p>
      <button
        type="button"
        onClick={onGo}
        className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-primary px-5 py-3 text-sm font-black text-white shadow-md transition hover:bg-primary/90 active:scale-95"
      >
        ← 출발지 입력하러 가기
      </button>
    </div>
  );
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<number>(1);
  const [results, setResults] = useState<MidpointResult[]>([]);
  const [selected, setSelected] = useState(0);
  const [calcParticipants, setCalcParticipants] = useState<Participant[]>([]);
  const [calculating, setCalculating] = useState(false);
  const [calcError, setCalcError] = useState('');
  const [nearby, setNearby] = useState<Item[]>([]);
  const [picks, setPicks] = useState<Item[]>([]);
  const [showDetails, setShowDetails] = useState(false);

  const [selectedParticipantId, setSelectedParticipantId] = useState<string | null>(null);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);

  // 4단계 약속 저장하기 입력 및 완료 메시지 상태
  const [saveTitleInput, setSaveTitleInput] = useState('');
  const [completeSavedMsg, setCompleteSavedMsg] = useState('');

  const runCalculateRef = useRef<
    ((ps: Participant[], pickPlan?: number, initialPicks?: Item[], targetTab?: number) => Promise<void>) | null
  >(null);

  const form = useMeetlyForm({
    onLoaded: (group) => {
      // 4단계에서 저장된 완성 코스(planIndex 또는 picks 포함)라면 즉시 계산 및 후보 장소까지 복원
      if (group && (group.planIndex !== undefined || (group.picks && group.picks.length > 0))) {
        const validPs = group.participants.filter((p) => p.place);
        if (validPs.length >= 2 && runCalculateRef.current) {
          runCalculateRef.current(validPs, group.planIndex ?? 0, (group.picks as Item[]) ?? [], 4);
          return;
        }
      }
      setActiveTab(1);
    },
  });

  const r: MidpointResult | undefined = results[selected];

  const togglePick = useCallback((item: Item) => {
    const key = pickKey(item);
    setPicks((ps) => (ps.some((p) => pickKey(p) === key) ? ps.filter((p) => pickKey(p) !== key) : [...ps, item]));
  }, []);

  const handleSelect = (i: number) => {
    if (i === selected) return;
    setSelected(i);
    setPicks([]);
  };

  /** 지도 핀 생성 */
  const markers = useMemo<MapMarker[]>(() => {
    const list: MapMarker[] = [];
    const pickedKeys = new Set(picks.map(pickKey));
    const targetParticipants = activeTab === 1 ? form.participants : calcParticipants;

    if (activeTab !== 3) {
      targetParticipants
        .filter((p): p is Participant & { place: NonNullable<Participant['place']> } => !!p.place)
        .forEach((p, i) => {
          const place = p.place;
          const hasCustomName = p.name && p.name.trim() !== '';
          list.push({
            id: `start-${p.id}`,
            selectId: p.id,
            lat: place.lat,
            lng: place.lng,
            label: hasCustomName ? p.name : place.name,
            subLabel: hasCustomName ? place.name : undefined,
            emoji: '🚩',
            color: personColor(i),
            compact: false,
            selected: selectedParticipantId === p.id,
          });
        });
    }

    if (!r) return list;

    const rankLabel = selected === 0 ? '1안' : selected === 1 ? '2안' : '3안';
    list.push({
      id: 'mid',
      lat: r.place.lat,
      lng: r.place.lng,
      label: `[${rankLabel}] ${r.place.name}`,
      emoji: '★',
      big: true,
      color: COLOR.mid,
    });

    if (activeTab === 3 && nearby.length > 0) {
      nearby
        .filter((it) => !pickedKeys.has(pickKey(it)))
        .filter((it, i) => i < MAP_MARKER_LIMIT || it.place.id === selectedPlaceId)
        .forEach(({ kind, place }) =>
          list.push({
            id: `${kind}-${place.id}`,
            selectId: place.id,
            lat: place.lat,
            lng: place.lng,
            label: place.name,
            emoji: PIN[kind] ?? '📍',
            color: kind === 'parking' ? '#2563eb' : COLOR.place,
            compact: true,
            selected: selectedPlaceId === place.id,
          })
        );
    }

    if (activeTab === 3 || activeTab === 4) {
      picks.forEach((it) =>
        list.push({
          id: `pick-${pickKey(it)}`,
          selectId: it.place.id,
          lat: it.place.lat,
          lng: it.place.lng,
          label: it.place.name,
          emoji: '⭐',
          color: COLOR.pick,
          compact: false,
          selected: selectedPlaceId === it.place.id,
        })
      );
    }

    return list;
  }, [
    form.participants,
    calcParticipants,
    r,
    selected,
    activeTab,
    nearby,
    picks,
    selectedParticipantId,
    selectedPlaceId,
  ]);

  const runCalculate = useCallback(
    async (ps: Participant[], pickPlan = 0, initialPicks: Item[] = [], targetTab = 2) => {
      setCalculating(true);
      setCalcError('');
      try {
        const { results: res } = await calculateMidpoints(ps);
        setResults(res);
        setCalcParticipants(ps);
        setSelected(Math.min(Math.max(pickPlan, 0), res.length - 1));
        setPicks(initialPicks);
        setSaveTitleInput('');
        setCompleteSavedMsg('');
        setActiveTab(targetTab);
      } catch (e) {
        setCalcError((e as Error).message);
      } finally {
        setCalculating(false);
      }
    },
    []
  );

  runCalculateRef.current = runCalculate;

  const restored = useRef(false);
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    const payload = parseShareParams();
    if (!payload) return;
    const ps: Participant[] = payload.members.map((m, i) => ({
      id: `share-${i}`,
      name: m.n,
      place: { id: `share-${i}`, name: m.o, address: '', lat: m.lat, lng: m.lng },
    }));
    const sharedPicks: Item[] = (payload.picks ?? []).map((p, i) => ({
      kind: p.k,
      place: { id: `share-pick-${i}`, name: p.n, address: p.a, lat: p.lat, lng: p.lng, url: p.u },
    }));
    runCalculate(ps, payload.plan, sharedPicks, 2);
  }, [runCalculate]);

  const startNew = () => {
    form.participants.forEach((p) => form.update(p.id, { name: '', place: null }));
    form.participants.slice(2).forEach((p) => form.remove(p.id));
    setResults([]);
    setCalcParticipants([]);
    setSelected(0);
    setPicks([]);
    setCalcError('');
    setSaveTitleInput('');
    setCompleteSavedMsg('');
    setActiveTab(1);
  };

  const goInput = () => setActiveTab(1);

  const showStepNav = activeTab > 1 && activeTab <= LAST_STEP;
  const canNext = !calculating && !!r;

  const goNext = () => {
    setActiveTab(activeTab + 1);
  };

  const currentTravelInfos = useMemo(() => {
    if (!r) return [];
    return toTravelInfos(r, calcParticipants);
  }, [r, calcParticipants]);

  const planDiffs = useMemo(() => {
    return results.slice(0, 3).map((res) => {
      const infos = toTravelInfos(res, calcParticipants);
      const times = infos
        .map((it: any) => it.timeMinutes ?? it.durationMinutes ?? it.time)
        .filter((t): t is number => typeof t === 'number');
      if (times.length === 0) return null;
      return Math.max(...times) - Math.min(...times);
    });
  }, [results, calcParticipants]);

  // 4단계: 출발지 + 중간지점 + 추천장소 후보까지 통째로 저장
  const handleSaveCompletePromise = (e: React.FormEvent) => {
    e.preventDefault();
    if (!r) return;
    const defaultName = `${r.place.name} 약속`;
    const finalTitle = saveTitleInput.trim() || defaultName;
    const ok = form.saveComplete({
      participants: calcParticipants,
      title: finalTitle,
      planIndex: selected,
      destinationName: r.place.name,
      picks,
    });
    if (ok) {
      setCompleteSavedMsg(`'${finalTitle}'(추천장소 ${picks.length}곳 포함)이 내 저장 목록에 저장되었어요!`);
      setSaveTitleInput('');
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-100/70 font-sans antialiased text-slate-900">
      {/* Header */}
      <div className="mx-auto w-full max-w-7xl px-4 pt-4">
        <header className="flex h-16 items-center justify-between rounded-2xl bg-white px-6 shadow-sm border border-slate-200/80">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2 cursor-pointer" onClick={startNew}>
              <img src="/logo.png" alt="Meetly Logo" className="h-9 w-auto object-contain" />
              <h1 className="text-xl font-black tracking-tight text-slate-900">Meetly</h1>
            </div>

            <nav className="hidden md:flex items-center gap-1.5" aria-label="단계">
              {TABS.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-black transition-all ${
                      isActive
                        ? 'bg-slate-900 text-white shadow-sm scale-105'
                        : 'bg-slate-100/80 text-slate-600 hover:bg-slate-200/70 hover:text-slate-800'
                    }`}
                  >
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-md ${isActive ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-700'}`}>
                      {tab.step}
                    </span>
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </div>

          <button
            type="button"
            onClick={() => setActiveTab(SAVED_TAB)}
            className={`rounded-xl px-4 py-2 text-xs font-bold transition ${
              activeTab === SAVED_TAB
                ? 'bg-emerald-50 font-black text-emerald-700 border border-emerald-200'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            내 저장 목록{form.groups.length > 0 ? ` (${form.groups.length})` : ''}
          </button>
        </header>
      </div>

      {/* Main Layout */}
      <div className="mx-auto flex-1 w-full max-w-7xl px-4 py-4">
        <main className="flex flex-col lg:flex-row h-auto lg:h-[calc(100vh-124px)] w-full gap-5">
          {/* 좌측 패널 (60%) */}
          <section className="w-full lg:w-[58%] xl:w-[60%] shrink-0 overflow-y-auto rounded-2xl bg-white p-6 lg:p-7 shadow-sm border border-slate-200/80 flex flex-col justify-between">
            <div className="space-y-6">
              {showStepNav && (
                <div className="sticky -top-7 z-10 -mx-7 -mt-7 mb-4 flex items-center justify-between border-b border-slate-100 bg-white/95 backdrop-blur px-7 py-3.5">
                  <button
                    type="button"
                    onClick={() => setActiveTab(activeTab - 1)}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
                  >
                    {PREV_LABEL[activeTab] ?? '← 이전'}
                  </button>
                  {activeTab < LAST_STEP && (
                    <button
                      type="button"
                      onClick={goNext}
                      disabled={!canNext}
                      className="rounded-xl bg-primary px-5 py-2 text-sm font-black text-white shadow-sm transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40 active:scale-95"
                    >
                      {NEXT_LABEL[activeTab] ?? '다음 →'}
                    </button>
                  )}
                </div>
              )}

              {/* ① 출발지 입력 */}
              {activeTab === 1 && (
                <div className="space-y-6">
                  <div className="border-b border-slate-100 pb-4">
                    <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-800 border border-emerald-200/70">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-600" /> 공평한 중간 지점 찾기
                    </span>
                    <h2 className="mt-3 text-2xl lg:text-3xl font-black tracking-tight text-slate-900">
                      약속 장소, <span className="text-emerald-600">Meetly</span>로 정하세요
                    </h2>
                    <p className="mt-2 text-sm font-bold text-slate-600 leading-relaxed">
                      각자의 출발지를 입력해 주세요. 예상 이동시간을 비교해 참여자 모두에게 공평한 약속 장소를 추천합니다.
                    </p>
                  </div>
                  <InputForm
                    form={form}
                    calculating={calculating}
                    onCalculate={() => runCalculate(form.participants.filter((p) => p.place))}
                    onParticipantFocus={setSelectedParticipantId}
                    focusedParticipantId={selectedParticipantId}
                  />
                  {calcError && (
                    <p role="alert" className="rounded-xl bg-red-50 border border-red-200 p-3.5 text-sm font-bold text-red-700">
                      ⚠️ {calcError}
                    </p>
                  )}
                </div>
              )}

              {/* ② 중간지점 + 이동시간 */}
              {activeTab === 2 &&
                (r ? (
                  <div className="space-y-6">
                    <div className="rounded-2xl bg-emerald-50/70 border border-emerald-200/80 p-5 sm:p-6 space-y-4">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-black uppercase tracking-wider text-emerald-700">
                          MEETLY 최적 중간지점 추천
                        </p>
                        <span className="text-xs font-extrabold text-emerald-700">
                          총 {results.length}개 추천안
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        {results.slice(0, 3).map((res, idx) => {
                          const isSelected = selected === idx;
                          const rankLabel = idx === 0 ? '1안' : idx === 1 ? '2안' : '3안';
                          const diffMin = planDiffs[idx];

                          return (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => handleSelect(idx)}
                              className={`rounded-2xl p-4 text-left transition-all border ${
                                isSelected
                                  ? 'bg-emerald-600 border-emerald-600 text-white shadow-md scale-[1.01]'
                                  : 'bg-white border-emerald-100 text-slate-900 hover:border-emerald-300 shadow-2xs'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-1.5">
                                <span
                                  className={`inline-flex items-center gap-1 text-[11px] font-black px-2 py-0.5 rounded-full ${
                                    isSelected
                                      ? 'bg-emerald-500/80 text-white'
                                      : 'bg-slate-100 text-slate-600'
                                  }`}
                                >
                                  {idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'} {rankLabel}
                                </span>

                                {idx === 0 && (
                                  <span
                                    className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                                      isSelected
                                        ? 'bg-amber-300 text-slate-900'
                                        : 'bg-amber-100 text-amber-800'
                                    }`}
                                  >
                                    ★ 가장 공평
                                  </span>
                                )}
                              </div>

                              <p
                                className={`mt-2.5 truncate text-lg font-black ${
                                  isSelected ? 'text-white' : 'text-slate-900'
                                }`}
                              >
                                {res.place.name}
                              </p>

                              {diffMin !== null && (
                                <p
                                  className={`mt-1 text-xs font-bold ${
                                    isSelected ? 'text-emerald-100' : 'text-slate-500'
                                  }`}
                                >
                                  {idx === 0
                                    ? `참석자 간 이동시간 차이 최소 ${diffMin}분`
                                    : `이동시간 차이 ${diffMin}분`}
                                </p>
                              )}
                            </button>
                          );
                        })}
                      </div>

                      <div className="pt-1">
                        <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 flex items-center gap-1.5">
                          <span>📍 선택된 만남 장소:</span>
                          <span className="text-emerald-700">{r.place.name}</span>
                        </h2>
                        {(() => {
                          const times = currentTravelInfos
                            .map((it: any) => it.timeMinutes ?? it.durationMinutes ?? it.time)
                            .filter((t): t is number => typeof t === 'number');

                          if (times.length === 0) return null;

                          const avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
                          const diff = Math.max(...times) - Math.min(...times);

                          return (
                            <>
                              <p className="mt-1.5 text-xs font-extrabold text-slate-700">
                                참석자 간 이동시간 평균 {avg}분 · 격차 {diff}분
                              </p>
                              <p className="mt-1 text-[11px] font-medium leading-relaxed text-slate-500">
                                ※ 이동시간은 거리 기반 예상치이며 실제 대중교통 소요시간과 다를 수 있습니다.
                              </p>
                            </>
                          );
                        })()}
                      </div>
                    </div>

                    <div className="rounded-2xl bg-slate-50 p-5 border border-slate-200/80">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-black text-slate-800 flex items-center gap-1.5">
                          <Users className="w-4 h-4 text-emerald-600" /> 참석자별 출발지 & 소요시간
                        </h3>
                        <span className="text-xs font-bold text-slate-600 bg-white px-2.5 py-1 rounded-md border border-slate-200">
                          예상 이동시간
                        </span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                        {currentTravelInfos.map((info: any, idx: number) => {
                          const p = calcParticipants[idx];
                          const displayName =
                            p?.name && p.name.trim() !== ''
                              ? p.name
                              : p?.place?.name
                              ? p.place.name
                              : info.name && !info.name.startsWith('참석자')
                              ? info.name
                              : `참석자 ${idx + 1}`;

                          return (
                            <div
                              key={idx}
                              className="flex items-center justify-between rounded-xl bg-white p-3.5 shadow-2xs border border-slate-200/80"
                            >
                              <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-2">
                                <span
                                  className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold text-white"
                                  style={{ backgroundColor: personColor(idx) }}
                                >
                                  {idx + 1}
                                </span>
                                <span className="text-sm font-extrabold text-slate-800 truncate">
                                  {displayName}
                                </span>
                              </div>
                              <span className="text-sm font-black text-emerald-700 shrink-0">
                                {info.timeMinutes ?? info.durationMinutes ?? info.time}분 소요
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="border border-slate-200 rounded-2xl overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setShowDetails(!showDetails)}
                        className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 transition text-sm font-bold text-slate-700"
                      >
                        <span>📊 세부 이동시간 분포 및 분석 지표 {showDetails ? '접기' : '보기'}</span>
                        {showDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>

                      {showDetails && (
                        <div className="p-4 border-t border-slate-200 bg-white space-y-4">
                          <ResultsPanel
                            results={results}
                            selected={selected}
                            detail={
                              <>
                                <TravelChart travelInfos={currentTravelInfos} />
                                <div className="mt-4 border-t border-slate-100 pt-4">
                                  <b className="text-sm font-bold text-slate-700">개별 출발지에서 길찾기</b>
                                  <div className="mt-2.5 flex flex-wrap gap-2">
                                    {calcParticipants
                                      .filter((p) => p.place)
                                      .map((p, i) => (
                                        <a
                                          key={p.id}
                                          href={routeUrl(
                                            { name: p.place!.name, lat: p.place!.lat, lng: p.place!.lng },
                                            { name: r.place.name, lat: r.place.lat, lng: r.place.lng }
                                          )}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 px-3.5 py-2 text-xs font-bold text-slate-800 transition"
                                        >
                                          <span
                                            className="h-2 w-2 rounded-full"
                                            style={{ background: personColor(i) }}
                                          />
                                          {p.name || `참석자 ${i + 1}`} 길찾기 ↗
                                        </a>
                                      ))}
                                  </div>
                                </div>
                              </>
                            }
                          />
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <EmptyState text="아직 계산한 결과가 없어요. 출발지를 입력하고 계산해 보세요." onGo={goInput} />
                ))}

              {/* ③ 추천 장소 */}
              {activeTab === 3 &&
                (r ? (
                  <div className="space-y-5">
                    <div className="rounded-2xl bg-emerald-50/90 p-4 border border-emerald-200/80 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-5 h-5 text-emerald-600" />
                        <span className="text-base font-black text-emerald-950">중간지점: {r.place.name}</span>
                      </div>
                      <span className="text-xs font-black text-emerald-800 bg-white px-3 py-1 rounded-lg border border-emerald-200/60 shadow-2xs">
                        📍 주변 추천 장소
                      </span>
                    </div>

                    <NearbyPlaces
                      center={r.place}
                      onShownChange={setNearby}
                      picks={picks}
                      onTogglePick={togglePick}
                      selectedPlaceId={selectedPlaceId}
                      onSelectPlace={(id) => setSelectedPlaceId((prev) => (prev === id ? null : id))}
                      travelInfos={currentTravelInfos}
                      participants={calcParticipants}
                    />
                  </div>
                ) : (
                  <EmptyState text="중간지점을 먼저 계산하면 주변 장소를 추천해 드려요." onGo={goInput} />
                ))}

              {/* ④ 약속 후보 공유 */}
              {activeTab === 4 &&
                (r ? (
                  <div className="space-y-5">
                    <div>
                      <h2 className="text-2xl font-black text-slate-900">4 약속 후보 공유</h2>
                      <p className="text-sm font-bold text-slate-600 mt-1">
                        최종 결정된 장소와 후보 목록을 카카오톡이나 공유 링크로 전달하세요.
                      </p>
                    </div>

                    {/* 1. 선택한 약속 후보 목록 */}
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <p className="text-sm font-bold text-slate-800">
                          ⭐ 선택한 약속 후보 <span className="text-emerald-600 font-black">{picks.length}곳</span>
                        </p>
                        <span className="text-xs font-bold text-slate-600">중간지점: {r.place.name}</span>
                      </div>

                      {picks.length === 0 ? (
                        <div className="rounded-xl border-2 border-dashed border-slate-200 p-6 text-center">
                          <p className="text-sm font-bold text-slate-600">아직 담은 장소가 없어요. 3번 탭에서 ☆를 눌러 후보를 담아 보세요.</p>
                          <button
                            type="button"
                            onClick={() => setActiveTab(3)}
                            className="mt-3 inline-flex items-center gap-1 rounded-xl bg-emerald-50 px-4 py-2 text-xs font-black text-emerald-700 border border-emerald-200"
                          >
                            ← 추천 장소 고르러 가기
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {PICK_GROUPS.map((g) => {
                            const group = picks.filter((it) => g.kinds.includes(it.kind));
                            if (group.length === 0) return null;
                            return (
                              <div key={g.title}>
                                <p className="mb-2 text-xs font-bold text-slate-500">{g.title}</p>
                                <ul className="space-y-2">
                                  {group.map((it) => (
                                    <li
                                      key={pickKey(it)}
                                      className="flex items-center gap-3 rounded-xl border border-slate-200 p-3.5 bg-slate-50/50"
                                    >
                                      <button
                                        type="button"
                                        onClick={() => togglePick(it)}
                                        className="shrink-0 text-amber-400 hover:scale-110 transition text-lg"
                                      >
                                        ★
                                      </button>
                                      <div className="min-w-0 flex-1">
                                        <b className="block truncate text-sm font-black text-slate-800">{it.place.name}</b>
                                        <small className="block truncate text-xs text-slate-500">{it.place.address}</small>
                                      </div>
                                      <DirectionsButton place={it.place} />
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* 2. 메인 액션(Primary CTA): 공유 링크 복사 */}
                    <ShareButton
                      payload={{
                        v: 1,
                        plan: selected,
                        members: calcParticipants
                          .filter((p) => p.place)
                          .map((p, i) => ({
                            n: p.name || `참석자 ${i + 1}`,
                            o: p.place!.name,
                            lat: p.place!.lat,
                            lng: p.place!.lng,
                          })),
                        dest: { name: r.place.name, lat: r.place.lat, lng: r.place.lng },
                        picks: picks.map(({ kind, place }) => ({
                          k: kind as PlaceCategory,
                          n: place.name,
                          a: place.address,
                          lat: place.lat,
                          lng: place.lng,
                          u: place.url,
                        })),
                      }}
                    />

                    {/* 3. 서브 액션: 출발지 + 중간지점 + 추천장소 후보 전체 저장하기 */}
                    <form
                      onSubmit={handleSaveCompletePromise}
                      className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5 space-y-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-extrabold text-slate-800 flex items-center gap-1.5">
                            <BookmarkCheck className="w-4 h-4 text-emerald-600" />
                            이 약속 코스 통째로 저장하기
                          </p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            출발지, 선택된 추천안({selected + 1}안 · {r.place.name}), 담은 후보 {picks.length}곳을 &lsquo;내 저장 목록&rsquo;에 함께 보관해요.
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          type="text"
                          value={saveTitleInput}
                          onChange={(e) => setSaveTitleInput(e.target.value)}
                          placeholder={`모임 이름 (비우면 "${r.place.name} 약속")`}
                          className="flex-1 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none"
                        />
                        <button
                          type="submit"
                          className="shrink-0 rounded-xl border border-emerald-600/30 bg-emerald-50 px-4 py-2.5 text-xs font-black text-emerald-800 hover:bg-emerald-100 transition active:scale-95"
                        >
                          내 목록에 저장
                        </button>
                      </div>

                      {completeSavedMsg && (
                        <p className="flex items-center gap-1.5 text-xs font-bold text-emerald-700">
                          <Check className="w-3.5 h-3.5 shrink-0" />
                          <span>{completeSavedMsg}</span>
                        </p>
                      )}
                    </form>

                    {/* 4. 카카오맵 전체 경로 보기 */}
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm flex items-center justify-between">
                      <div>
                        <p className="text-sm font-bold text-slate-800">카카오맵 전체 경로 보기</p>
                        <p className="text-xs text-slate-500">{r.place.name} 기준</p>
                      </div>
                      <DirectionsButton place={r.place} />
                    </div>
                  </div>
                ) : (
                  <EmptyState text="계산 결과가 있어야 공유 링크를 생성할 수 있습니다." onGo={goInput} />
                ))}

              {/* 내 저장 목록 */}
              {activeTab === SAVED_TAB && (
                <SavedGroupsPanel
                  groups={form.groups}
                  onLoad={form.load}
                  onDelete={form.removeGroup}
                  onNew={startNew}
                />
              )}
            </div>
          </section>

          {/* 우측 지도 패널 */}
          <section className={`relative transition-all duration-300 rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden saturate-[0.85] contrast-[0.95] ${
            activeTab === 1
              ? 'h-[280px] lg:h-full lg:flex-1 opacity-90'
              : 'h-[400px] lg:h-full lg:flex-1'
          }`}>
            {activeTab === 3 && (
              <div className="absolute right-3 top-3 z-10 flex items-center gap-1.5 rounded-full border border-slate-200 bg-white/95 px-3.5 py-1.5 text-xs font-semibold text-slate-700 shadow-sm backdrop-blur">
                <span>💡 지도 핀을 누르시면 좌측 장소 정보로 이동합니다</span>
              </div>
            )}
            {activeTab === 4 && (
              <div className="absolute right-3 top-3 z-10 flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50/95 px-3.5 py-1.5 text-xs font-semibold text-amber-900 shadow-sm backdrop-blur">
                <span>⭐ 선택한 약속 후보 장소가 표시됩니다</span>
              </div>
            )}

            {/* Kakao Map 실시간 연동 중 라이브 뱃지 */}
            {activeTab === 3 && (
              <div className="absolute bottom-3 right-3 z-10 flex items-center gap-1.5 rounded-full border border-slate-200/80 bg-white/90 px-3 py-1 text-[11px] font-bold text-slate-700 shadow-sm backdrop-blur-sm">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
                </span>
                <span>Kakao Map 실시간 연동 중</span>
              </div>
            )}

            <KakaoMap
              markers={markers}
              zoomOnSelect={activeTab === 3}
              selectedMarkerId={
                activeTab === 1 && selectedParticipantId
                  ? `start-${selectedParticipantId}`
                  : selectedPlaceId
              }
              onMarkerClick={(id) => {
                if (activeTab === 1) {
                  setSelectedParticipantId(id);
                } else if (activeTab === 3) {
                  setSelectedPlaceId((prev) => (prev === id ? null : id));
                }
              }}
            />
          </section>
        </main>
      </div>

      <Footer />
    </div>
  );
}