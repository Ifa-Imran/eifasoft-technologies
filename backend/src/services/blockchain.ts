import { ethers, JsonRpcProvider, WebSocketProvider, Contract } from 'ethers';
import { config } from '../config';
import {
    StakingManagerABI,
    AffiliateDistributorABI,
    CoreMembershipSubscriptionABI,
    AtomicP2pABI,
    KAIROTokenABI,
    LiquidityPoolABI,
} from '../abis';

// ============ Providers ============

let httpProvider: JsonRpcProvider;
let wsProvider: WebSocketProvider | null = null;

/**
 * Initialize blockchain providers
 */
export function initProviders(): void {
    httpProvider = new JsonRpcProvider(config.rpcUrl, config.chainId);

    // Only initialize WsProvider if contracts are configured (indexer needs it)
    if (config.rpcWsUrl && areContractsConfigured()) {
        try {
            wsProvider = new WebSocketProvider(config.rpcWsUrl, config.chainId);
            console.log('WebSocket provider initialized');
        } catch (err) {
            console.warn('WebSocket provider failed to initialize, falling back to HTTP polling:', err);
            wsProvider = null;
        }
    }

    console.log('Blockchain providers initialized (chainId:', config.chainId, ')');
}

/**
 * Get the HTTP JSON-RPC provider
 */
export function getHttpProvider(): JsonRpcProvider {
    if (!httpProvider) {
        initProviders();
    }
    return httpProvider;
}

/**
 * Get the WebSocket provider (if available)
 */
export function getWsProvider(): WebSocketProvider | null {
    return wsProvider;
}

// ============ Contract Instances ============

/**
 * Check if all required contract addresses are configured
 */
export function areContractsConfigured(): boolean {
    const c = config.contracts;
    return !!(c.kairoToken && c.liquidityPool && c.stakingManager && c.affiliateDistributor && c.cms && c.atomicP2p);
}

export function getStakingManager(): Contract | null {
    if (!config.contracts.stakingManager) return null;
    return new Contract(config.contracts.stakingManager, StakingManagerABI, getHttpProvider());
}

export function getAffiliateDistributor(): Contract | null {
    if (!config.contracts.affiliateDistributor) return null;
    return new Contract(config.contracts.affiliateDistributor, AffiliateDistributorABI, getHttpProvider());
}

export function getCMS(): Contract | null {
    if (!config.contracts.cms) return null;
    return new Contract(config.contracts.cms, CoreMembershipSubscriptionABI, getHttpProvider());
}

export function getAtomicP2p(): Contract | null {
    if (!config.contracts.atomicP2p) return null;
    return new Contract(config.contracts.atomicP2p, AtomicP2pABI, getHttpProvider());
}

export function getKAIROToken(): Contract | null {
    if (!config.contracts.kairoToken) return null;
    return new Contract(config.contracts.kairoToken, KAIROTokenABI, getHttpProvider());
}

export function getLiquidityPool(): Contract | null {
    if (!config.contracts.liquidityPool) return null;
    return new Contract(config.contracts.liquidityPool, LiquidityPoolABI, getHttpProvider());
}

/**
 * Get contracts connected to the WebSocket provider for event listening
 */
export function getWsContracts(): { stakingManager: Contract; affiliateDistributor: Contract; cms: Contract; atomicP2p: Contract } | null {
    if (!areContractsConfigured()) return null;
    const provider = wsProvider || getHttpProvider();

    return {
        stakingManager: new Contract(config.contracts.stakingManager, StakingManagerABI, provider),
        affiliateDistributor: new Contract(config.contracts.affiliateDistributor, AffiliateDistributorABI, provider),
        cms: new Contract(config.contracts.cms, CoreMembershipSubscriptionABI, provider),
        atomicP2p: new Contract(config.contracts.atomicP2p, AtomicP2pABI, provider),
    };
}

/**
 * Get current block number
 */
export async function getCurrentBlock(): Promise<number> {
    return getHttpProvider().getBlockNumber();
}

/**
 * Get live KAIRO price from LiquidityPool
 */
export async function getLivePrice(): Promise<bigint> {
    const liquidityPool = getLiquidityPool();
    if (!liquidityPool) return BigInt(0);
    try {
        return await liquidityPool.getCurrentPrice();
    } catch {
        try {
            return await liquidityPool.getLivePrice();
        } catch {
            console.warn('Failed to fetch live price from LiquidityPool');
            return BigInt(0);
        }
    }
}
