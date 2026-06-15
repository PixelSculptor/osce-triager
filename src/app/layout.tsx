import type { Metadata } from 'next';
import { Inter, IBM_Plex_Mono } from 'next/font/google';
import { ThemeProvider } from 'next-themes';
import { Nav } from '@/shared/components/Nav';
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
          <Nav />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
