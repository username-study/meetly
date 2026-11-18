import type { Place, PlaceCategory } from "./types";

/**
 * 샘플 데이터 모드 (KAKAO_REST_API_KEY 가 없을 때 사용).
 * 좌표는 시연용 근사값이며 실제 Kakao 응답이 아닙니다.
 */
const S = (name: string, lng: number, lat: number, line: string): Place => ({
  id: `sample-${name}`,
  name: `${name}역`,
  address: `${line} ${name}역 (샘플)`,
  categoryName: "교통,수송 > 지하철,전철 > 샘플",
  lat,
  lng,
});

export const SAMPLE_STATIONS: Place[] = [
  S("강남", 127.0276, 37.4979, "2호선"), S("역삼", 127.0364, 37.5006, "2호선"),
  S("선릉", 127.049, 37.5045, "2호선"), S("삼성", 127.0634, 37.5088, "2호선"),
  S("잠실", 127.1002, 37.5133, "2호선"), S("건대입구", 127.0702, 37.5404, "2호선"),
  S("성수", 127.0559, 37.5446, "2호선"), S("왕십리", 127.0373, 37.5612, "2호선"),
  S("홍대입구", 126.9249, 37.5568, "2호선"), S("합정", 126.9145, 37.5495, "2호선"),
  S("신촌", 126.9368, 37.5551, "2호선"), S("서울", 126.9724, 37.5547, "1호선"),
  S("시청", 126.977, 37.5657, "1호선"), S("종로3가", 126.992, 37.5704, "1호선"),
  S("을지로3가", 126.9916, 37.5663, "2호선"), S("동대문역사문화공원", 127.0075, 37.5651, "2호선"),
  S("교대", 127.0145, 37.4934, "2호선"), S("사당", 126.9816, 37.4766, "2호선"),
  S("신림", 126.9293, 37.4842, "2호선"), S("대림", 126.8956, 37.4926, "2호선"),
  S("구로디지털단지", 126.9016, 37.4852, "2호선"), S("신도림", 126.8912, 37.5088, "1호선"),
  S("영등포구청", 126.8963, 37.5258, "2호선"), S("여의도", 126.9243, 37.5216, "5호선"),
  S("당산", 126.9025, 37.5345, "2호선"), S("노원", 127.0561, 37.6552, "4호선"),
  S("수유", 127.0254, 37.6379, "4호선"), S("혜화", 127.0018, 37.5822, "4호선"),
  S("강변", 127.0946, 37.5352, "2호선"), S("천호", 127.1236, 37.5385, "5호선"),
  S("수서", 127.101, 37.4873, "3호선"), S("판교", 127.1112, 37.3948, "신분당선"),
  S("수원", 127.0011, 37.266, "1호선"), S("부평", 126.7226, 37.4896, "1호선"),
  S("부천", 126.7826, 37.4841, "1호선"), S("안양", 126.9226, 37.4018, "1호선"),
  S("대화", 126.7473, 37.6761, "3호선"), S("의정부", 127.0457, 37.7385, "1호선"),
  S("상봉", 127.0942, 37.5966, "7호선"), S("고속터미널", 127.005, 37.5049, "3호선"),
  S("양재", 127.0345, 37.4845, "3호선"),
];

export function sampleKeywordSearch(query: string, limit = 10): Place[] {
  const q = query.replace(/\s/g, "");
  if (!q) return [];
  return SAMPLE_STATIONS.filter((s) => s.name.replace(/\s/g, "").includes(q)).slice(0, limit);
}

const MEAL_LABELS = ["한식당", "파스타 맛집", "고깃집", "초밥집", "분식집"];
const DRINK_LABELS = ["보드게임 카페", "루프탑 카페", "베이커리 카페", "전통찻집"];

const LABEL: Record<PlaceCategory, string[]> = {
  cafe: ["로스터리 카페", "브런치 카페", "디저트 카페", "스터디 카페", "북카페"],
  meal: MEAL_LABELS,
  drink: DRINK_LABELS,
  drinks: DRINK_LABELS,
  restaurant: MEAL_LABELS,
  parking: ["공영주차장", "민영주차장", "노상주차장", "빌딩 주차장", "환승주차장"],
};



/** 기준 좌표 주변에 결정적(고정) 샘플 장소를 만든다 */
export function sampleNearby(category: PlaceCategory, lat: number, lng: number, radius: number): Place[] {
  const names = LABEL[category];
  return names.map((n, i) => {
    const angle = (i / names.length) * Math.PI * 2;
    const dist = Math.min(radius, 150 + i * 120); // m
    const dLat = (Math.sin(angle) * dist) / 111_000;
    const dLng = (Math.cos(angle) * dist) / (111_000 * Math.cos((lat * Math.PI) / 180));
    return {
      id: `sample-${category}-${i}`,
      name: `[샘플] ${n} ${i + 1}`,
      address: "샘플 데이터 (실제 장소 아님)",
      categoryName: "샘플",
      lat: lat + dLat,
      lng: lng + dLng,
      distance: Math.round(dist),
    };
  });
}
