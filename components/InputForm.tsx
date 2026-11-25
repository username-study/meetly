'use client';

import React, { useState } from 'react';
import type { useMeetlyForm } from '@/lib/useMeetlyForm';
import type { Participant, Place } from '@/lib/types';
import { searchPlaces } from '@/lib/api';

type MeetlyFormType = ReturnType<typeof useMeetlyForm>;

interface InputFormProps {
  form: MeetlyFormType;
  calculating: boolean;
  onCalculate: () => void;
  onParticipantFocus?: (id: string) => void;
  focusedParticipantId?: string | null;
}

const MAX_PARTICIPANTS = 8;

// 참석자별 고유 배지 색상 (지도 핀 및 범례와 통일)
const BADGE_COLORS = [
  '#2f6fed', // 1: 파랑
  '#ef4444', // 2: 빨강
  '#10b981', // 3: 초록
  '#f59e0b', // 4: 주황
  '#8b5cf6', // 5: 보라
  '#ec4899', // 6: 핑크
  '#06b6d4', // 7: 청록
  '#64748b', // 8: 슬레이트
];

export function InputForm({
  form,
  calculating,
  onCalculate,
  onParticipantFocus,
  focusedParticipantId,
}: InputFormProps) {
  const [activeSearchId, setActiveSearchId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Place[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [loadingExample, setLoadingExample] = useState(false);

  // 임시저장 모달 상태
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [groupTitle, setGroupTitle] = useState('');

  const currentCount = form.participants.length;
  const isMax = currentCount >= MAX_PARTICIPANTS;
  const validCount = form.participants.filter((p: Participant) => p.place).length;
  const canCalculate = validCount >= 2 && !calculating;

  // 기본 모임 이름 자동 생성 (예: "신촌역 2호선 외 1명 모임")
  const buildDefaultTitle = () => {
    const filled = form.participants.filter((p) => p.place || p.name.trim());
    const firstPlace = filled.find((p) => p.place)?.place?.name;
    const firstName = filled.find((p) => p.name.trim())?.name.trim();
    const baseLabel = firstPlace || firstName;

    if (!baseLabel) return '새 모임';
    if (filled.length <= 1) return `${baseLabel} 모임`;
    return `${baseLabel} 외 ${filled.length - 1}명 모임`;
  };

  // 임시저장 버튼 클릭 -> 모달 열기
  const handleOpenSaveModal = () => {
    const hasAnyData = form.participants.some((p) => p.name.trim() || p.place);
    if (!hasAnyData) {
      form.flash('warn', '저장할 참석자나 출발지를 먼저 입력해 주세요.');
      return;
    }
    setGroupTitle('');
    setIsSaveModalOpen(true);
  };

  // 모달에서 최종 저장 실행
  const handleConfirmSave = (e: React.FormEvent) => {
    e.preventDefault();
    const finalTitle = groupTitle.trim() || buildDefaultTitle();
    form.save(finalTitle);
    setIsSaveModalOpen(false);
    setGroupTitle('');
  };

  // 초기화: 입력한 내용이 있으면 한 번 확인
  const hasInput = form.participants.some((p: Participant) => p.name.trim() || p.place);
  const handleReset = () => {
    if (hasInput && !window.confirm('입력한 출발지를 모두 지울까요?\n(저장된 모임은 지워지지 않아요)')) return;
    form.reset();
    setActiveSearchId(null);
    setQuery('');
    setSearchResults([]);
  };

  // 예시로 체험하기: 신촌역 + 강남역을 검색해서 채움
  const pick = (places: Place[] | undefined, keyword: string) =>
    places?.find((p) => p.name.startsWith(keyword)) ?? places?.[0];

  const handleExample = async () => {
    setLoadingExample(true);
    try {
      const [a, b] = await Promise.all([searchPlaces('신촌역'), searchPlaces('강남역')]);
      const p1 = pick(a.places, '신촌역');
      const p2 = pick(b.places, '강남역');
      if (!p1 || !p2) {
        form.flash('warn', '예시를 불러오지 못했어요. 직접 입력해 주세요.');
        return;
      }
      form.fillExample([
        { name: '김ㅇㅇ', place: p1 },
        { name: '정ㅇㅇ', place: p2 },
      ]);
      setActiveSearchId(null);
      setQuery('');
      setSearchResults([]);
    } catch {
      form.flash('warn', '예시를 불러오지 못했어요. 직접 입력해 주세요.');
    } finally {
      setLoadingExample(false);
    }
  };

  // 장소 검색 핸들러
  const handleSearch = async (participantId: string, keyword: string) => {
    setQuery(keyword);
    if (!keyword.trim()) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const res = await searchPlaces(keyword);
      setSearchResults(res.places || []);
    } catch {
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // 장소 선택
  const handleSelectPlace = (participantId: string, place: Place) => {
    form.update(participantId, { place });
    setActiveSearchId(null);
    setQuery('');
    setSearchResults([]);
  };

  return (
    <div className="space-y-3.5">
      <button
        type="button"
        onClick={handleExample}
        disabled={loadingExample || calculating}
        className="w-full rounded-xl border border-primary/30 bg-pale py-3 text-sm font-bold text-primary hover:bg-primary/10 transition disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {loadingExample ? '예시 불러오는 중…' : '✨ 예시로 체험하기 (신촌역 · 강남역)'}
      </button>

      {/* 참석자 인원 제한 안내 뱃지 */}
      <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3.5 py-2.5 border border-slate-200/60">
        <span className="text-xs font-bold text-slate-700">👥 참석자 출발지</span>
        <div className="flex items-center gap-2.5">
          <span className="text-xs font-extrabold text-primary bg-pale px-2.5 py-0.5 rounded-full border border-primary/20">
            최대 {MAX_PARTICIPANTS}명 ({currentCount}/{MAX_PARTICIPANTS})
          </span>
          <button
            type="button"
            onClick={handleReset}
            className="text-xs font-bold text-slate-400 hover:text-red-500 transition"
          >
            ↺ 초기화
          </button>
        </div>
      </div>

      <div className="space-y-2.5">
        {form.participants.map((p: Participant, index: number) => {
          const isSearchingThis = activeSearchId === p.id;
          const badgeColor = BADGE_COLORS[index % BADGE_COLORS.length];

          return (
            <div
              key={p.id}
              onClick={(event) => {
                const target = event.target as HTMLElement;
                if (target.closest('button, input')) return;
                if (p.place) {
                  onParticipantFocus?.(p.id);
                }
              }}
              className={`relative rounded-xl border p-3 shadow-2xs space-y-2.5 transition-all duration-200 ${
                focusedParticipantId === p.id
                  ? 'border-primary bg-blue-50/80 ring-2 ring-primary/20 shadow-md'
                  : 'border-slate-200/80 bg-white hover:border-blue-200'
              } ${p.place ? 'cursor-pointer' : ''}`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  {/* 참석자 고유 색상 + 숫자 배지 */}
                  <span
                    style={{ backgroundColor: badgeColor }}
                    className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-extrabold text-white shadow-2xs"
                    aria-label={`${index + 1}번 참석자`}
                  >
                    {index + 1}
                  </span>
                  <input
                    type="text"
                    placeholder={`참석자 ${index + 1} 이름`}
                    value={p.name}
                    onChange={(e) => form.update(p.id, { name: e.target.value })}
                    className="w-full max-w-[160px] text-sm font-bold text-slate-800 placeholder:text-slate-300 focus:outline-none"
                  />
                </div>
                {currentCount > 2 && (
                  <button
                    type="button"
                    onClick={() => form.remove(p.id)}
                    className="text-xs text-slate-400 hover:text-red-500 font-semibold"
                  >
                    삭제
                  </button>
                )}
              </div>

              {/* 출발지 선택 & 검색 영역 */}
              <div>
                {p.place ? (
                  <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2.5 border border-slate-200/60">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-slate-800">{p.place.name}</p>
                      <p className="truncate text-xs text-slate-400 mt-0.5">{p.place.address}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        form.update(p.id, { place: null });
                        setActiveSearchId(p.id);
                        setQuery('');
                        setSearchResults([]);
                      }}
                      className="ml-2.5 shrink-0 text-xs font-bold text-primary hover:underline"
                    >
                      변경
                    </button>
                  </div>
                ) : isSearchingThis ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        autoFocus
                        placeholder="역명, 지하철역, 장소 검색 (예: 강남역)"
                        value={query}
                        onChange={(e) => handleSearch(p.id, e.target.value)}
                        className="w-full rounded-lg border border-primary/50 bg-slate-50 px-3 py-2 text-sm focus:bg-white focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setActiveSearchId(null)}
                        className="shrink-0 text-xs font-bold text-slate-400 hover:text-slate-600 px-1.5"
                      >
                        취소
                      </button>
                    </div>

                    {/* 검색 결과 드롭다운 */}
                    {isSearching ? (
                      <p className="text-xs text-slate-400 py-1.5 text-center">검색 중…</p>
                    ) : searchResults.length > 0 ? (
                      <ul className="max-h-40 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-md divide-y divide-slate-100">
                        {searchResults.map((place) => (
                          <li key={place.id}>
                            <button
                              type="button"
                              onClick={() => handleSelectPlace(p.id, place)}
                              className="w-full px-3 py-2 text-left hover:bg-slate-50 transition"
                            >
                              <p className="text-sm font-bold text-slate-800 truncate">{place.name}</p>
                              <p className="text-xs text-slate-400 truncate">{place.address}</p>
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : query.trim() !== '' ? (
                      <p className="text-xs text-slate-400 py-1.5 text-center">검색 결과가 없습니다.</p>
                    ) : null}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveSearchId(p.id);
                      setQuery('');
                      setSearchResults([]);
                    }}
                    className="w-full flex items-center gap-2 rounded-lg border border-dashed border-amber-300 bg-amber-50/50 px-3 py-2.5 text-left hover:bg-amber-100/50 transition cursor-pointer"
                  >
                    <span className="text-sm">📍</span>
                    <span className="text-xs font-bold text-amber-700">
                      출발지를 검색해 주세요 (클릭)
                    </span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => !isMax && form.add()}
        disabled={isMax}
        className="w-full rounded-xl border border-dashed border-slate-300 py-2.5 text-sm font-bold text-slate-600 hover:border-primary hover:text-primary transition disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {isMax ? '최대 인원에 도달했습니다 (8명)' : `+ 참석자 추가 (${currentCount}/${MAX_PARTICIPANTS})`}
      </button>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={handleOpenSaveModal}
          className="rounded-xl bg-slate-100 py-3 text-sm font-bold text-slate-700 hover:bg-slate-200 transition"
        >
          임시저장
        </button>
        <button
          type="button"
          onClick={form.loadLatest}
          className="rounded-xl bg-slate-100 py-3 text-sm font-bold text-slate-700 hover:bg-slate-200 transition"
        >
          최근 저장 불러오기
        </button>
      </div>

      <button
        type="button"
        onClick={onCalculate}
        disabled={!canCalculate}
        className="w-full rounded-xl bg-primary py-3.5 text-sm font-bold text-white shadow-xs hover:bg-primary/90 transition disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {calculating ? '최적 장소 계산 중…' : '🔎 최적 장소 계산하기 →'}
      </button>

      <p
        className={`text-xs leading-relaxed ${
          form.status.type === 'ok'
            ? 'text-emerald-600'
            : form.status.type === 'warn'
            ? 'text-amber-600'
            : 'text-slate-400'
        }`}
      >
        {form.status.text}
      </p>

      {/* 임시저장 모임 이름 입력 모달 */}
      {isSaveModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 backdrop-blur-[1px]"
          onClick={() => setIsSaveModalOpen(false)}
        >
          <form
            onSubmit={handleConfirmSave}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-xl space-y-4"
          >
            <div className="space-y-1">
              <h3 className="text-base font-extrabold text-slate-900">모임 임시저장</h3>
              <p className="text-xs text-slate-500">
                나중에 구분하기 쉽도록 모임 이름을 입력해 주세요. (선택)
              </p>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="meetly-group-title" className="block text-xs font-bold text-slate-700">
                모임 이름
              </label>
              <input
                id="meetly-group-title"
                type="text"
                autoFocus
                placeholder={`예) ${buildDefaultTitle()}`}
                value={groupTitle}
                onChange={(e) => setGroupTitle(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:border-primary focus:bg-white focus:outline-none"
              />
              <p className="text-xs text-slate-400">
                비워두면 &lsquo;{buildDefaultTitle()}&rsquo;(으)로 자동 저장됩니다.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsSaveModalOpen(false)}
                className="rounded-xl bg-slate-100 px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-200 transition"
              >
                취소
              </button>
              <button
                type="submit"
                className="rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-white hover:bg-primary/90 transition"
              >
                저장하기
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}