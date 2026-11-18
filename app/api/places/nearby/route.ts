import { NextRequest, NextResponse } from "next/server";
import { dataSource, searchNearby } from "@/lib/kakao";
import { handleError, inKorea, jsonError } from "@/lib/apiHelpers";
import type { PlaceCategory } from "@/lib/types";

const CATEGORIES: PlaceCategory[] = ["cafe", "meal", "drink"];

/** GET /api/places/nearby?category=cafe|meal|drink&lat=..&lng=..&radius=700 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const category = sp.get("category") as PlaceCategory;
  const lat = Number(sp.get("lat"));
  const lng = Number(sp.get("lng"));
  const radius = Number(sp.get("radius") ?? 700);

  if (!CATEGORIES.includes(category)) return jsonError("category 는 cafe, meal, drink 중 하나여야 합니다.");
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !inKorea(lat, lng)) {
    return jsonError("lat, lng 가 올바른 국내 좌표가 아닙니다.");
  }
  if (!Number.isFinite(radius) || radius < 100 || radius > 2000) return jsonError("radius 는 100~2000(m) 이어야 합니다.");

  try {
    const places = await searchNearby(category, { lat, lng }, radius);
    return NextResponse.json({ places, source: dataSource() });
  } catch (e) {
    return handleError(e);
  }
}
