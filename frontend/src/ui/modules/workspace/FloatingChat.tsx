import React, { KeyboardEvent, useEffect, useRef, useState } from 'react';
import type { IWorkspaceComposerReference, IWorkspaceConversation } from '../../../types/workspace';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ChatMode = 'agent' | 'image' | 'video';

export interface FloatingChatProps {
    activeConversation:        IWorkspaceConversation;
    loading:                   boolean;
    onSubmit:                  (mode: ChatMode) => void;
    onComposerTextChange:      (text: string) => void;
    onComposerReferenceChange: (ref: IWorkspaceComposerReference | null) => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PANEL_W  = 600;
const PANEL_H  = 1000;
const TITLE_H  = 32;
const BUBBLE   = 40;

const MODE_OPTIONS: { value: ChatMode; label: string }[] = [
    { value: 'agent', label: 'Agent'  },
    { value: 'image', label: '生成图片' },
    { value: 'video', label: '生成视频' },
];

// ---------------------------------------------------------------------------
// Drag state
// ---------------------------------------------------------------------------

interface DragState {
    startPx: number;
    startPy: number;
    origX:   number;
    origY:   number;
}

// ---------------------------------------------------------------------------
// Custom Mode Dropdown
// ---------------------------------------------------------------------------

interface ModeDropdownProps {
    value:    ChatMode;
    onChange: (v: ChatMode) => void;
}

const ModeDropdown: React.FC<ModeDropdownProps> = ({ value, onChange }) => {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    const current = MODE_OPTIONS.find(o => o.value === value)!;

    // Close on outside click
    useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    return (
        <div className='fc-dropdown' ref={ref}>
            {/* Trigger */}
            <button
                className={`fc-dropdown-trigger ${open ? 'fc-dropdown-trigger-open' : ''}`}
                onClick={() => setOpen(o => !o)}
                type='button'
            >
                <span className='fc-dropdown-trigger-label'>{current.label}</span>
                <svg
                    className={`fc-dropdown-arrow ${open ? 'fc-dropdown-arrow-up' : ''}`}
                    width='10' height='10' viewBox='0 0 10 10' fill='none'
                    aria-hidden='true'
                >
                    <path d='M2 3.5l3 3 3-3' stroke='currentColor' strokeWidth='1.5'
                        strokeLinecap='round' strokeLinejoin='round' />
                </svg>
            </button>

            {/* Options panel — opens upward */}
            {open && (
                <div className='fc-dropdown-menu'>
                    {MODE_OPTIONS.map(opt => (
                        <button
                            key={opt.value}
                            className={`fc-dropdown-item ${opt.value === value ? 'fc-dropdown-item-active' : ''}`}
                            onClick={() => { onChange(opt.value); setOpen(false); }}
                            type='button'
                        >
                            <span className='fc-dropdown-item-label'>{opt.label}</span>
                            {opt.value === value && (
                                <svg className='fc-dropdown-item-check' width='14' height='14'
                                    viewBox='0 0 14 14' fill='none' aria-hidden='true'>
                                    <path d='M2.5 7l3 3 6-6' stroke='currentColor'
                                        strokeWidth='1.6' strokeLinecap='round' strokeLinejoin='round' />
                                </svg>
                            )}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export const FloatingChat: React.FC<FloatingChatProps> = ({
    activeConversation,
    loading,
    onSubmit,
    onComposerTextChange,
    onComposerReferenceChange,
}) => {
    const [mode, setMode]           = useState<ChatMode>('agent');
    const [minimized, setMinimized] = useState(false);
    const [pos, setPos]             = useState<{ x: number; y: number }>(() => ({
        x: Math.max(40, (typeof window !== 'undefined' ? window.innerWidth : 1200) - PANEL_W - 40),
        y: 40,
    }));
    const dragRef = useRef<DragState | null>(null);

    // ── Drag ────────────────────────────────────────────────────────────────

    const onTitlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        if ((e.target as Element).closest('[data-fc-action]')) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        dragRef.current = { startPx: e.clientX, startPy: e.clientY, origX: pos.x, origY: pos.y };
    };

    const onPointerMove = (e: React.PointerEvent) => {
        const d = dragRef.current;
        if (!d) return;
        setPos({ x: d.origX + e.clientX - d.startPx, y: d.origY + e.clientY - d.startPy });
    };

    const onPointerUp = () => { dragRef.current = null; };

    // ── Keyboard ────────────────────────────────────────────────────────────

    const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (!loading && activeConversation.composerText.trim()) {
                onSubmit(mode);
            }
        }
    };

    // ── Minimized bubble ────────────────────────────────────────────────────

    if (minimized) {
        return (
            <button
                className='fc-bubble'
                style={{ left: pos.x + PANEL_W - BUBBLE, top: pos.y + PANEL_H - BUBBLE }}
                onClick={() => setMinimized(false)}
                aria-label='展开对话框'
                type='button'
            >
                <svg width='16' height='16' viewBox='0 0 16 16' fill='none' aria-hidden='true'>
                    <path d='M8 12V4M4 8l4-4 4 4' stroke='currentColor' strokeWidth='1.6'
                        strokeLinecap='round' strokeLinejoin='round' />
                </svg>
            </button>
        );
    }

    // ── Full panel ──────────────────────────────────────────────────────────

    const hasRef  = Boolean(activeConversation.composerReference);
    const canSend = !loading && activeConversation.composerText.trim().length > 0;

    return (
        <div
            className='fc-panel'
            style={{ left: pos.x, top: pos.y, width: PANEL_W, height: PANEL_H }}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
        >
            {/* ── Title bar ── */}
            <div
                className='fc-titlebar'
                style={{ height: TITLE_H }}
                onPointerDown={onTitlePointerDown}
            >
                <span className='fc-titlebar-label'>Workspace</span>
                <button
                    className='fc-minimize-btn'
                    data-fc-action='minimize'
                    onClick={() => setMinimized(true)}
                    aria-label='最小化'
                    type='button'
                >
                    <svg width='10' height='10' viewBox='0 0 10 10' fill='none' aria-hidden='true'>
                        <rect x='1' y='4.25' width='8' height='1.5' rx='0.75' fill='currentColor' />
                    </svg>
                </button>
            </div>

            {/* ── Spacer (top blank area) ── */}
            <div className='fc-spacer' />

            {/* ── Composer box ── */}
            <div className='fc-composer'>

                {/* Reference chip */}
                {hasRef && (
                    <div className='fc-ref-chip'>
                        <span className='fc-ref-chip-label'>
                            @ {activeConversation.composerReference!.name}
                        </span>
                        <button
                            className='fc-ref-chip-remove'
                            onClick={() => onComposerReferenceChange(null)}
                            aria-label='移除引用'
                            type='button'
                        >
                            <svg width='8' height='8' viewBox='0 0 8 8' fill='none'>
                                <path d='M1 1l6 6M7 1L1 7' stroke='currentColor'
                                    strokeWidth='1.4' strokeLinecap='round' />
                            </svg>
                        </button>
                    </div>
                )}

                {/* Textarea */}
                <textarea
                    className='fc-textarea'
                    value={activeConversation.composerText}
                    onChange={(e) => onComposerTextChange(e.target.value)}
                    onKeyDown={onKeyDown}
                    placeholder='描述你想要创作的内容…'
                    rows={4}
                />

                {/* Bottom control row */}
                <div className='fc-bottom-row'>
                    <ModeDropdown value={mode} onChange={setMode} />

                    {/* Send button */}
                    <button
                        className={`fc-send-btn ${canSend ? 'fc-send-btn-active' : ''}`}
                        disabled={!canSend}
                        onClick={() => onSubmit(mode)}
                        aria-label='发送'
                        type='button'
                    >
                        <svg width='16' height='16' viewBox='0 0 16 16' fill='none' aria-hidden='true'>
                            <path d='M8 12V4M4 8l4-4 4 4' stroke='currentColor' strokeWidth='1.8'
                                strokeLinecap='round' strokeLinejoin='round' />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    );
};
