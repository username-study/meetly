"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  deleteGroup,
  listGroups,
  loadDraft,
  saveCompleteGroup,
  saveDraft,
  saveGroup,
  type ExtendedSavedGroup,
  type SavedPickItem,
} from "./storage";
import type { Participant } from "./types";

export const MIN_PARTICIPANTS = 2;
export const MAX_PARTICIPANTS = 8;

const newId = () => Math.random().toString(36).slice(2, 10);
const initialParticipant = (n: number): Participant => ({ id: `init-${n}`, name: "", place: null });
const emptyParticipant = (): Participant => ({ id: newId(), name: "", place: null });

export interface Status {
  type: "info" | "ok" | "warn";
  text: string;
}

export function useMeetlyForm(options: { onLoaded?: (group?: ExtendedSavedGroup) => void } = {}) {
  const [participants, setParticipants] = useState<Participant[]>(() => [initialParticipant(1), initialParticipant(2)]);
  const [hydrated, setHydrated] = useState(false);
  const [groups, setGroups] = useState<ExtendedSavedGroup[]>([]);
  const [status, setStatus] = useState<Status>({ type: "info", text: "입력 내용은 이 브라우저에 자동으로 임시 저장됩니다." });
  const timer = useRef<number | undefined>(undefined);
  const onLoaded = useRef(options.onLoaded);
  onLoaded.current = options.onLoaded;

  useEffect(() => {
    const draft = loadDraft();
    if (draft) setParticipants(draft);
    setGroups(listGroups());
    setHydrated(true);
  }, []);

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

  const save = (customTitle?: string) => {
    const ok = saveGroup(participants, customTitle);
    if (!ok) return flash("warn", "저장할 내용이 없거나 브라우저에서 저장이 차단되어 있어요.");
    const updated = listGroups();
    setGroups(updated);
    const savedTitle = updated[0]?.title ?? customTitle ?? "새 모임";
    flash("ok", `'${savedTitle}' 임시저장 완료! [최근 저장 불러오기]나 '내 저장 목록'에서 다시 쓸 수 있어요.`);
  };

  /** 4단계 완성된 약속(출발지 + 추천안 + 담은 후보 장소) 저장 */
  const saveComplete = (params: {
    participants: Participant[];
    title?: string;
    planIndex: number;
    destinationName: string;
    picks: SavedPickItem[];
  }) => {
    const ok = saveCompleteGroup(params);
    if (!ok) return false;
    setGroups(listGroups());
    return true;
  };

  const load = (g: ExtendedSavedGroup) => {
    const restoredParticipants = g.participants.map((p) => ({ ...p, id: newId() }));
    setParticipants(restoredParticipants);
    onLoaded.current?.({ ...g, participants: restoredParticipants });
    flash("ok", `'${g.title}' 모임을 불러왔어요.`);
  };

  const loadLatest = () => {
    const latest = listGroups()[0];
    if (!latest) return flash("warn", "저장된 모임이 없어요. 출발지를 입력하고 [임시저장]을 눌러 보세요.");
    load(latest);
  };

  const reset = () => {
    setParticipants([emptyParticipant(), emptyParticipant()]);
    flash("info", "입력을 초기화했어요. 저장된 모임은 그대로 남아 있어요.");
  };

  const fillExample = (examples: Omit<Participant, "id">[]) => {
    setParticipants(examples.map((e) => ({ id: newId(), ...e })));
    flash("ok", "예시를 채웠어요. [최적 장소 계산하기]를 눌러 보세요!");
  };

  const removeGroup = (id: string) => {
    deleteGroup(id);
    setGroups(listGroups());
  };

  const refreshGroups = () => setGroups(listGroups());

  return {
    participants, groups, status, readyCount, canCalculate,
    update, add, remove, reset, save, saveComplete, load, loadLatest, removeGroup, fillExample, refreshGroups, flash,
  };
}

export type MeetlyForm = ReturnType<typeof useMeetlyForm>;