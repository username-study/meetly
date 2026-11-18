import type { Participant, SavedGroup } from "./types";

/**
 * 로컬스토리지 저장/불러오기 (회원가입 없는 서비스용).
 * - SSR(서버)·사생활 보호 모드처럼 localStorage 를 못 쓰는 환경에서도 예외 없이 동작
 * - 깨진 JSON / 구버전 데이터는 무시하고 빈 목록으로 복구
 */
const GROUPS_KEY = "meetly:v1:groups";
const DRAFT_KEY = "meetly:v1:draft";
export const MAX_SAVED_GROUPS = 10;

function read<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): boolean {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false; // 용량 초과 / 저장 차단
  }
}

const isPlace = (p: unknown) => {
  const o = p as Record<string, unknown> | null;
  return !!o && typeof o.name === "string" && Number.isFinite(o.lat) && Number.isFinite(o.lng);
};

/** 저장된 참석자 배열이 형식에 맞는지 검증하고, 맞는 것만 남긴다 */
export function sanitizeParticipants(value: unknown): Participant[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((p): p is Participant => !!p && typeof p.id === "string" && typeof p.name === "string")
    .map((p) => ({ id: p.id, name: p.name.slice(0, 20), place: isPlace(p.place) ? p.place : null }));
}

export function listGroups(): SavedGroup[] {
  const data = read<SavedGroup[]>(GROUPS_KEY);
  if (!Array.isArray(data)) return [];
  return data
    .filter((g) => g && typeof g.id === "string" && typeof g.savedAt === "string")
    .map((g) => ({ ...g, title: String(g.title ?? "이름 없는 모임"), participants: sanitizeParticipants(g.participants) }))
    .filter((g) => g.participants.length > 0);
}

/** 현재 입력을 '최근 모임' 으로 저장. 최신순, 최대 10개 유지. 성공 여부 반환 */
export function saveGroup(participants: Participant[], title?: string): boolean {
  const filled = participants.filter((p) => p.name.trim() || p.place);
  if (filled.length === 0) return false;
  const group: SavedGroup = {
    id: `${Date.now()}`,
    title: title?.trim() || defaultTitle(filled),
    savedAt: new Date().toISOString(),
    participants: filled,
  };
  return write(GROUPS_KEY, [group, ...listGroups()].slice(0, MAX_SAVED_GROUPS));
}

export function deleteGroup(id: string): boolean {
  return write(GROUPS_KEY, listGroups().filter((g) => g.id !== id));
}

function defaultTitle(ps: Participant[]): string {
  const names = ps.map((p) => p.name.trim()).filter(Boolean);
  return names.length ? names.slice(0, 3).join(", ") + (names.length > 3 ? ` 외 ${names.length - 3}명` : "") : "이름 없는 모임";
}

/** 새로고침해도 입력이 날아가지 않도록 자동 보관하는 임시 입력 */
export function loadDraft(): Participant[] | null {
  const d = sanitizeParticipants(read<unknown>(DRAFT_KEY));
  return d.length ? d : null;
}
export function saveDraft(participants: Participant[]): void {
  write(DRAFT_KEY, participants);
}
