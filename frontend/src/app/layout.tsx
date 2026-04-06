import type { Metadata } from 'next';
import { Inter, Space_Grotesk, Orbitron, JetBrains_Mono } from 'next/font/google';
import { Providers } from '@/providers';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space-grotesk',
  display: 'swap',
});

const orbitron = Orbitron({
  subsets: ['latin'],
  variable: '--font-orbitron',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'KAIRO DeFi | Aurora Financial Ecosystem',
  description:
    'Stake, trade, earn rewards, and grow your network with KAIRO — the next-gen DeFi protocol on opBNB.',
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${spaceGrotesk.variable} ${orbitron.variable} ${jetbrainsMono.variable} font-inter min-h-screen bg-surface-50`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
