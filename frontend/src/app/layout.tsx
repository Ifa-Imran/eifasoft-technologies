import type { Metadata } from 'next';
import { Inter, Orbitron, Space_Grotesk, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { Web3Provider } from '@/providers/Web3Provider';
import { Navbar } from '@/components/layout/Navbar';
import { AppProviders } from '@/providers/AppProviders';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const orbitron = Orbitron({ subsets: ['latin'], variable: '--font-orbitron', display: 'swap' });
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-space-grotesk', display: 'swap' });
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono', display: 'swap' });

export const metadata: Metadata = {
  title: 'KAIRO DeFi - Next-Gen Staking & P2P Exchange on opBNB',
  description: 'KAIRO DeFi ecosystem featuring 3X capped staking, 5-level referral rewards, CMS subscriptions, and atomic P2P trading on opBNB chain.',
  icons: { icon: '/favicon.ico' },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`dark ${inter.variable} ${orbitron.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable}`}>
      <body className="font-inter antialiased">
        <Web3Provider>
          <AppProviders>
            <div className="min-h-screen flex flex-col bg-void">
              <Navbar />
              <main className="flex-1 pt-16">{children}</main>
            </div>
          </AppProviders>
        </Web3Provider>
      </body>
    </html>
  );
}
