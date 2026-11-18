"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { deleteGroup, listGroups, loadDraft, saveDraft, saveGroup } from "./storage";
import type { Participant, SavedGroup } from "./types";

export const MIN_PARTICIPANTS = 2;
export const MAX_PARTICIPANTS = 8;

// 클릭/이벤트 시점에만 호출되는 id 생성 (렌더 중에는 쓰지 않는다)
const newId = () => Math.random().toString(36).slice(2, 10);

// 초기 상태용: 서버/브라우저 모두 같은 값이 나오도록 고정 id
const initialParticipant = (n: number): Participant => ({ id: `init-${n}`, name: "", place: null });

// 이벤트 핸들러(참석자 추가 등)에서 쓰는 빈 참가자
const emptyParticipant = (): Participant => ({ id: newId(), name: "", place: null });

export interface Status {
  type: "info" | "ok" | "warn";
  text: string;
}

/**
 * 입력 폼의 모든 상태/동작
 * 참석자 목록, 로컬스토리지 임시저장·저장 목록, 안내 문구를 한 곳에서 관리하고
 * page.tsx 는 이 훅의 반환값을 InputForm / SavedGroupsPanel / MapPreview 에 나눠 준다.
 */
export function useMeetlyForm(options: { onLoaded?: () => void } = {}) {
  const [participants, setParticipants] = useState<Participant[]>(() => [initialParticipant(1), initialParticipant(2)]);
  const [hydrated, setHydrated] = useState(false);
  const [groups, setGroups] = useState<SavedGroup[]>([]);
  const [status, setStatus] = useState<Status>({ type: "info", text: "입력 내용은 이 브라우저에 자동으로 임시 저장됩니다." });
  const timer = useRef<number | undefined>(undefined);
  const onLoaded = useRef(options.onLoaded);
  onLoaded.current = options.onLoaded;

  // 첫 렌더 뒤 로컬스토리지의 임시 입력/저장 목록 복원 (SSR 불일치 방지)
  useEffect(() => {
    const draft = loadDraft();
    if (draft) setParticipants(draft);
    setGroups(listGroups());
    setHydrated(true);
  }, []);

  // 입력이 바뀔 때마다 임시 입력 자동 보관
  useEffect(() => {
    if (hydrated) saveDraft(participants);
  }, [participants, hydrated]);

  const readyCount = useMemo(() => participants.filter((p) => p.place).length, [participants]);
  const canCalculate = readyCount >= MIN_PARTICIPANTS;

  const flash = useCallback((type: Status["type"], text: string) => {
    setStatus({ type, text });
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(
      () => setStatus({ type: "info", text: "입력 내용은 이 브라우저에 자동으로 임시 저장됩니다." }),
      4000,
    );
  }, []);

  const update = useCallback(
    (id: string, patch: Partial<Participant>) =>
      setParticipants((ps) => ps.map((p) => (p.id === id ? { ...p, ...patch } : p))),
    [],
  );

  const add = () => {
    if (participants.length >= MAX_PARTICIPANTS) {
      return flash("warn", `참석자는 최대 ${MAX_PARTICIPANTS}명까지 추가할 수 있어요.`);
    }
    setParticipants((ps) => [...ps, emptyParticipant()]);
  };

  const remove = (id: string) =>
    setParticipants((ps) => (ps.length <= MIN_PARTICIPANTS ? ps : ps.filter((p) => p.id !== id)));

  const save = () => {
    if (!saveGroup(participants)) return flash("warn", "저장할 내용이 없거나 브라우저에서 저장이 차단되어 있어요.");
    setGroups(listGroups());
    flash("ok", "임시저장 완료! [최근 저장 불러오기]나 '내 저장 목록'에서 다시 쓸 수 있어요.");
  };

  const load = (g: SavedGroup) => {
    // id 를 새로 부여해 같은 모임을 여러 번 불러와도 key 충돌이 없게 한다
    setParticipants(g.participants.map((p) => ({ ...p, id: newId() })));
    onLoaded.current?.();
    flash("ok", `'${g.title}' 모임을 불러왔어요.`);
  };

  /** [최근 저장 불러오기]: 가장 최근에 저장한 모임 */
  const loadLatest = () => {
    const latest = listGroups()[0];
    if (!latest) return flash("warn", "저장된 모임이 없어요. 출발지를 입력하고 [임시저장]을 눌러 보세요.");
    load(latest);
  };

  /** [초기화]: 입력을 처음 상태(빈 참석자 2명)로 되돌린다. 저장 목록은 건드리지 않는다 */
  const reset = () => {
    setParticipants([emptyParticipant(), emptyParticipant()]);
    flash("info", "입력을 초기화했어요. 저장된 모임은 그대로 남아 있어요.");
  };

  const removeGroup = (id: string) => {
    deleteGroup(id);
    setGroups(listGroups());
  };

  const refreshGroups = () => setGroups(listGroups());

  return {
    participants, groups, status, readyCount, canCalculate,
    update, add, remove, reset, save, load, loadLatest, removeGroup, refreshGroups, flash,
  };
}

export type MeetlyForm = ReturnType<typeof useMeetlyForm>;