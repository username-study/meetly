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

  const currentCount = form.participants.length;
  const isMax = currentCount >= MAX_PARTICIPANTS;
  const validCount = form.participants.filter((p: Participant) => p.place).length;
  const canCalculate = validCount >= 2 && !calculating;

  // 초기화: 입력한 내용이 있으면 한 번 확인
  const hasInput = form.participants.some((p: Participant) => p.name.trim() || p.place);
  const handleReset = () => {
    if (hasInput && !window.confirm('입력한 출발지를 모두 지울까요?\n(저장된 모임은 지워지지 않아요)')) return;
    form.reset();
    setActiveSearchId(null);
    setQuery('');
    setSearchResults([]);
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
    <div className="space-y-3">
      {/* 참석자 인원 제한 안내 뱃지 */}
      <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 border border-slate-200/60">
        <span className="text-[11px] font-bold text-slate-700">👥 참석자 출발지</span>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-extrabold text-primary bg-pale px-2 py-0.5 rounded-full border border-primary/20">
            최대 {MAX_PARTICIPANTS}명 ({currentCount}/{MAX_PARTICIPANTS})
          </span>
          <button
            type="button"
            onClick={handleReset}
            className="text-[11px] font-bold text-slate-400 hover:text-red-500 transition"
          >
            ↺ 초기화
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {form.participants.map((p: Participant, index: number) => {
          const isSearchingThis = activeSearchId === p.id;

          return (

<div
  key={p.id}
  onClick={(event) => {
    const target = event.target as HTMLElement;

    // 입력창이나 버튼을 누른 경우에는 카드 선택 처리하지 않음
    if (target.closest('button, input')) return;

    if (p.place) {
      onParticipantFocus?.(p.id);
    }
  }}
  className={`relative rounded-xl border p-2.5 shadow-2xs space-y-2 transition-all duration-200 ${
    focusedParticipantId === p.id
      ? 'border-primary bg-blue-50/80 ring-2 ring-primary/20 shadow-md'
      : 'border-slate-200/80 bg-white hover:border-blue-200'
  } ${p.place ? 'cursor-pointer' : ''}`}
>

              <div className="flex items-center justify-between gap-2">
                <input
                  type="text"
                  placeholder={`참석자 ${index + 1} 이름`}
                  value={p.name}
                  onChange={(e) => form.update(p.id, { name: e.target.value })}
                  className="w-28 text-xs font-bold text-slate-800 placeholder:text-slate-300 focus:outline-none"
                />
                {currentCount > 2 && (
                  <button
                    type="button"
                    onClick={() => form.remove(p.id)}
                    className="text-[11px] text-slate-400 hover:text-red-500 font-semibold"
                  >
                    삭제
                  </button>
                )}
              </div>

              {/* 출발지 선택 & 검색 영역 수정 */}
              <div className="text-xs">
                {p.place ? (
                  <div className="flex items-center justify-between rounded-lg bg-slate-50 p-2 border border-slate-200/60">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-bold text-slate-800">{p.place.name}</p>
                      <p className="truncate text-[10px] text-slate-400">{p.place.address}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        form.update(p.id, { place: null });
                        setActiveSearchId(p.id);
                        setQuery('');
                        setSearchResults([]);
                      }}
                      className="ml-2 text-[10px] font-bold text-primary hover:underline"
                    >
                      변경
                    </button>
                  </div>
                ) : isSearchingThis ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        autoFocus
                        placeholder="역명, 지하철역, 장소 검색 (예: 강남역)"
                        value={query}
                        onChange={(e) => handleSearch(p.id, e.target.value)}
                        className="w-full rounded-lg border border-primary/50 bg-slate-50 px-2.5 py-1.5 text-xs focus:bg-white focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setActiveSearchId(null)}
                        className="shrink-0 text-[10px] font-bold text-slate-400 hover:text-slate-600 px-1"
                      >
                        취소
                      </button>
                    </div>

                    {/* 검색 결과 드롭다운 */}
                    {isSearching ? (
                      <p className="text-[10px] text-slate-400 py-1 text-center">검색 중…</p>
                    ) : searchResults.length > 0 ? (
                      <ul className="max-h-36 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-md divide-y divide-slate-100">
                        {searchResults.map((place) => (
                          <li key={place.id}>
                            <button
                              type="button"
                              onClick={() => handleSelectPlace(p.id, place)}
                              className="w-full px-2.5 py-1.5 text-left hover:bg-slate-50 transition"
                            >
                              <p className="text-xs font-bold text-slate-800 truncate">{place.name}</p>
                              <p className="text-[10px] text-slate-400 truncate">{place.address}</p>
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : query.trim() !== '' ? (
                      <p className="text-[10px] text-slate-400 py-1 text-center">검색 결과가 없습니다.</p>
                    ) : null}
                  </div>
                ) : (
                  /* 클릭 가능한 버튼으로 변경하여 사용자가 클릭 시 바로 검색창이 열리도록 수정 */
                  <button
                    type="button"
                    onClick={() => {
                      setActiveSearchId(p.id);
                      setQuery('');
                      setSearchResults([]);
                    }}
                    className="w-full flex items-center gap-1.5 rounded-lg border border-dashed border-amber-300 bg-amber-50/50 p-2 text-left hover:bg-amber-100/50 transition cursor-pointer"
                  >
                    <span className="text-sm">📍</span>
                    <span className="text-[11px] font-bold text-amber-700">
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
        className="w-full rounded-xl border border-dashed border-slate-300 py-2 text-xs font-bold text-slate-600 hover:border-primary hover:text-primary transition disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {isMax ? '최대 인원에 도달했습니다 (8명)' : `+ 참석자 추가 (${currentCount}/${MAX_PARTICIPANTS})`}
      </button>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={form.save}
          className="rounded-xl bg-slate-100 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-200 transition"
        >
          임시저장
        </button>
        <button
          type="button"
          onClick={form.loadLatest}
          className="rounded-xl bg-slate-100 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-200 transition"
        >
          최근 저장 불러오기
        </button>
      </div>

      <button
        type="button"
        onClick={onCalculate}
        disabled={!canCalculate}
        className="w-full rounded-xl bg-primary py-3 text-xs font-bold text-white shadow-xs hover:bg-primary/90 transition disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {calculating ? '최적 장소 계산 중…' : '🔎 최적 장소 계산하기 →'}
      </button>

      <p
        className={`text-[11px] leading-relaxed ${
          form.status.type === 'ok'
            ? 'text-emerald-600'
            : form.status.type === 'warn'
            ? 'text-amber-600'
            : 'text-slate-400'
        }`}
      >
        {form.status.text}
      </p>
    </div>
  );
}