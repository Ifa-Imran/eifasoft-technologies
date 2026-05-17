import { http } from 'wagmi';
import { defineChain } from 'viem';
import { getDefaultConfig } from '@rainbow-me/rainbowkit';

// Chain selection is driven by NEXT_PUBLIC_CHAIN_ID. Defaults to opBNB mainnet (204).
const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID || 204);
const IS_TESTNET = CHAIN_ID === 5611;

const RPC_HTTP =
  process.env.NEXT_PUBLIC_RPC_URL ||
  (IS_TESTNET
    ? 'https://opbnb-testnet-rpc.bnbchain.org'
    : 'https://opbnb-mainnet-rpc.bnbchain.org');

const EXPLORER =
  process.env.NEXT_PUBLIC_EXPLORER_URL ||
  (IS_TESTNET ? 'https://opbnb-testnet.bscscan.com' : 'https://opbnb.bscscan.com');

export const opBNBMainnet = defineChain({
  id: 204,
  name: 'opBNB',
  nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
  rpcUrls: { default: { http: ['https://opbnb-mainnet-rpc.bnbchain.org'] } },
  blockExplorers: {
    default: { name: 'opBNBScan', url: 'https://opbnb.bscscan.com' },
  },
  contracts: {
    multicall3: { address: '0xcA11bde05977b3631167028862bE2a173976CA11' },
  },
  testnet: false,
});

export const opBNBTestnet = defineChain({
  id: 5611,
  name: 'opBNB Testnet',
  nativeCurrency: { name: 'tBNB', symbol: 'tBNB', decimals: 18 },
  rpcUrls: { default: { http: ['https://opbnb-testnet-rpc.bnbchain.org'] } },
  blockExplorers: {
    default: { name: 'opBNB Testnet Scan', url: 'https://opbnb-testnet.bscscan.com' },
  },
  contracts: {
    multicall3: { address: '0xcA11bde05977b3631167028862bE2a173976CA11' },
  },
  testnet: true,
});

export const activeChain = IS_TESTNET ? opBNBTestnet : opBNBMainnet;

const chainWithRpc = {
  ...activeChain,
  rpcUrls: { default: { http: [RPC_HTTP] } },
  blockExplorers: {
    default: { name: activeChain.blockExplorers.default.name, url: EXPLORER },
  },
} as const;

export const config = getDefaultConfig({
  appName: IS_TESTNET ? 'KAIRO DAO (Testnet)' : 'KAIRO DAO',
  projectId:
    process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ||
    'd9fddb48789291a159e8270ef32105c2',
  chains: [chainWithRpc],
  transports: { [chainWithRpc.id]: http(RPC_HTTP) },
  ssr: true,
});
