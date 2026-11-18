"use client";

import type { SavedGroup } from "@/lib/types";

interface Props {
  groups: SavedGroup[];
  onLoad: (group: SavedGroup) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
}

const fmt = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
};

/** '내 저장 목록' 화면: 저장한 모임 카드 + 불러오기/삭제 */
export function SavedGroupsPanel({ groups, onLoad, onDelete, onNew }: Props) {
  return (
    <section aria-label="내 저장 목록" className="rounded-[18px] border border-line bg-white p-4 shadow-card sm:p-[22px]">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">🔖 내 저장 목록</h2>
          <p className="mt-1.5 text-[13px] text-muted">임시저장하거나 저장한 모임을 다시 불러올 수 있어요.</p>
        </div>
        <button type="button" onClick={onNew} className="rounded-[10px] bg-[#f1f5fb] px-3.5 py-[11px] font-bold text-[#52627b] hover:bg-pale">
          ＋ 새 모임 만들기
        </button>
      </div>

      {groups.length === 0 ? (
        <p className="rounded-[10px] bg-[#f2f7ff] p-3 text-xs text-[#52709f]">
          아직 저장된 모임이 없습니다. 메인 화면에서 출발지를 입력하고 [임시저장]을 눌러 보세요.
        </p>
      ) : (
        <ul>
          {groups.map((g) => (
            <li key={g.id} className="my-2.5 flex flex-wrap items-center gap-3 rounded-xl border border-line p-3.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{g.title}</p>
                <p className="mt-1 text-xs text-muted">{fmt(g.savedAt)} · 참석자 {g.participants.length}명</p>
                <p className="mt-1 truncate text-xs text-muted">
                  {g.participants.map((p) => `${p.name || "이름 없음"}(${p.place?.name ?? "미입력"})`).join(" · ")}
                </p>
              </div>
              <button type="button" onClick={() => onLoad(g)} className="rounded-lg bg-pale px-3 py-[9px] font-bold text-primary">
                불러오기
              </button>
              <button
                type="button"
                onClick={() => onDelete(g.id)}
                aria-label={`${g.title} 삭제`}
                className="rounded-lg bg-[#fff0f0] px-3 py-[9px] font-bold text-[#c65c5c]"
              >
                삭제
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
