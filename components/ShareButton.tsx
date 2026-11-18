'use client';

import React, { useState, useCallback } from 'react';
import { SharePayload, buildShareUrl } from '../lib/share';

interface ShareButtonProps {
  payload: SharePayload;
}

export default function ShareButton({ payload }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);

  const rawPayload = payload as Record<string, any>;
  const centerName =
    rawPayload?.dest?.name ||
    rawPayload?.midpoint?.name ||
    rawPayload?.station?.name ||
    rawPayload?.center?.name ||
    '중간지점';

  const picksCount =
    rawPayload?.picks?.length ||
    rawPayload?.candidates?.length ||
    0;

  const handleCopy = useCallback(async () => {
    const url = buildShareUrl(payload);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = url;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  }, [payload]);

  return (
    <div className="relative rounded-2xl border border-slate-200/80 bg-slate-50/70 p-3.5 space-y-2.5 shadow-xs">
      {/* whitespace-nowrap과 w-max 추가로 한 줄 깨짐 방지 */}
      {copied && (
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 z-50 flex items-center justify-center whitespace-nowrap w-max rounded-full bg-emerald-600 px-4 py-1.5 text-[11px] font-bold text-white shadow-lg animate-bounce">
          <span>✓ 클립보드에 복사되었습니다!</span>
        </div>
      )}

      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-slate-800">🔗 약속 장소 공유</span>
        <span className="text-[10px] font-bold text-amber-700 bg-amber-100/80 border border-amber-200/80 px-2 py-0.5 rounded-full">
          후보 장소 {picksCount}곳 포함
        </span>
      </div>

      <p className="text-[11px] text-slate-500 leading-snug">
        이 링크를 공유하면 <strong className="text-slate-700 font-semibold">{centerName}</strong> 정보와 선택하신 <strong className="text-slate-700 font-semibold">약속 후보 {picksCount}곳</strong>이 함께 저장되어 공유됩니다.
      </p>

      <button
        type="button"
        onClick={handleCopy}
        className={`w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold transition-all active:scale-[0.98] ${
          copied
            ? 'bg-emerald-500 text-white shadow-xs'
            : 'bg-primary text-white hover:bg-primary/90 shadow-xs'
        }`}
      >
        <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.898a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
          />
        </svg>
        {copied ? '공유 링크 복사 완료!' : '약속 공유 링크 복사하기'}
      </button>
    </div>
  );
}