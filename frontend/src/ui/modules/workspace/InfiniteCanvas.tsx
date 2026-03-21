import React, { useCallback, useEffect, useRef } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CanvasViewport {
    x: number;
    y: number;
    scale: number;
}

export interface CanvasItem {
    id: string;
    type: 'image' | 'video';
    x: number;
    y: number;
    width: number;
    height: number;
    src?: string;
    isGenerating?: boolean;
    isFailed?: boolean;
    label?: string;
}

interface InfiniteCanvasProps {
    items: CanvasItem[];
    selectedId: string | null;
    viewport: CanvasViewport;
    onViewportChange: (v: CanvasViewport) => void;
    onSelect: (id: string | null) => void;
    /** Called on pointer-up after a move/resize to commit the final position */
    onItemChange: (id: string, patch: { x?: number; y?: number; width?: number; height?: number }) => void;
    onDoubleClick?: (id: string) => void;
    className?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const HANDLE_PX = 8;        // handle size in screen pixels (invariant to zoom)
const MIN_SCALE = 0.04;
const MAX_SCALE = 8;
const MIN_DIM = 30;         // minimum item dimension in canvas units

// ---------------------------------------------------------------------------
// Drag state (stored in a ref, never triggers renders)
// ---------------------------------------------------------------------------

type DragState =
    | { kind: 'pan'; startPx: number; startPy: number; origVx: number; origVy: number }
    | { kind: 'move'; id: string; startPx: number; startPy: number; origX: number; origY: number }
    | { kind: 'resize'; id: string; handle: string; startPx: number; startPy: number; orig: { x: number; y: number; w: number; h: number } };

// ---------------------------------------------------------------------------
// Helper: apply viewport to the canvas layer DOM element directly
// (bypasses React state updates for smooth pan/zoom while dragging)
// ---------------------------------------------------------------------------

function applyTransform(el: HTMLElement, vp: CanvasViewport) {
    el.style.transform = `translate(${vp.x}px,${vp.y}px) scale(${vp.scale})`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const InfiniteCanvas: React.FC<InfiniteCanvasProps> = ({
    items,
    selectedId,
    viewport,
    onViewportChange,
    onSelect,
    onItemChange,
    onDoubleClick,
    className,
}) => {
    const rootRef       = useRef<HTMLDivElement>(null);
    const layerRef      = useRef<HTMLDivElement>(null);
    const vpRef         = useRef<CanvasViewport>(viewport);
    const itemsRef      = useRef<CanvasItem[]>(items);
    const dragRef       = useRef<DragState | null>(null);
    // live overrides for the currently-dragged item (avoids parent re-renders per frame)
    const liveOverride  = useRef<{ id: string; x: number; y: number; width: number; height: number } | null>(null);
    const itemElsRef    = useRef<Map<string, HTMLDivElement>>(new Map());

    // keep refs in sync with latest props
    useEffect(() => { vpRef.current = viewport; }, [viewport]);
    useEffect(() => { itemsRef.current = items; }, [items]);

    // apply viewport from props (controlled updates from outside, e.g. conversation switch)
    useEffect(() => {
        if (layerRef.current) {
            applyTransform(layerRef.current, viewport);
        }
    }, [viewport]);

    // ---------------------------------------------------------------------------
    // Wheel → zoom toward cursor (passive: false to allow preventDefault)
    // ---------------------------------------------------------------------------

    useEffect(() => {
        const root = rootRef.current;
        if (!root) return;

        const handler = (e: WheelEvent) => {
            e.preventDefault();
            const rect = root.getBoundingClientRect();
            const cx = e.clientX - rect.left;
            const cy = e.clientY - rect.top;
            const vp = vpRef.current;

            const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
            const nextScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, vp.scale * factor));
            const ratio = nextScale / vp.scale;

            const next: CanvasViewport = {
                x: cx - ratio * (cx - vp.x),
                y: cy - ratio * (cy - vp.y),
                scale: nextScale,
            };

            vpRef.current = next;
            if (layerRef.current) applyTransform(layerRef.current, next);
            onViewportChange(next);
        };

        root.addEventListener('wheel', handler, { passive: false });
        return () => root.removeEventListener('wheel', handler);
    }, [onViewportChange]);

    // ---------------------------------------------------------------------------
    // Screen ↔ canvas coordinate helpers
    // ---------------------------------------------------------------------------

