'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { cn } from '@/lib/utils';

const navLinks = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/stake', label: 'Stake' },
  { href: '/exchange', label: 'Exchange' },
  { href: '/rank', label: 'Rank' },
];

export function Navbar() {
  const pathname = usePathname();

  const isActive = (href: string) =>
    pathname === href || (href !== '/' && pathname.startsWith(href));

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 h-16 bg-glass backdrop-blur-[20px] border-b border-glass-border">
      <div className="h-full px-4 lg:px-6 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-neon-cyan/10 border border-neon-cyan/30 flex items-center justify-center">
            <span className="font-orbitron font-bold text-sm neon-text">K</span>
          </div>
          <span className="font-orbitron text-xl font-bold neon-text hidden sm:inline">
            KAIRO DAO
          </span>
        </Link>

        {/* Desktop navigation links */}
        <div className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => {
            const active = isActive(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'relative px-4 py-2 rounded-lg text-sm font-space-grotesk font-medium transition-all duration-200',
                  active
                    ? 'text-neon-cyan'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-white/5',
                )}
              >
                {link.label}
                {active && (
                  <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4/5 h-0.5 bg-neon-cyan rounded-full shadow-[0_0_8px_rgba(0,240,255,0.6)]" />
                )}
              </Link>
            );
          })}
        </div>

        {/* Wallet connect */}
        <div className="flex items-center gap-3 shrink-0">
          <ConnectButton.Custom>
            {({
              account,
              chain,
              openAccountModal,
              openChainModal,
              openConnectModal,
              mounted,
            }) => {
              const ready = mounted;
              const connected = ready && account && chain;

              return (
                <div
                  {...(!ready && {
                    'aria-hidden': true,
                    style: {
                      opacity: 0,
                      pointerEvents: 'none',
                      userSelect: 'none',
                    },
                  })}
                >
                  {(() => {
                    if (!connected) {
                      return (
                        <button
                          onClick={openConnectModal}
                          className="px-4 py-2 rounded-xl bg-neon-cyan/10 border border-neon-cyan/30 text-neon-cyan text-sm font-medium hover:bg-neon-cyan/20 transition-all duration-200 font-space-grotesk focus-visible:ring-2 focus-visible:ring-neon-cyan/50 focus-visible:ring-offset-2 focus-visible:ring-offset-void"
                        >
                          Connect
                        </button>
                      );
                    }

                    if (chain.unsupported) {
                      return (
                        <button
                          onClick={openChainModal}
                          className="px-4 py-2 rounded-xl bg-neon-coral/10 border border-neon-coral/30 text-neon-coral text-sm font-medium hover:bg-neon-coral/20 transition-all focus-visible:ring-2 focus-visible:ring-neon-cyan/50 focus-visible:ring-offset-2 focus-visible:ring-offset-void"
                        >
                          Wrong Network
                        </button>
                      );
                    }

                    return (
                      <div className="flex items-center gap-2">
                        {/* Network indicator */}
                        <button
                          onClick={openChainModal}
                          className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/5 border border-glass-border hover:bg-white/8 transition-colors focus-visible:ring-2 focus-visible:ring-neon-cyan/50 focus-visible:ring-offset-2 focus-visible:ring-offset-void"
                        >
                          {chain.hasIcon && chain.iconUrl && (
                            <img
                              alt={chain.name ?? 'Chain'}
                              src={chain.iconUrl}
                              className="w-4 h-4 rounded-full"
                            />
                          )}
                          <span className="text-xs text-gray-400 font-medium">
                            {chain.name}
                          </span>
                        </button>

                        {/* Account pill */}
                        <button
                          onClick={openAccountModal}
                          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-glass border border-glass-border hover:border-neon-cyan/20 transition-all duration-200 focus-visible:ring-2 focus-visible:ring-neon-cyan/50 focus-visible:ring-offset-2 focus-visible:ring-offset-void"
                        >
                          <div className="w-5 h-5 rounded-full bg-gradient-to-br from-neon-cyan/40 to-neon-purple/40" />
                          <span className="text-sm text-gray-200 font-mono">
                            {account.displayName}
                          </span>
                        </button>
                      </div>
                    );
                  })()}
                </div>
              );
            }}
          </ConnectButton.Custom>
        </div>
      </div>
    </nav>
  );
}
