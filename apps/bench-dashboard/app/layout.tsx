import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'Flare Benchmarks',
  description: 'Performance dashboard for the Flare engine',
};

const NAV_LINKS = [
  { href: '/', label: 'Overview' },
  { href: '/micro', label: 'Microbench' },
  { href: '/integration', label: 'Integration' },
  { href: '/device', label: 'Device' },
] as const;

type LayoutProps = { children: ReactNode };

export default function RootLayout({ children }: LayoutProps) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#0a0e1a] text-slate-200 antialiased">
        <header className="sticky top-0 z-50 border-b border-slate-800 bg-[#0a0e1a]/90 backdrop-blur">
          <nav className="max-w-6xl mx-auto px-4 h-12 flex items-center gap-1">
            <span className="font-mono text-amber-300 font-semibold mr-4 text-sm">flare/bench</span>
            {NAV_LINKS.map(({ href, label }) => (
              <a
                key={href}
                href={href}
                className="px-3 py-1.5 rounded text-sm text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
              >
                {label}
              </a>
            ))}
          </nav>
        </header>
        <main className="max-w-6xl mx-auto px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
