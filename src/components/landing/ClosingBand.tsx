import { useNavigate } from 'react-router-dom';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export function ClosingBand() {
  const navigate = useNavigate();

  return (
    <section id="about" className="mx-auto w-full max-w-[1240px] scroll-mt-24 px-5 sm:px-8">
      <div className="sq-panel flex flex-col items-start gap-6 rounded-3xl px-6 py-7 sm:flex-row sm:items-center sm:justify-between sm:px-9">
        <div className="flex items-start gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-brand-500/25 bg-brand-500/[0.09] text-brand-300">
            <ShieldCheck className="h-5 w-5" strokeWidth={1.7} />
          </span>
          <p className="max-w-[560px] text-[14px] leading-relaxed text-ink-soft text-pretty">
            Built for researchers, planners, analysts and change-makers who need to understand our
            planet better — and need to see how the answer was reached.
          </p>
        </div>

        <Button
          variant="secondary"
          onClick={() => navigate('/workspace')}
          rightIcon={<ArrowRight className="h-4 w-4" />}
          className="shrink-0"
        >
          Explore Use Cases
        </Button>
      </div>
    </section>
  );
}
