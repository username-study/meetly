import type { Place } from "@/lib/types";

export default function DirectionsButton({ place }: { place: Place }) {
  const href = `https://map.kakao.com/link/to/${encodeURIComponent(place.name)},${place.lat},${place.lng}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex shrink-0 items-center rounded-lg bg-pale px-[11px] py-[9px] text-xs font-bold text-primary"
    >
      카카오맵 길찾기 ↗
    </a>
  );
}