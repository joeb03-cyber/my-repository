"use client";

import { useRef } from "react";
import { Maximize2, Minus, X } from "lucide-react";

export interface WindowState {
  id: string;
  kind: string;
  appId?: string;
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  z: number;
  minimized?: boolean;
  transition?: "opening" | "reopening" | "minimizing" | "closing";
  zoomed?: boolean;
  restoreBounds?: { x: number; y: number; width: number; height: number };
  resizable?: boolean;
  payload?: string;
}

interface WindowFrameProps {
  windowState: WindowState;
  children: React.ReactNode;
  onFocus: (id: string) => void;
  onClose: (id: string) => void;
  onMinimize: (id: string) => void;
  onZoom: (id: string) => void;
  onChange: (id: string, changes: Partial<WindowState>) => void;
  isActive: boolean;
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), Math.max(min, max));

export default function WindowFrame({ windowState: win, children, onFocus, onClose, onMinimize, onZoom, onChange, isActive }: WindowFrameProps) {
  const actionRef = useRef<{ mode: "drag" | "resize"; startX: number; startY: number; x: number; y: number; width: number; height: number } | null>(null);

  const begin = (mode: "drag" | "resize", event: React.PointerEvent) => {
    event.preventDefault();
    onFocus(win.id);
    actionRef.current = { mode, startX: event.clientX, startY: event.clientY, x: win.x, y: win.y, width: win.width, height: win.height };

    const move = (pointer: PointerEvent) => {
      const action = actionRef.current;
      if (!action) return;
      const dx = pointer.clientX - action.startX;
      const dy = pointer.clientY - action.startY;
      if (action.mode === "drag") {
        onChange(win.id, {
          x: clamp(action.x + dx, 8, window.innerWidth - win.width - 8),
          y: clamp(action.y + dy, 32, window.innerHeight - 92),
        });
      } else {
        onChange(win.id, {
          width: clamp(action.width + dx, 300, window.innerWidth - win.x - 8),
          height: clamp(action.height + dy, 220, window.innerHeight - win.y - 72),
        });
      }
    };
    const end = () => {
      actionRef.current = null;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
  };

  if (win.minimized) return null;

  return (
    <section
      className={`os-window os-window--${win.kind} ${isActive ? "is-active" : "is-inactive"} ${win.transition ? `is-${win.transition}` : ""} ${win.zoomed ? "is-zoomed" : ""}`}
      style={{ left: win.x, top: win.y, width: win.width, height: win.height, zIndex: win.z }}
      onPointerDown={() => onFocus(win.id)}
      aria-label={`${win.title} window`}
    >
      <header className="os-window__bar" onPointerDown={(event) => begin("drag", event)} onDoubleClick={() => onZoom(win.id)}>
        <div className="window-controls">
          <button className="window-control window-control--close" onPointerDown={(event) => event.stopPropagation()} onClick={() => onClose(win.id)} aria-label={`Close ${win.title}`}><X /></button>
          <button className="window-control window-control--min" onPointerDown={(event) => event.stopPropagation()} onClick={() => onMinimize(win.id)} aria-label={`Minimize ${win.title}`}><Minus /></button>
          <button className="window-control window-control--zoom" onPointerDown={(event) => event.stopPropagation()} onClick={() => onZoom(win.id)} aria-label={`${win.zoomed ? "Restore" : "Expand"} ${win.title}`}><Maximize2 /></button>
        </div>
        <span>{win.title}</span>
        <span className="window-grip">•••</span>
      </header>
      <div className="os-window__content">{children}</div>
      {win.resizable !== false && <button className="resize-handle" onPointerDown={(event) => begin("resize", event)} aria-label={`Resize ${win.title}`} />}
    </section>
  );
}
