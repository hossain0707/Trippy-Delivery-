"use client";
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";

export type Dimensions = { length: string; width: string; height: string };
export type PackageForm = "box" | "envelope";

const MAX_SIDE_CM = 150;
const MAX_DIAGONAL = Math.sqrt(3) * MAX_SIDE_CM;
const FIT_ZOOM_START_CM = 42;
const DRAG_DEGREES_PER_PIXEL = 0.65;
const STAGE_PADDING = 56;
const PERSPECTIVE = 680;

export function ParcelPreview({ dimensions, form, bn }: { dimensions: Dimensions; form: PackageForm; bn: boolean }) {
  const [view, setView] = useState({ pitch: -24, yaw: 30 });
  const drag = useRef<{ id: number; x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  function rotate(dx: number, dy: number) {
    setView(({ pitch, yaw }) => ({ pitch: (pitch - dy) % 360, yaw: (yaw + dx) % 360 }));
  }

  function endDrag(event: PointerEvent<HTMLDivElement>) {
    if (drag.current?.id !== event.pointerId) return;
    drag.current = null;
    setDragging(false);
  }
  const stageRef = useRef<HTMLDivElement>(null);
  const [stageSize, setStageSize] = useState(0);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const observer = new ResizeObserver(([entry]) => {
      setStageSize(Math.min(entry.contentRect.width, entry.contentRect.height));
    });
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  const [length, width, height] = [dimensions.length, dimensions.width, dimensions.height].map(Number);
  const valid = [length, width, height].every(value => value >= 0.01 && value <= MAX_SIDE_CM);
  const diagonal = Math.hypot(length, width, height);
  const available = Math.max(1, (stageSize || 250) - STAGE_PADDING);
  // The diagonal bounds the model at every rotation. Allow for perspective magnification.
  const fitDiameter = available * PERSPECTIVE / (PERSPECTIVE + available / 2);
  // Keep large parcels growing on-screen while gradually reducing their scale to fit.
  const baseScale = fitDiameter * 0.72 / FIT_ZOOM_START_CM;
  const zoomProgress = Math.max(0, (diagonal - FIT_ZOOM_START_CM) / (MAX_DIAGONAL - FIT_ZOOM_START_CM));
  const displayDiagonal = fitDiameter * (0.72 + 0.28 * zoomProgress);
  const scale = diagonal <= FIT_ZOOM_START_CM ? baseScale : displayDiagonal / diagonal;
  const vars = {
    "--parcel-l": length * scale + "px",
    "--parcel-w": width * scale + "px",
    "--parcel-h": height * scale + "px",
    transform: `rotateX(${view.pitch}deg) rotateY(${view.yaw}deg)`,
    transition: "none",
  } as CSSProperties;
  const t = (en: string, bangla: string) => bn ? bangla : en;
  const format = new Intl.NumberFormat(bn ? "bn-BD" : "en-BD", { maximumFractionDigits: 2 });
  return <section className="panel parcel-preview">
    <h2>{t("Live 3D preview", "লাইভ ৩ডি প্রিভিউ")}</h2>
    <p id="parcel-preview-instructions">{t("Drag to turn the parcel, or use the arrow keys.", "পার্সেল ঘোরাতে টানুন বা তীর চিহ্নের কী ব্যবহার করুন।")}</p>
    <div className="parcel-stage" ref={stageRef} role="group" aria-labelledby="parcel-preview-instructions"
      tabIndex={valid ? 0 : undefined}
      style={valid ? { cursor: dragging ? "grabbing" : "grab", touchAction: "none", userSelect: "none" } : undefined}
      onPointerDown={event => {
        if (!valid || event.button !== 0 || drag.current) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
        setDragging(true);
      }}
      onPointerMove={event => {
        const previous = drag.current;
        if (previous?.id !== event.pointerId) return;
        rotate((event.clientX - previous.x) * DRAG_DEGREES_PER_PIXEL, (event.clientY - previous.y) * DRAG_DEGREES_PER_PIXEL);
        drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
      }}
      onPointerUp={endDrag} onPointerCancel={endDrag} onLostPointerCapture={endDrag}
      onKeyDown={event => {
        if (!valid) return;
        const turns: Record<string, [number, number]> = {
          ArrowLeft: [-15, 0], ArrowRight: [15, 0], ArrowUp: [0, -15], ArrowDown: [0, 15],
        };
        const turn = turns[event.key];
        if (!Array.isArray(turn)) return;
        event.preventDefault();
        rotate(...turn);
      }}>
      {valid ? <div className={"parcel-model " + form} style={vars} role="img"
        aria-label={(form === "box" ? t("Branded TRIPPY box", "ট্রিপি বাক্স") : t("Branded TRIPPY envelope", "ট্রিপি খাম")) + " · " + Object.values(dimensions).map(v => format.format(Number(v))).join(" × ") + " " + t("cm", "সেমি")}>
        {["front", "back", "left", "right", "top", "bottom"].map(face => <div key={face} className={"parcel-face " + face} aria-hidden="true">
          <span className="parcel-print"><span className="parcel-cube" aria-hidden="true"><i/><i/><i/></span><span><b>TRIPPY</b> Delivery</span></span>
        </div>)}
      </div> : <p>{t("Enter valid dimensions to see the package.", "পার্সেল দেখতে সঠিক মাপ লিখুন।")}</p>}
    </div>
  </section>;
}
