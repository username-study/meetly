'use client';

import React, { useState } from 'react';
import { TravelInfo, Place } from "@/lib/types";
import TravelChart from './TravelChart';
import PlaceCard from "./PlaceCard";

// 가짜 Top 3 데이터
const dummyPlans = [
  {
    id: 'plan-1',
    label: '1안',
    midpoint: { lat: 37.5663, lng: 126.9779, addressName: '서울시청', fairnessScore: 95 },
    travelInfos: [
      { memberId: '1', memberName: '참석자 A', durationMinutes: 22, distanceKm: 8.4, isWalking: false },
      { memberId: '2', memberName: '참석자 B', durationMinutes: 18, distanceKm: 6.2, isWalking: false },
      { memberId: '3', memberName: '참석자 C', durationMinutes: 25, distanceKm: 9.1, isWalking: false },
    ],
    recommendedPlaces: [
      { id: 'p1', name: '스타벅스 시청점', category: 'cafe' as const, rating: 4.5, address: '서울 중구 세종대로', lat: 37.5650, lng: 126.9770, kakaoMapUrl: 'https://map.kakao.com/link/roadview/37.5650,126.9770', description: '시청역 도보 3분, 접근성 최상' },
      { id: 'p2', name: '광화문 국밥', category: 'restaurant' as const, rating: 4.3, address: '서울 종로구 새문안로', lat: 37.5700, lng: 126.9750, kakaoMapUrl: 'https://map.kakao.com/link/roadview/37.5700,126.9750', description: '현지인 추천 맛집' },
    ],
  },
  {
    id: 'plan-2',
    label: '2안',
    midpoint: { lat: 37.5580, lng: 126.9850, addressName: '을지로입구', fairnessScore: 92 },
    travelInfos: [
      { memberId: '1', memberName: '참석자 A', durationMinutes: 28, distanceKm: 9.5, isWalking: false },
      { memberId: '2', memberName: '참석자 B', durationMinutes: 20, distanceKm: 7.1, isWalking: false },
      { memberId: '3', memberName: '참석자 C', durationMinutes: 22, distanceKm: 8.0, isWalking: false },
    ],
    recommendedPlaces: [
      { id: 'p3', name: '폴바셋 을지로점', category: 'cafe' as const, rating: 4.4, address: '서울 중구 을지로', lat: 37.5570, lng: 126.9840, kakaoMapUrl: 'https://map.kakao.com/link/roadview/37.5570,126.9840', description: '조용한 분위기, 회의하기 좋음' },
    ],
  },
  {
    id: 'plan-3',
    label: '3안',
    midpoint: { lat: 37.5630, lng: 126.9900, addressName: '종로3가', fairnessScore: 88 },
    travelInfos: [
      { memberId: '1', memberName: '참석자 A', durationMinutes: 32, distanceKm: 11.2, isWalking: false },
      { memberId: '2', memberName: '참석자 B', durationMinutes: 15, distanceKm: 4.8, isWalking: true },
      { memberId: '3', memberName: '참석자 C', durationMinutes: 20, distanceKm: 6.5, isWalking: false },
    ],
    recommendedPlaces: [
      { id: 'p4', name: '을지로 삼겹살', category: 'drink' as const, rating: 4.6, address: '서울 중구 을지로', lat: 37.5560, lng: 126.9860, kakaoMapUrl: 'https://map.kakao.com/link/roadview/37.5560,126.9860', description: '회식 장소로 인기' },
    ],
  },
];

export default function Top3Tabs() {
  const [selectedPlan, setSelectedPlan] = useState(dummyPlans[0]);

  return (
    <section aria-label="Top 3 추천 장소">
      {/* 탭 버튼 */}
      <div className="flex gap-2 mb-4 border-b border-gray-200 pb-2">
        {dummyPlans.map((plan) => (
          <button
            key={plan.id}
            onClick={() => setSelectedPlan(plan)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              selectedPlan.id === plan.id
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            {plan.label}
          </button>
        ))}
      </div>

      {/* 공정성 점수 */}
      <div className="mb-4 flex items-center gap-4">
        <div className="rounded-xl bg-blue-50 px-4 py-3">
          <p className="text-xs text-blue-600 font-medium">공정성 점수</p>
          <p className="text-2xl font-bold text-blue-700">{selectedPlan.midpoint.fairnessScore}<span className="text-lg">점</span></p>
        </div>
        <div className="text-sm text-gray-600">
          <p>중간지점: <strong>{selectedPlan.midpoint.addressName}</strong></p>
        </div>
      </div>

      {/* 이동시간 차트 */}
      <div className="mb-6">
        <TravelChart travelInfos={selectedPlan.travelInfos} />
      </div>

      {/* 추천 장소 목록 */}
      <div>
        <h3 className="mb-3 text-lg font-semibold">추천 장소</h3>
        <div className="space-y-3">
          {selectedPlan.recommendedPlaces.map((place) => (
            <PlaceCard key={place.id} place={place} />
          ))}
        </div>
      </div>
    </section>
  );
}
