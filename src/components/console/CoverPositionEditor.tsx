"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Drag-to-reposition editor for the company cover/banner image (real-usage
 *  ask: the banner always cropped dead-center with no way to adjust it).
 *  Fully controlled — `x`/`y` are CSS `object-position` percentages (0 =
 *  show the image's left/top edge, 100 = its right/bottom edge), and this
 *  component never persists anything itself; the parent form's own Save
 *  button does that, same as every other field here.
 *
 *  Uses Pointer Capture rather than window-level mouse listeners — once a
 *  drag starts, pointer events keep firing on this element even if the
 *  cursor leaves its bounds mid-drag, with no extra cleanup/listener
 *  bookkeeping needed.
 *
 *  Dragging moves the image like a physical photo under a fixed window:
 *  dragging right reveals more of the image's LEFT side (so `x` decreases),
 *  dragging down reveals more of its TOP (so `y` decreases) — the opposite
 *  of the drag direction, which is what "grab and slide the photo" expects.
 *  Arrow keys use the other common convention instead (panning the visible
 *  window in the pressed direction, like a map) since there's no single
 *  obviously-correct mapping for a keyboard-only interaction — this one at
 *  least matches what pressing Right arrow does on a scrollable region. */
export function CoverPositionEditor({
  src,
  x,
  y,
  onChange,
}: {
  src: string;
  x: number;
  y: number;
  onChange: (x: number, y: number) => void;
}) {
  const t = useTranslations("console");
  const containerRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef<{ clientX: number; clientY: number; x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.preventDefault();
    dragStart.current = { clientX: e.clientX, clientY: e.clientY, x, y };
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragStart.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const deltaXPct = ((e.clientX - dragStart.current.clientX) / rect.width) * 100;
    const deltaYPct = ((e.clientY - dragStart.current.clientY) / rect.height) * 100;
    onChange(clamp(dragStart.current.x - deltaXPct, 0, 100), clamp(dragStart.current.y - deltaYPct, 0, 100));
  }

  function handlePointerUp() {
    dragStart.current = null;
    setDragging(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const step = e.shiftKey ? 10 : 3;
    if (e.key === "ArrowLeft") onChange(clamp(x - step, 0, 100), y);
    else if (e.key === "ArrowRight") onChange(clamp(x + step, 0, 100), y);
    else if (e.key === "ArrowUp") onChange(x, clamp(y - step, 0, 100));
    else if (e.key === "ArrowDown") onChange(x, clamp(y + step, 0, 100));
    else return;
    e.preventDefault();
  }

  return (
    <div
      ref={containerRef}
      role="application"
      aria-label={t("coverPositionEditorLabel")}
      tabIndex={0}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onKeyDown={handleKeyDown}
      className={`relative aspect-[4/1] w-full touch-none overflow-hidden rounded-lg border border-line select-none focus:outline-none focus:ring-2 focus:ring-pine ${
        dragging ? "cursor-grabbing" : "cursor-grab"
      }`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- a live, draggable preview, not a static asset */}
      <img
        src={src}
        alt=""
        draggable={false}
        className="h-full w-full object-cover"
        style={{ objectPosition: `${x}% ${y}%` }}
      />
      {!dragging && (
        <span className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-xs text-white">
          {t("coverPositionDragHint")}
        </span>
      )}
    </div>
  );
}
