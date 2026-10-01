import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/Badge';

export function ViewShell({
  title,
  description,
  actions,
  children,
  demoNote = true,
}: {
  title: string;
  description: string;
  actions?: ReactNode;
  children: ReactNode;
  demoNote?: boolean;
}) {
  return (
    <div className="sq-scroll min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-[1080px] px-5 py-7 sm:px-8 sm:py-9">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-[560px]">
            <div className="flex items-center gap-2.5">
              <h2 className="text-[19px] font-semibold tracking-[-0.02em] text-ink">{title}</h2>
              {demoNote && (
                <Badge tone="neutral" className="font-mono uppercase tracking-wider">
                  Demo data
                </Badge>
              )}
            </div>
            <p className="mt-2 text-[13.5px] leading-relaxed text-ink-mute text-pretty">
              {description}
            </p>
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>

        <div className="mt-8 animate-fade-up">{children}</div>
      </div>
    </div>
  );
}