    const toCanvas = (sx: number, sy: number) => {
        const { x, y, scale } = vpRef.current;
        return { cx: (sx - x) / scale, cy: (sy - y) / scale };
    };

    // ---------------------------------------------------------------------------
    // Pan (pointerdown on background)
    // ---------------------------------------------------------------------------

    const onBgPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        onSelect(null);
        const vp = vpRef.current;
        dragRef.current = {
            kind: 'pan',
            startPx: e.clientX,
            startPy: e.clientY,
            origVx: vp.x,
            origVy: vp.y,
        };
    }, [onSelect]);

    // ---------------------------------------------------------------------------
    // Item move (pointerdown on item body)
    // ---------------------------------------------------------------------------

    const onItemPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>, id: string) => {
        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
        onSelect(id);
        const item = itemsRef.current.find(i => i.id === id);
        if (!item) return;
        dragRef.current = {
            kind: 'move',
            id,
            startPx: e.clientX,
            startPy: e.clientY,
            origX: item.x,
            origY: item.y,
        };
        liveOverride.current = { id, x: item.x, y: item.y, width: item.width, height: item.height };
    }, [onSelect]);

    // ---------------------------------------------------------------------------
    // Resize (pointerdown on corner handle)
    // ---------------------------------------------------------------------------

    const onHandlePointerDown = useCallback((
        e: React.PointerEvent<HTMLDivElement>,
        id: string,
        handle: string,
    ) => {
        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
        const item = itemsRef.current.find(i => i.id === id);
        if (!item) return;
        dragRef.current = {
            kind: 'resize',
            id,
            handle,
            startPx: e.clientX,
            startPy: e.clientY,
            orig: { x: item.x, y: item.y, w: item.width, h: item.height },
        };
        liveOverride.current = { id, x: item.x, y: item.y, width: item.width, height: item.height };
    }, []);

    // ---------------------------------------------------------------------------
    // PointerMove — update DOM directly (no React state) for 60 fps
    // ---------------------------------------------------------------------------

    const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        const drag = dragRef.current;
        if (!drag) return;

        const dx = e.clientX - drag.startPx;
        const dy = e.clientY - drag.startPy;
        const vp = vpRef.current;

        if (drag.kind === 'pan') {
            const next: CanvasViewport = { ...vp, x: drag.origVx + dx, y: drag.origVy + dy };
            vpRef.current = next;
            if (layerRef.current) applyTransform(layerRef.current, next);

        } else if (drag.kind === 'move') {
            const ddx = dx / vp.scale;
            const ddy = dy / vp.scale;
            const nx = drag.origX + ddx;
            const ny = drag.origY + ddy;
            liveOverride.current = { ...liveOverride.current!, x: nx, y: ny };
            const el = itemElsRef.current.get(drag.id);
            if (el) { el.style.left = `${nx}px`; el.style.top = `${ny}px`; }

        } else if (drag.kind === 'resize') {
            const { orig, handle } = drag;
            const ddx = dx / vp.scale;
            const ddy = dy / vp.scale;

            let nx = orig.x, ny = orig.y, nw = orig.w, nh = orig.h;
            if (handle.includes('e')) {
                nw = Math.max(MIN_DIM, orig.w + ddx);
            } else {
                nw = Math.max(MIN_DIM, orig.w - ddx);
                nx = orig.x + orig.w - nw;
            }
            if (handle.includes('s')) {
                nh = Math.max(MIN_DIM, orig.h + ddy);
            } else {
                nh = Math.max(MIN_DIM, orig.h - ddy);
                ny = orig.y + orig.h - nh;
            }
            liveOverride.current = { id: drag.id, x: nx, y: ny, width: nw, height: nh };
            const el = itemElsRef.current.get(drag.id);
            if (el) {
                el.style.left = `${nx}px`;
                el.style.top = `${ny}px`;
                el.style.width = `${nw}px`;
                el.style.height = `${nh}px`;
            }
        }
    }, []);

    // ---------------------------------------------------------------------------
    // PointerUp — commit to parent state
    // ---------------------------------------------------------------------------

    const onPointerUp = useCallback(() => {
        const drag = dragRef.current;
        if (!drag) return;

        if (drag.kind === 'pan') {
            onViewportChange(vpRef.current);
        } else if (drag.kind === 'move' || drag.kind === 'resize') {
            const ov = liveOverride.current;
            if (ov) {
                onItemChange(ov.id, { x: ov.x, y: ov.y, width: ov.width, height: ov.height });
            }
        }

        dragRef.current = null;
        liveOverride.current = null;
    }, [onViewportChange, onItemChange]);

    // ---------------------------------------------------------------------------
    // Render
    // ---------------------------------------------------------------------------

    const hpx = HANDLE_PX / viewport.scale; // handle size in canvas units

    return (
        <div
            ref={rootRef}
            className={className}
            onPointerDown={onBgPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            style={{
                position: 'relative',
                overflow: 'hidden',
                width: '100%',
                height: '100%',
                cursor: 'default',
                touchAction: 'none',
                userSelect: 'none',
            }}
        >
            {/* Canvas transform layer */}
            <div
                ref={layerRef}
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    transformOrigin: '0 0',
                    transform: `translate(${viewport.x}px,${viewport.y}px) scale(${viewport.scale})`,
                    willChange: 'transform',
                }}
            >
                {items.map(item => {
                    const selected = item.id === selectedId;
                    const borderW = Math.max(1, 2 / viewport.scale);

                    return (
                        <div
                            key={item.id}
                            ref={el => {
                                if (el) itemElsRef.current.set(item.id, el);
                                else itemElsRef.current.delete(item.id);
                            }}
                            onPointerDown={e => onItemPointerDown(e, item.id)}
                            onDoubleClick={e => { e.stopPropagation(); onDoubleClick?.(item.id); }}
                            style={{
                                position: 'absolute',
                                left: item.x,
                                top: item.y,
                                width: item.width,
                                height: item.height,
                                cursor: 'grab',
                                outline: selected ? `${borderW}px solid #3b82f6` : 'none',
                                outlineOffset: `${borderW}px`,
                                borderRadius: 4 / viewport.scale,
                                overflow: 'hidden',
                            }}
                        >
                            {/* Item content */}
                            {item.isGenerating ? (
                                <div style={placeholderStyle('#0f172a', '#64748b')}>
                                    <div style={spinnerStyle(viewport.scale)} className='ic-spinner' />
                                    <span style={{ fontSize: 13 / viewport.scale }}>生成中…</span>
                                </div>
                            ) : item.isFailed ? (
                                <div style={placeholderStyle('#1a0505', '#ef4444')}>
                                    <span style={{ fontSize: 13 / viewport.scale }}>生成失败</span>
                                </div>
                            ) : item.type === 'video' && item.src ? (
                                <video
                                    src={item.src}
                                    autoPlay muted loop playsInline
                                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', pointerEvents: 'none' }}
                                />
                            ) : item.src ? (
                                <img
                                    src={item.src}
                                    alt={item.label ?? ''}
                                    draggable={false}
                                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', pointerEvents: 'none' }}
                                />
                            ) : (
                                <div style={{ width: '100%', height: '100%', background: '#1e293b' }} />
                            )}

                            {/* Resize handles (only when selected) */}
                            {selected && (['nw', 'ne', 'sw', 'se'] as const).map(h => (
                                <div
                                    key={h}
                                    onPointerDown={e => onHandlePointerDown(e, item.id, h)}
                                    style={{
                                        position: 'absolute',
                                        left: h.includes('e') ? item.width - hpx / 2 : -hpx / 2,
                                        top: h.includes('s') ? item.height - hpx / 2 : -hpx / 2,
                                        width: hpx,
                                        height: hpx,
                                        background: '#ffffff',
                                        border: `${borderW}px solid #3b82f6`,
                                        borderRadius: hpx * 0.25,
                                        cursor: `${h}-resize`,
                                        zIndex: 2,
                                        boxSizing: 'border-box',
                                    }}
                                />
                            ))}
                        </div>
                    );
                })}
            </div>

            <style>{`
                @keyframes ic-spin { to { transform: rotate(360deg); } }
                .ic-spinner { animation: ic-spin 0.9s linear infinite; }
            `}</style>
        </div>
    );
};

// ---------------------------------------------------------------------------
// Style helpers
// ---------------------------------------------------------------------------

function placeholderStyle(bg: string, color: string): React.CSSProperties {
    return {
        width: '100%', height: '100%',
        background: bg, color,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: 8, pointerEvents: 'none',
    };
}

function spinnerStyle(scale: number): React.CSSProperties {
    const sz = 22 / scale;
    return {
        width: sz, height: sz,
        border: `${2 / scale}px solid #334155`,
        borderTopColor: '#64748b',
        borderRadius: '50%',
    };
}
