import { useEffect, useRef, useState } from 'react';
import { LayoutList, Mic, PencilRuler, SendHorizontal, Square, Upload, X } from 'lucide-react';
import { IconButton } from '@/components/ui/Button';
import { Tooltip } from '@/components/ui/Tooltip';
import { cn, formatBytes } from '@/lib/utils';
import { useWorkspace } from '@/state/WorkspaceContext';

const MAX_HEIGHT = 168;

export function ChatInput({
  onOpenExamples,
  onOpenDraw,
  onOpenUpload,
}: {
  onOpenExamples: () => void;
  onOpenDraw: () => void;
  onOpenUpload: () => void;
}) {
  const { state, dispatch, submitQuery, isBusy, showToast } = useWorkspace();
  const [value, setValue] = useState('');
  const [listening, setListening] = useState(false);
  const [focused, setFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const listenTimer = useRef<number | undefined>(undefined);

  // Grow with content, then scroll.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`;
    el.style.overflowY = el.scrollHeight > MAX_HEIGHT ? 'auto' : 'hidden';
  }, [value]);

  useEffect(() => () => window.clearTimeout(listenTimer.current), []);

  const send = () => {
    const text = value.trim();
    if (!text || isBusy) return;
    submitQuery(text);
    setValue('');
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const toggleListening = () => {
    if (listening) {
      window.clearTimeout(listenTimer.current);
      setListening(false);
      return;
    }
    setListening(true);
    showToast('Voice capture is simulated in this build', 'info');
    // Deterministic "transcription" — no microphone, no speech service.
    listenTimer.current = window.setTimeout(() => {
      setListening(false);
      setValue('Show me urban expansion around Ranchi from 2021 to 2026.');
      textareaRef.current?.focus();
    }, 2200);
  };

  const canSend = value.trim().length > 0 && !isBusy;

  return (
    <div className="px-4 pb-3 pt-2 sm:px-6">
      <div className="mx-auto w-full max-w-[860px]">
        {/* Suggestion chips */}
        {state.suggestions.length > 0 && !isBusy && (
          <div className="mb-2.5 flex flex-wrap gap-2">
            {state.suggestions.map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => submitQuery(chip)}
                className="rounded-full border border-edge/70 bg-panel/50 px-3 py-1.5 text-[12px] text-ink-mute transition-all duration-200 ease-premium hover:border-brand-500/30 hover:bg-brand-500/[0.07] hover:text-brand-200"
              >
                {chip}
              </button>
            ))}
          </div>
        )}

        {/* Pending context chips */}
        {(state.attachment || state.aoiLabel) && (
          <div className="mb-2.5 flex flex-wrap gap-2">
            {state.aoiLabel && (
              <span className="inline-flex items-center gap-2 rounded-lg border border-brand-500/25 bg-brand-500/[0.08] px-2.5 py-1.5 text-[12px] text-brand-200">
                <PencilRuler className="h-3.5 w-3.5" />
                {state.aoiLabel}
                <button
                  type="button"
                  onClick={() => dispatch({ type: 'set-aoi-label', label: null })}
                  aria-label="Remove selected area"
                  className="rounded p-0.5 text-brand-300/70 transition-colors hover:text-brand-200"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
            {state.attachment && (
              <span className="inline-flex items-center gap-2 rounded-lg border border-edge-strong/60 bg-panel-raised/60 px-2.5 py-1.5 text-[12px] text-ink-soft">
                <Upload className="h-3.5 w-3.5 text-ink-dim" />
                {state.attachment.name}
                <span className="text-ink-faint">· {formatBytes(state.attachment.size)}</span>
                <button
                  type="button"
                  onClick={() => dispatch({ type: 'set-attachment', attachment: null })}
                  aria-label="Remove attached file"
                  className="rounded p-0.5 text-ink-dim transition-colors hover:text-ink"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
          </div>
        )}

        <div
          className={cn(
            'rounded-2xl border bg-panel/70 backdrop-blur-xl transition-all duration-300 ease-premium',
            focused
              ? 'border-brand-500/45 shadow-[0_0_0_1px_rgba(18,185,129,0.16),0_18px_46px_-26px_rgba(18,185,129,0.5)]'
              : 'border-edge-strong/55',
          )}
        >
          <div className="flex items-end gap-2 px-3 pt-3 sm:px-4">
            <label htmlFor="sq-chat-input" className="sr-only">
              Ask your question
            </label>
            <textarea
              id="sq-chat-input"
              ref={textareaRef}
              rows={1}
              value={value}
              disabled={isBusy}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={onKeyDown}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder={listening ? 'Listening…' : 'Ask your question...'}
              className={cn(
                'sq-scroll min-h-[26px] flex-1 resize-none bg-transparent py-1 text-[14px] leading-relaxed',
                'text-ink placeholder:text-ink-faint focus:outline-none disabled:opacity-60',
              )}
            />

            <button
              type="button"
              onClick={send}
              disabled={!canSend}
              aria-label="Send question"
              className={cn(
                'mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
                'transition-all duration-200 ease-premium',
                canSend
                  ? 'bg-brand-sheen text-[#04120C] hover:shadow-glow-sm hover:brightness-110'
                  : 'border border-edge-strong/50 bg-white/[0.03] text-ink-faint',
              )}
            >
              <SendHorizontal className="h-4 w-4" strokeWidth={2} />
            </button>
          </div>

          <div className="flex items-center gap-1 px-2 pb-2 pt-1.5 sm:px-3">
            <ToolButton icon={LayoutList} label="Examples" onClick={onOpenExamples} />
            <ToolButton icon={PencilRuler} label="Draw on Map" onClick={onOpenDraw} />
            <ToolButton
              icon={Upload}
              label="Upload Area"
              hint="(KML/GeoJSON)"
              onClick={onOpenUpload}
            />

            <div className="ml-auto flex items-center gap-1.5">
              {listening && (
                <span className="flex items-center gap-[3px]" aria-hidden>
                  {[0, 1, 2, 3].map((i) => (
                    <span
                      key={i}
                      className="w-[2px] rounded-full bg-brand-400"
                      style={{
                        height: `${6 + (i % 2) * 6}px`,
                        animation: `dot-bounce 0.8s ${i * 0.1}s infinite ease-in-out`,
                      }}
                    />
                  ))}
                </span>
              )}
              <Tooltip label={listening ? 'Stop (simulated)' : 'Voice input (simulated)'} side="top">
                <IconButton
                  label={listening ? 'Stop voice input' : 'Start voice input'}
                  size="sm"
                  active={listening}
                  onClick={toggleListening}
                >
                  {listening ? <Square className="h-3 w-3 fill-current" /> : <Mic className="h-4 w-4" />}
                </IconButton>
              </Tooltip>
            </div>
          </div>
        </div>

        <p className="mt-2.5 text-center text-[11px] text-ink-faint">
          SatQuery AI can make mistakes. Verify important results.
        </p>
      </div>
    </div>
  );
}

function ToolButton({
  icon: Icon,
  label,
  hint,
  onClick,
}: {
  icon: typeof Upload;
  label: string;
  hint?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[12px] text-ink-mute transition-colors duration-200 hover:bg-white/[0.05] hover:text-ink-soft"
    >
      <Icon className="h-3.5 w-3.5" strokeWidth={1.8} />
      <span className="hidden sm:inline">{label}</span>
      {hint && <span className="hidden text-ink-faint md:inline">{hint}</span>}
    </button>
  );
}
