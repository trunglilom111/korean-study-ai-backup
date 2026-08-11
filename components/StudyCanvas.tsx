"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Point = {
  x: number;
  y: number;
  pressure: number;
};

type StrokeTool = "pen" | "highlighter" | "eraser";

type Stroke = {
  tool: StrokeTool;
  color: string;
  width: number;
  points: Point[];
};

type StudyCanvasProps = {
  title?: string;
  storageKey: string;
};

const COLORS = ["#f8fafc", "#facc15", "#fb7185", "#60a5fa", "#4ade80"];

function loadStrokes(storageKey: string): Stroke[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const value = window.localStorage.getItem(storageKey);
    const parsed = value ? JSON.parse(value) : [];

    return Array.isArray(parsed) ? (parsed as Stroke[]) : [];
  } catch {
    return [];
  }
}

export default function StudyCanvas({
  title = "Smart Canvas",
  storageKey,
}: StudyCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const draftRef = useRef<Stroke | null>(null);
  const [strokes, setStrokes] = useState<Stroke[]>(() => loadStrokes(storageKey));
  const [redoStrokes, setRedoStrokes] = useState<Stroke[]>([]);
  const [tool, setTool] = useState<StrokeTool>("pen");
  const [color, setColor] = useState(COLORS[0]);
  const [width, setWidth] = useState(4);
  const [visible, setVisible] = useState(true);

  const redraw = useCallback((source: Stroke[], draft?: Stroke | null) => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const frame = canvas.getBoundingClientRect();
    const context = canvas.getContext("2d");

    if (!context) {
      return;
    }

    const devicePixelRatio = window.devicePixelRatio || 1;
    const widthInPixels = Math.max(1, Math.floor(frame.width * devicePixelRatio));
    const heightInPixels = Math.max(1, Math.floor(frame.height * devicePixelRatio));

    if (canvas.width !== widthInPixels || canvas.height !== heightInPixels) {
      canvas.width = widthInPixels;
      canvas.height = heightInPixels;
    }

    context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    context.clearRect(0, 0, frame.width, frame.height);

    if (!visible) {
      return;
    }

    for (const stroke of draft ? [...source, draft] : source) {
      drawStroke(context, stroke, frame.width, frame.height);
    }
  }, [visible]);

  useEffect(() => {
    const frame = frameRef.current;

    if (!frame) {
      return;
    }

    const resizeObserver = new ResizeObserver(() => redraw(strokes, draftRef.current));
    resizeObserver.observe(frame);
    redraw(strokes, draftRef.current);

    return () => resizeObserver.disconnect();
  }, [redraw, strokes]);

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(strokes));
    } catch {
      // Local storage can be unavailable in private browsing; drawing still works.
    }
  }, [strokes, storageKey]);

  function pointFromEvent(event: React.PointerEvent<HTMLCanvasElement>): Point {
    const rect = event.currentTarget.getBoundingClientRect();

    return {
      x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
      pressure: event.pressure || 0.5,
    };
  }

  function handlePointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!visible) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    draftRef.current = {
      tool,
      color,
      width,
      points: [pointFromEvent(event)],
    };
    redraw(strokes, draftRef.current);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    const draft = draftRef.current;

    if (!draft || !event.currentTarget.hasPointerCapture(event.pointerId)) {
      return;
    }

    draft.points.push(pointFromEvent(event));
    redraw(strokes, draft);
  }

  function finishStroke(event: React.PointerEvent<HTMLCanvasElement>) {
    const draft = draftRef.current;

    if (!draft) {
      return;
    }

    if (draft.points.length === 1) {
      draft.points.push({ ...draft.points[0], x: draft.points[0].x + 0.001 });
    }

    setStrokes((current) => [...current, draft]);
    setRedoStrokes([]);
    draftRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function undo() {
    const last = strokes[strokes.length - 1];

    if (!last) {
      return;
    }

    setStrokes(strokes.slice(0, -1));
    setRedoStrokes((current) => [...current, last]);
  }

  function redo() {
    const last = redoStrokes[redoStrokes.length - 1];

    if (!last) {
      return;
    }

    setRedoStrokes(redoStrokes.slice(0, -1));
    setStrokes((current) => [...current, last]);
  }

  function clearCanvas() {
    if (!window.confirm("Xóa toàn bộ nét vẽ trên canvas?")) {
      return;
    }

    setStrokes([]);
    setRedoStrokes([]);
  }

  return (
    <section className="mb-8 rounded-3xl border border-slate-800 bg-slate-900 p-5 md:p-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">✍️ Không gian ghi chú trực tiếp</p>
          <h2 className="mt-1 text-xl font-bold">{title}</h2>
        </div>
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          className="rounded-xl border border-slate-700 px-3 py-2 text-sm text-slate-300"
        >
          {visible ? "Ẩn canvas" : "Hiện canvas"}
        </button>
      </div>

      {visible && (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {(["pen", "highlighter", "eraser"] as StrokeTool[]).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setTool(item)}
                className={`rounded-lg px-3 py-2 text-sm ${tool === item ? "bg-white text-black" : "border border-slate-700 text-slate-300"}`}
              >
                {item === "pen" ? "Bút" : item === "highlighter" ? "Highlight" : "Tẩy"}
              </button>
            ))}
            {COLORS.map((item) => (
              <button
                key={item}
                type="button"
                aria-label={`Màu ${item}`}
                onClick={() => {
                  setColor(item);
                  setTool("pen");
                }}
                className={`h-7 w-7 rounded-full border-2 ${color === item ? "border-white" : "border-transparent"}`}
                style={{ backgroundColor: item }}
              />
            ))}
            <label className="ml-1 flex items-center gap-2 text-xs text-slate-400">
              Nét
              <input
                type="range"
                min="2"
                max="18"
                value={width}
                onChange={(event) => setWidth(Number(event.target.value))}
              />
            </label>
            <button type="button" onClick={undo} disabled={strokes.length === 0} className="rounded-lg border border-slate-700 px-3 py-2 text-sm disabled:opacity-40">↶</button>
            <button type="button" onClick={redo} disabled={redoStrokes.length === 0} className="rounded-lg border border-slate-700 px-3 py-2 text-sm disabled:opacity-40">↷</button>
            <button type="button" onClick={clearCanvas} className="rounded-lg border border-rose-900 px-3 py-2 text-sm text-rose-300">Xóa</button>
          </div>

          <div ref={frameRef} className="mt-4 h-72 overflow-hidden rounded-2xl border border-slate-700 bg-slate-950">
            <canvas
              ref={canvasRef}
              className="h-full w-full touch-none"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={finishStroke}
              onPointerCancel={finishStroke}
            />
          </div>
          <p className="mt-2 text-xs text-slate-500">Canvas tự lưu trên thiết bị này; nét vẽ được lưu dạng vector để không bị lệch khi đổi kích thước.</p>
        </>
      )}
    </section>
  );
}

function drawStroke(
  context: CanvasRenderingContext2D,
  stroke: Stroke,
  width: number,
  height: number
) {
  if (stroke.points.length < 2) {
    return;
  }

  context.save();
  context.lineCap = "round";
  context.lineJoin = "round";
  context.lineWidth = stroke.width;
  context.globalAlpha = stroke.tool === "highlighter" ? 0.28 : 1;
  context.globalCompositeOperation = stroke.tool === "eraser" ? "destination-out" : "source-over";
  context.strokeStyle = stroke.color;
  context.beginPath();

  stroke.points.forEach((point, index) => {
    const x = point.x * width;
    const y = point.y * height;

    if (index === 0) {
      context.moveTo(x, y);
    } else {
      context.lineTo(x, y);
    }
  });

  context.stroke();
  context.restore();
}
