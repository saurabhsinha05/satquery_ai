import { Link } from 'react-router-dom';
import { Logo } from '@/components/brand/Logo';

export function Footer() {
  return (
    <footer className="border-t border-edge/60">
      <div className="mx-auto w-full max-w-[1200px] px-5 py-12 sm:px-8">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-[380px]">
            <Logo />
            <p className="mt-5 text-[13px] leading-relaxed text-ink-dim text-pretty">
              An agentic geospatial intelligence platform. Frontend prototype — every analysis
              you see is generated locally as illustrative demo content.
            </p>
          </div>

          <nav className="grid grid-cols-2 gap-x-12 gap-y-2 text-[13px] sm:gap-x-16" aria-label="Footer">
            <a href="#features" className="rounded py-1 text-ink-mute transition-colors hover:text-ink">
              Features
            </a>
            <a href="#use-cases" className="rounded py-1 text-ink-mute transition-colors hover:text-ink">
              Use Cases
            </a>
            <a
              href="#how-it-works"
              className="rounded py-1 text-ink-mute transition-colors hover:text-ink"
            >
              How It Works
            </a>
            <a href="#about" className="rounded py-1 text-ink-mute transition-colors hover:text-ink">
              About
            </a>
            <Link to="/workspace" className="rounded py-1 text-ink-mute transition-colors hover:text-ink">
              Workspace
            </Link>
            <Link
              to="/workspace?demo=1"
              className="rounded py-1 text-ink-mute transition-colors hover:text-ink"
            >
              Live Demo
            </Link>
          </nav>
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t border-edge/50 pt-6 text-[12px] text-ink-faint sm:flex-row sm:items-center sm:justify-between">
          <p>SatQuery AI — prototype built for Smart India Hackathon 2026.</p>
          <p>Demo build · no backend, no external services, no API keys.</p>
        </div>
      </div>
    </footer>
  );
}
