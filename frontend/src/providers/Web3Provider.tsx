'use client';

import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { config } from '@/lib/wagmi';
import '@rainbow-me/rainbowkit/styles.css';
import { useState } from 'react';

const customTheme = darkTheme({
  accentColor: '#00F0FF',
  accentColorForeground: '#050507',
  borderRadius: 'medium',
  fontStack: 'system',
  overlayBlur: 'small',
});

customTheme.colors.modalBackground = '#0A0A0F';
customTheme.colors.modalBorder = 'rgba(255, 255, 255, 0.08)';
customTheme.colors.profileForeground = '#0A0A0F';
customTheme.colors.connectButtonBackground = '#0A0A0F';
customTheme.colors.connectButtonInnerBackground = 'rgba(10, 10, 15, 0.6)';

export function Web3Provider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 1000,
        refetchOnWindowFocus: false,
      },
    },
  }));

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={customTheme}>
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
