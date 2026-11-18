'use client';

import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  type ChartOptions,
  type TooltipItem,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { TravelInfo } from '../lib/types';
import { MAX_CHART_MINUTES, formatDistance, formatTravel } from "@/lib/travel";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

interface TravelChartProps {
  travelInfos?: TravelInfo[];
}

const defaultTravelInfos: TravelInfo[] = [
  { memberId: '1', memberName: '참석자 A (강남역)', durationMinutes: 35, distanceKm: 12.5, isWalking: false },
  { memberId: '2', memberName: '참석자 B (홍대입구역)', durationMinutes: 20, distanceKm: 5.2, isWalking: false },
  { memberId: '3', memberName: '참석자 C (신촌역)', durationMinutes: 40, distanceKm: 18.1, isWalking: false },
  { memberId: '4', memberName: '참석자 D (녹번역)', durationMinutes: 12, distanceKm: 0.8, isWalking: true },
];

const COLOR_TRANSIT = '#2f6fed'; // 브랜드 기본 블루 컬러와 톤 맞춤
const COLOR_WALK = '#10b981';

export default function TravelChart({ travelInfos = defaultTravelInfos }: TravelChartProps) {
  const rows = travelInfos.map((info) => ({ info, ...formatTravel(info) }));
  const maxMinutes = Math.max(MAX_CHART_MINUTES, ...travelInfos.map((i) => i.durationMinutes));
  const height = rows.length * 44 + 90;
  const allSameSpot = travelInfos.length > 0 && travelInfos.every((i) => i.durationMinutes === 0);

  const chartData = {
    labels: rows.map((r) => r.info.memberName),
    datasets: [
      {
        label: '소요 시간(분)',
        data: rows.map((r) => r.info.durationMinutes),
        backgroundColor: rows.map((r) => (r.mode === 'walk' ? COLOR_WALK : COLOR_TRANSIT)),
        borderRadius: 6,
        barThickness: 20,
      },
    ],
  };

  const options: ChartOptions<'bar'> = {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    layout: {
      padding: {
        left: 8, // Y축 라벨 텍스트 잘림 방지용 여백 추가
        right: 12,
      },
    },
    plugins: {
      legend: { display: false },
      title: { 
        display: true, 
        text: '참석자별 소요 시간 비교 (분)',
        font: { size: 13, weight: 'bold' },
        color: '#1e293b',
        padding: { bottom: 16 }
      },
      tooltip: {
        callbacks: {
          label: (ctx: TooltipItem<'bar'>) => {
            const r = rows[ctx.dataIndex];
            if (!r) return '';
            return `${r.label} (${formatDistance(r.info.distanceKm)})`;
          },
        },
      },
    },
    scales: {
      x: {
        min: 0,
        suggestedMax: maxMinutes,
        title: { display: true, text: '분 (Minutes)', font: { size: 10 }, color: '#64748b' },
        grid: { color: '#f1f5f9' },
        ticks: { font: { size: 10 }, color: '#64748b' },
      },
      y: {
        grid: { display: false },
        ticks: { 
          font: { size: 11, weight: 'bold' }, 
          color: '#334155',
          padding: 6, // 바와 라벨 사이 여백
        },
      },
    },
  };

  return (
    <section aria-label="참석자별 이동시간 차트" className="space-y-4">
      {allSameSpot ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-6 text-center">
          <p className="text-sm font-bold text-slate-700">📍 모든 참석자가 같은 위치에 있어요</p>
          <p className="mt-1 text-xs text-slate-400">이동할 필요가 없어서 이동시간 비교 차트는 생략했어요.</p>
        </div>
      ) : (
        <div style={{ height }}>
          <Bar data={chartData} options={options} />
        </div>
      )}

      <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200/80 bg-white shadow-2xs">
        {rows.map(({ info, mode, text }) => (
          <li key={info.memberId} className="flex items-center justify-between px-4 py-3 text-sm">
            <span className="font-bold text-slate-800">{info.memberName}</span>
            <span className="flex items-center gap-2">
              {mode === 'walk' && (
                <span className="rounded-full bg-emerald-100/80 px-2 py-0.5 text-[11px] font-bold text-emerald-800 border border-emerald-200/60">
                  🚶 도보
                </span>
              )}
              <span className="tabular-nums font-medium text-slate-600">{text}</span>
            </span>
          </li>
        ))}
      </ul>

      <div className="flex items-center justify-end gap-4 text-xs font-semibold text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-xs" style={{ backgroundColor: COLOR_TRANSIT }} /> 대중교통
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-xs" style={{ backgroundColor: COLOR_WALK }} /> 도보 (1km 미만)
        </span>
      </div>
    </section>
  );
}