import { http, createConfig } from 'wagmi';
import { defineChain } from 'viem';
import { getDefaultConfig } from '@rainbow-me/rainbowkit';

export const opBNBTestnet = defineChain({
  id: 5611,
  name: 'opBNB Testnet',
  nativeCurrency: {
    name: 'tBNB',
    symbol: 'tBNB',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ['https://opbnb-testnet-rpc.bnbchain.org'],
    },
  },
  blockExplorers: {
    default: {
      name: 'opBNBScan',
      url: 'https://testnet.opbnbscan.com',
    },
  },
  testnet: true,
});

export const config = getDefaultConfig({
  appName: 'KAIRO DeFi',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'd9fddb48789291a159e8270ef32105c2',
  chains: [opBNBTestnet],
  transports: {
    [opBNBTestnet.id]: http('https://opbnb-testnet-rpc.bnbchain.org'),
  },
  ssr: true,
});
