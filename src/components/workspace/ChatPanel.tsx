import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWorkspace } from '@/state/WorkspaceContext';
import { ChatMessage } from './ChatMessage';
import { EmptyChat } from './EmptyChat';

export function ChatPanel() {
  const { state, dispatch, submitQuery } = useWorkspace();
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [atBottom, setAtBottom] = useState(true);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    bottomRef.current?.scrollIntoView({ behavior, block: 'end' });
  }, []);

  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    setAtBottom(distance < 90);
  }, []);

  useEffect(() => {
    if (atBottom) scrollToBottom(state.messages.length <= 1 ? 'auto' : 'smooth');
    // Re-run as messages stream in and as plan steps mutate.
  }, [atBottom, scrollToBottom, state.messages]);

  const empty = state.messages.length === 0;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className={cn(
          'sq-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 py-5 sm:px-6',
          empty && 'flex items-center justify-center',
        )}
        role="log"
        aria-label="Conversation with SatQuery AI"
        aria-live="polite"
      >
        {empty ? (
          <EmptyChat onSelect={submitQuery} />
        ) : (
          <div className="mx-auto flex w-full max-w-[860px] flex-col gap-6">
            {state.messages.map((message) => (
              <ChatMessage
                key={message.id}
                message={message}
                onOpenResult={() => dispatch({ type: 'set-mobile-pane', pane: 'result' })}
              />
            ))}
            <div ref={bottomRef} className="h-px" />
          </div>
        )}
      </div>

      {/* Scroll affordance */}
      <button
        type="button"
        onClick={() => scrollToBottom()}
        aria-label="Scroll to latest message"
        className={cn(
          'absolute bottom-3 left-1/2 z-10 flex h-8 w-8 -translate-x-1/2 items-center justify-center',
          'rounded-full border border-edge-strong/60 bg-[#0A1720]/90 text-ink-mute shadow-lift backdrop-blur',
          'transition-all duration-300 ease-premium hover:text-ink',
          atBottom || empty
            ? 'pointer-events-none translate-y-2 opacity-0'
            : 'translate-y-0 opacity-100',
        )}
      >
        <ChevronDown className="h-4 w-4" />
      </button>
    </div>
  );
}
