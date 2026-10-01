import { EXAMPLE_PROMPTS } from '@/lib/demoAgent';
import { ExamplePrompt } from './ExamplePrompt';

export function EmptyChat({ onSelect }: { onSelect: (query: string) => void }) {
  return (
    <div className="mx-auto flex w-full max-w-[760px] flex-col items-center px-1 py-6 text-center">
      <h2 className="text-[clamp(1.5rem,3.4vw,2rem)] font-semibold tracking-[-0.02em] animate-fade-up">
        Ask anything about <span className="text-brand-400">Earth.</span>
      </h2>
      <p className="mt-3 max-w-[440px] text-[13.5px] leading-relaxed text-ink-mute text-pretty animate-fade-up [animation-delay:60ms]">
        Your AI agent will understand, analyze and deliver insights.
      </p>

      <div className="mt-9 grid w-full gap-2.5 sm:grid-cols-2">
        {EXAMPLE_PROMPTS.map((prompt, index) => (
          <ExamplePrompt
            key={prompt.label}
            label={prompt.label}
            hint={prompt.hint}
            kind={prompt.kind}
            index={index}
            onSelect={onSelect}
          />
        ))}
      </div>

      <p className="mt-8 max-w-[460px] text-[11.5px] leading-relaxed text-ink-faint animate-fade-up [animation-delay:400ms]">
        This build runs entirely in your browser. Analyses are simulated locally and clearly
        labelled — nothing is sent to a server.
      </p>
    </div>
  );
}
