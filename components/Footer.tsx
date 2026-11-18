'use client';

export default function Footer() {
  return (
    <footer className="mt-8 border-t border-slate-200/80 bg-slate-50/70 py-6 text-center text-slate-400">
      <div className="mx-auto max-w-screen-xl px-4 space-y-1">
        <p className="text-xs font-semibold text-slate-600">
          📍 Meetly · 카카오맵 API 기반 모임 중간지점 & 약속 장소 추천 서비스
        </p>
        <p className="text-[11px] text-slate-400">
          모든 참여자의 이동 시간을 고려한 최적의 약속 장소를 안내해 드립니다.
        </p>
        <p className="pt-1 text-[10px] text-slate-400/80">
          ⓒ 2026 Meetly Team. All rights reserved.
        </p>
      </div>
    </footer>
  );
}