import { http, createConfig } from 'wagmi';
import { defineChain } from 'viem';
import { getDefaultConfig } from '@rainbow-me/rainbowkit';

export const opBNBMainnet = defineChain({
  id: 204,
  name: 'opBNB',
  nativeCurrency: {
    name: 'BNB',
    symbol: 'BNB',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ['https://opbnb-mainnet-rpc.bnbchain.org'],
    },
  },
  blockExplorers: {
    default: {
      name: 'opBNBScan',
      url: 'https://opbnb.bscscan.com',
    },
  },
  contracts: {
    multicall3: {
      address: '0xcA11bde05977b3631167028862bE2a173976CA11',
    },
  },
  testnet: false,
});

export const config = getDefaultConfig({
  appName: 'KAIRO DAO',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'd9fddb48789291a159e8270ef32105c2',
  chains: [opBNBMainnet],
  transports: {
    [opBNBMainnet.id]: http('https://opbnb-mainnet-rpc.bnbchain.org'),
  },
  ssr: true,
});
