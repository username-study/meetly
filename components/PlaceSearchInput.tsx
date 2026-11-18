"use client";

import { useEffect, useId, useRef, useState } from "react";
import { searchPlaces } from "@/lib/api";
import type { Place } from "@/lib/types";

interface Props {
  label: string;
  value: Place | null;
  onChange: (place: Place | null) => void;
}

type Status = "idle" | "loading" | "done" | "error";

/** 출발지 키워드 검색 + 자동완성 드롭다운 (Kakao Local 키워드 검색 → 좌표) */
export function PlaceSearchInput({ label, value, onChange }: Props) {
  const uid = useId();
  const listId = `${uid}-list`;
  const [text, setText] = useState(value?.name ?? "");
  const [results, setResults] = useState<Place[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const boxRef = useRef<HTMLDivElement>(null);

  // 불러오기 등으로 value 가 바뀌면 입력창 글자도 맞춘다
  useEffect(() => setText(value?.name ?? ""), [value]);

  // 입력이 멈추고 300ms 뒤 검색 (이전 요청은 취소)
  useEffect(() => {
    const q = text.trim();
    if (!open || q.length === 0 || (value && q === value.name)) {
      setStatus("idle");
      return;
    }
    setStatus("loading");
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const { places } = await searchPlaces(q, ctrl.signal);
        setResults(places);
        setStatus("done");
        setActive(-1);
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setError((e as Error).message);
        setStatus("error");
      }
    }, 300);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [text, open, value]);

  // 바깥을 누르면 닫기
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const select = (p: Place) => {
    onChange(p);
    setText(p.name);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => (i + 1) % results.length); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => (i <= 0 ? results.length - 1 : i - 1)); }
    else if (e.key === "Enter" && active >= 0) { e.preventDefault(); select(results[active]); }
    else if (e.key === "Escape") setOpen(false);
  };

  return (
    <div ref={boxRef} className="relative">
      <label htmlFor={`${uid}-input`} className="sr-only">
        {label}
      </label>
      <div className="relative">
        <input
          id={`${uid}-input`}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${uid}-opt-${active}` : undefined}
          autoComplete="off"
          placeholder="출발지 역 또는 장소 (예: 강남역)"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setOpen(true);
            if (value) onChange(null); // 글자를 고치면 선택 해제
          }}
          onFocus={() => text && !value && setOpen(true)}
          onKeyDown={onKeyDown}
          className="w-full min-w-0 rounded-lg bg-[#f8faff] p-2.5 pr-10 text-ink outline-none focus:ring-2 focus:ring-[#bcd2ff]"
        />
        {value && (
          <span aria-label="출발지 선택됨" className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-bold text-emerald-600">
            ✓
          </span>
        )}
      </div>

      {open && status !== "idle" && (
        <ul
          id={listId}
          role="listbox"
          aria-label={`${label} 검색 결과`}
          className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-line bg-white shadow-card"
        >
          {status === "loading" && <li className="px-3 py-3 text-sm text-muted">검색 중…</li>}
          {status === "error" && <li role="alert" className="px-3 py-3 text-sm text-red-700">⚠ {error}</li>}
          {status === "done" && results.length === 0 && (
            <li className="px-3 py-3 text-sm text-muted">검색 결과가 없습니다. 다른 이름으로 검색해 보세요.</li>
          )}
          {status === "done" &&
            results.map((p, i) => (
              <li
                key={p.id}
                id={`${uid}-opt-${i}`}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => { e.preventDefault(); select(p); }}
                onMouseEnter={() => setActive(i)}
                className={`cursor-pointer px-3 py-2.5 ${i === active ? "bg-pale" : ""}`}
              >
                <div className="text-sm font-medium">{p.name}</div>
                <div className="truncate text-xs text-muted">{p.address}</div>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}
