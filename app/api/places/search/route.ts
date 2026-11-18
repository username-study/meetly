import { NextRequest, NextResponse } from "next/server";
import { dataSource, searchKeyword } from "@/lib/kakao";
import { handleError, jsonError } from "@/lib/apiHelpers";

/** GET /api/places/search?q=강남역  →  출발지 후보(좌표 포함) */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 1) return jsonError("검색어를 입력해 주세요.");
  if (q.length > 50) return jsonError("검색어는 50자 이하로 입력해 주세요.");
  try {
    const places = await searchKeyword(q, 10);
    return NextResponse.json({ places, source: dataSource() });
  } catch (e) {
    return handleError(e);
  }
}
