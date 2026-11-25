import type { Participant, Place, PlaceCategory, SavedGroup } from "./types";

/**
 * 로컬스토리지 저장/불러오기 (회원가입 없는 서비스용).
 * - SSR(서버)·사생활 보호 모드처럼 localStorage 를 못 쓰는 환경에서도 예외 없이 동작
 * - 깨진 JSON / 구버전 데이터는 무시하고 빈 목록으로 복구
 */
const GROUPS_KEY = "meetly:v1:groups";
const DRAFT_KEY = "meetly:v1:draft";
export const MAX_SAVED_GROUPS = 10;

export interface SavedPickItem {
  kind: PlaceCategory | "parking";
  place: Place;
}

export interface ExtendedSavedGroup extends SavedGroup {
  planIndex?: number;
  destinationName?: string;
  picks?: SavedPickItem[];
}

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

export function listGroups(): ExtendedSavedGroup[] {
  const data = read<ExtendedSavedGroup[]>(GROUPS_KEY);
  if (!Array.isArray(data)) return [];
  return data
    .filter((g) => g && typeof g.id === "string" && typeof g.savedAt === "string")
    .map((g) => ({
      ...g,
      title: String(g.title ?? "이름 없는 모임"),
      participants: sanitizeParticipants(g.participants),
      planIndex: typeof g.planIndex === "number" ? g.planIndex : undefined,
      destinationName: typeof g.destinationName === "string" ? g.destinationName : undefined,
      picks: Array.isArray(g.picks) ? g.picks.filter((it) => it && isPlace(it.place)) : undefined,
    }))
    .filter((g) => g.participants.length > 0);
}

/** 1단계: 현재 출발지 입력을 '최근 모임' 으로 저장. 최신순, 최대 10개 유지 */
export function saveGroup(participants: Participant[], title?: string): boolean {
  const filled = participants.filter((p) => p.name.trim() || p.place);
  if (filled.length === 0) return false;
  const group: ExtendedSavedGroup = {
    id: `${Date.now()}`,
    title: title?.trim() || defaultTitle(filled),
    savedAt: new Date().toISOString(),
    participants: filled,
  };
  return write(GROUPS_KEY, [group, ...listGroups()].slice(0, MAX_SAVED_GROUPS));
}

/** 4단계: 출발지 + 선택된 추천안 + 담은 후보 장소까지 완성된 약속 세트를 저장 */
export function saveCompleteGroup(params: {
  participants: Participant[];
  title?: string;
  planIndex: number;
  destinationName: string;
  picks: SavedPickItem[];
}): boolean {
  const filled = params.participants.filter((p) => p.name.trim() || p.place);
  if (filled.length === 0) return false;

  const fallbackTitle = params.destinationName ? `${params.destinationName} 약속` : defaultTitle(filled);
  const group: ExtendedSavedGroup = {
    id: `${Date.now()}`,
    title: params.title?.trim() || fallbackTitle,
    savedAt: new Date().toISOString(),
    participants: filled,
    planIndex: params.planIndex,
    destinationName: params.destinationName,
    picks: params.picks,
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