import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Web3Provider } from '@/providers/Web3Provider';
import { Navbar } from '@/components/layout/Navbar';
import { AppProviders } from '@/providers/AppProviders';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

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
    <html lang="en" className="dark">
      <body className={`${inter.variable} font-sans antialiased`}>
        <Web3Provider>
          <AppProviders>
            <div className="min-h-screen flex flex-col">
              <Navbar />
              <main className="flex-1">{children}</main>
            </div>
          </AppProviders>
        </Web3Provider>
      </body>
    </html>
  );
}
