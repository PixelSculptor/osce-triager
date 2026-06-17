import type { Metadata } from 'next';
import { Inter, IBM_Plex_Mono } from 'next/font/google';
import { ThemeProvider } from 'next-themes';
import { Nav } from '@/shared/components/Nav';
import { SceneBg } from '@/shared/components/SceneBg';
import './globals.css';

const inter = Inter({
  subsets: ['latin', 'latin-ext'],
  display: 'swap',
  variable: '--font-sans',
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600'],
  display: 'swap',
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: 'OSCE Triager',
  description: 'Interaktywny symulator ścieżki diagnostycznej OSCE',
};

// Nav reads auth on every page; force dynamic rendering so Cloudflare's CDN
// never caches HTML carrying a logged-in state.
export const dynamic = 'force-dynamic';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang='pl'
      className={`${inter.variable} ${ibmPlexMono.variable}`}
      suppressHydrationWarning
    >
      <body>
        <ThemeProvider
          attribute='data-theme'
          defaultTheme='system'
          enableSystem
        >
          <SceneBg />
          <Nav />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
