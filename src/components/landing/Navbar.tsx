import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { Logo } from '@/components/brand/Logo';
import { Button, IconButton } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

const NAV_LINKS = [
  { label: 'Features', id: 'features' },
  { label: 'Use Cases', id: 'use-cases' },
  { label: 'How It Works', id: 'how-it-works' },
  { label: 'About', id: 'about' },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Highlight whichever section is currently under the header.
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return undefined;
    const sections = NAV_LINKS.map((l) => document.getElementById(l.id)).filter(
      (el): el is HTMLElement => Boolean(el),
    );
    if (sections.length === 0) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setActive(visible.target.id);
      },
      { rootMargin: '-30% 0px -55% 0px', threshold: [0, 0.2, 0.5] },
    );
    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, []);

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-50 transition-all duration-300 ease-premium',
        scrolled
          ? 'border-b border-edge/60 bg-void/85 backdrop-blur-xl'
          : 'border-b border-transparent',
      )}
    >
      <nav
        className="mx-auto flex h-[72px] w-full max-w-[1200px] items-center justify-between gap-6 px-5 sm:px-8"
        aria-label="Main"
      >
        <Link to="/" className="shrink-0 rounded-lg" aria-label="SatQuery AI home">
          <Logo />
        </Link>

        <ul className="hidden items-center gap-0.5 lg:flex">
          {NAV_LINKS.map((link) => (
            <li key={link.id}>
              <a
                href={`#${link.id}`}
                aria-current={active === link.id ? 'true' : undefined}
                className={cn(
                  'relative rounded-lg px-3.5 py-2 text-[13.5px] font-medium transition-colors duration-200',
                  active === link.id ? 'text-ink' : 'text-ink-mute hover:text-ink-soft',
                )}
              >
                {link.label}
                <span
                  className={cn(
                    'absolute inset-x-3.5 -bottom-0.5 h-px rounded-full bg-brand-400/70 transition-all duration-300 ease-premium',
                    active === link.id ? 'opacity-100' : 'opacity-0',
                  )}
                  aria-hidden
                />
              </a>
            </li>
          ))}
        </ul>

        <div className="hidden items-center gap-2 sm:flex">
          <Link to="/workspace">
            <Button variant="ghost" size="sm">
              Log in
            </Button>
          </Link>
          <Link to="/workspace">
            <Button variant="primary" size="sm">
              Sign Up
            </Button>
          </Link>
        </div>

        <IconButton
          label={open ? 'Close menu' : 'Open menu'}
          className="sm:hidden"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </IconButton>
      </nav>

      {open && (
        <div className="border-t border-edge/70 bg-void/95 px-5 pb-5 pt-3 backdrop-blur-xl sm:hidden">
          <ul className="flex flex-col">
            {NAV_LINKS.map((link) => (
              <li key={link.id}>
                <a
                  href={`#${link.id}`}
                  onClick={() => setOpen(false)}
                  className="block rounded-lg px-2 py-3 text-sm font-medium text-ink-soft hover:text-ink"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex gap-2">
            <Link to="/workspace" className="flex-1">
              <Button variant="secondary" block>
                Log in
              </Button>
            </Link>
            <Link to="/workspace" className="flex-1">
              <Button variant="primary" block>
                Sign Up
              </Button>
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
