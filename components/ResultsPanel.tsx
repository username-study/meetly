
'use client';

import type { MidpointResult } from '@/lib/types';
import type { ReactNode } from 'react';

interface ResultsPanelProps {
  results: MidpointResult[];
  selected: number;
  detail?: ReactNode;
}

export function ResultsPanel({
  results,
  selected,
  detail,
}: ResultsPanelProps) {
  const current = results[selected];

  if (!current) return null;

  const times = current.times.map((item) => item.minutes);
  const maxTime = times.length > 0 ? Math.max(...times) : null;

  const formatMinutes = (value: number) =>
    Number.isInteger(value) ? `${value}` : value.toFixed(1);

  const stats = [
    {
      label: '평균 예상 이동시간',
      value: `${formatMinutes(current.meanMinutes)}분`,
    },
    {
      label: '최장 예상 이동시간',
      value: maxTime !== null
        ? `${formatMinutes(maxTime)}분`
        : '-',
    },
    {
      label: '균형 점수',
      value: `${current.fairness}점`,
    },
  ];

  return (
    <div className="space-y-5">

      {/* 상세 통계 */}
      <div>
        <h3 className="text-sm font-bold text-slate-800">
          📊 이동시간 상세 통계
        </h3>

        <dl className="mt-3 grid grid-cols-3 divide-x divide-slate-200 rounded-xl border border-slate-100 bg-white py-4 text-center">
          {stats.map((s) => (
            <div key={s.label} className="px-2">
              <dt className="text-[11px] font-semibold text-slate-400">
                {s.label}
              </dt>
              <dd className="mt-1 text-base font-extrabold text-slate-800">
                {s.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      {/* 추천 기준 */}
      <details className="rounded-xl border border-slate-100 bg-white p-4">
        <summary className="cursor-pointer text-xs font-bold text-slate-600 hover:text-slate-900">
          💡 추천 기준 보기
        </summary>

        <p className="mt-3 text-xs leading-relaxed text-slate-500">
          {current.mode === 'walk'
            ? '참여자 간 거리가 가까워 도보 중간지점을 기준으로 추천했어요.'
            : '참여자 간 예상 이동시간 격차와 평균 이동시간을 함께 고려했어요.'}
        </p>

        {current.mode === 'transit' && (
          <p className="mt-2 text-[11px] text-slate-400">
            계산 기준: (최장 이동시간 - 최단 이동시간) + 평균 이동시간 × 0.3
          </p>
        )}
      </details>

      {/* 이동시간 차트 및 길찾기 */}
      {detail}

    </div>
  );
}
