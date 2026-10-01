import { Bot, Check, FileJson, MapPin, PanelRightOpen } from 'lucide-react';
import type { ChatMessage as ChatMessageModel } from '@/lib/types';
import { cn, formatBytes } from '@/lib/utils';
import { AgentPlan } from './AgentPlan';

function TypingDots() {
  return (
    <span className="flex items-center gap-1 py-1" aria-label="SatQuery AI is typing">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-ink-dim"
          style={{ animation: `dot-bounce 1.2s ${i * 0.16}s infinite ease-in-out` }}
        />
      ))}
    </span>
  );
}

export function ChatMessage({
  message,
  onOpenResult,
}: {
  message: ChatMessageModel;
  onOpenResult?: () => void;
}) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end animate-fade-up">
        <div className="max-w-[86%] sm:max-w-[75%]">
          <div className="rounded-2xl rounded-br-md border border-edge-strong/50 bg-panel-raised/70 px-4 py-3">
            <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-ink">
              {message.text}
            </p>

            {(message.attachment || message.aoiLabel) && (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {message.aoiLabel && (
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-brand-500/25 bg-brand-500/[0.08] px-2 py-1 text-[11px] text-brand-200">
                    <MapPin className="h-3 w-3" />
                    {message.aoiLabel}
                  </span>
                )}
                {message.attachment && (
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-edge-strong/50 bg-black/25 px-2 py-1 text-[11px] text-ink-mute">
                    <FileJson className="h-3 w-3" />
                    {message.attachment.name}
                    <span className="text-ink-faint">
                      · {formatBytes(message.attachment.size)}
                    </span>
                  </span>
                )}
              </div>
            )}
          </div>

          <p className="mt-1.5 flex items-center justify-end gap-1.5 pr-1 text-[11px] text-ink-faint">
            {message.time}
            <Check className="h-3 w-3" strokeWidth={2.6} />
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3 animate-fade-up">
      <span className="relative mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-brand-500/25 bg-brand-500/[0.1] text-brand-300">
        <span className="absolute inset-0 -z-10 rounded-xl bg-brand-500/15 blur-md" aria-hidden />
        <Bot className="h-4 w-4" strokeWidth={1.8} />
      </span>

      <div className="min-w-0 flex-1">
        <p className="mb-1.5 text-[12.5px] font-medium text-ink-soft">SatQuery AI</p>

        <div
          className={cn(
            'max-w-[68ch] rounded-2xl rounded-tl-md border border-edge/60 bg-panel/50 px-4 py-3',
          )}
        >
          {message.pending ? (
            <TypingDots />
          ) : (
            <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-ink-soft">
              {message.text}
            </p>
          )}

          {message.variant === 'plan' && message.steps && (
            <AgentPlan title={message.planTitle} steps={message.steps} />
          )}

          {message.variant === 'result' && onOpenResult && (
            <button
              type="button"
              onClick={onOpenResult}
              className="mt-3 inline-flex items-center gap-2 rounded-lg border border-brand-500/25 bg-brand-500/[0.08] px-3 py-1.5 text-[12.5px] font-medium text-brand-200 transition-colors duration-200 hover:bg-brand-500/[0.14] xl:hidden"
            >
              <PanelRightOpen className="h-3.5 w-3.5" />
              Open result
            </button>
          )}
        </div>

        {!message.pending && (
          <p className="mt-1.5 pl-1 text-[11px] text-ink-faint">{message.time}</p>
        )}
      </div>
    </div>
  );
}
