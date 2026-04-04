'use client';

import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { useAccount } from 'wagmi';
import { CONTRACTS, P2PEscrowABI } from '@/lib/contracts';

export function useP2P() {
  const { address } = useAccount();
  const { writeContract, data: txHash, isPending: isWritePending } = useWriteContract();
  const { isLoading: isConfirming } = useWaitForTransactionReceipt({ hash: txHash });

  // Read order book stats
  const { data: orderBookStats, refetch: refetchStats } = useReadContract({
    address: CONTRACTS.P2P_ESCROW,
    abi: P2PEscrowABI,
    functionName: 'getOrderBookStats',
    query: {
      enabled: !!CONTRACTS.P2P_ESCROW,
      refetchInterval: 10_000,
    },
  });

  // Read current price
  const { data: currentPrice } = useReadContract({
    address: CONTRACTS.P2P_ESCROW,
    abi: P2PEscrowABI,
    functionName: 'getCurrentPrice',
    query: {
      enabled: !!CONTRACTS.P2P_ESCROW,
      refetchInterval: 15_000,
    },
  });

  // Read active buy orders
  const { data: activeBuyOrders, refetch: refetchBuyOrders } = useReadContract({
    address: CONTRACTS.P2P_ESCROW,
    abi: P2PEscrowABI,
    functionName: 'getActiveBuyOrders',
    args: [BigInt(0), BigInt(20)],
    query: {
      enabled: !!CONTRACTS.P2P_ESCROW,
      refetchInterval: 10_000,
    },
  });

  // Read active sell orders
  const { data: activeSellOrders, refetch: refetchSellOrders } = useReadContract({
    address: CONTRACTS.P2P_ESCROW,
    abi: P2PEscrowABI,
    functionName: 'getActiveSellOrders',
    args: [BigInt(0), BigInt(20)],
    query: {
      enabled: !!CONTRACTS.P2P_ESCROW,
      refetchInterval: 10_000,
    },
  });

  // Write operations
  const createBuyOrder = (usdtAmount: bigint) => {
    writeContract({
      address: CONTRACTS.P2P_ESCROW,
      abi: P2PEscrowABI,
      functionName: 'createBuyOrder',
      args: [usdtAmount],
    });
  };

  const createSellOrder = (kairoAmount: bigint) => {
    writeContract({
      address: CONTRACTS.P2P_ESCROW,
      abi: P2PEscrowABI,
      functionName: 'createSellOrder',
      args: [kairoAmount],
    });
  };

  const cancelBuyOrder = (orderId: bigint) => {
    writeContract({
      address: CONTRACTS.P2P_ESCROW,
      abi: P2PEscrowABI,
      functionName: 'cancelBuyOrder',
      args: [orderId],
    });
  };

  const cancelSellOrder = (orderId: bigint) => {
    writeContract({
      address: CONTRACTS.P2P_ESCROW,
      abi: P2PEscrowABI,
      functionName: 'cancelSellOrder',
      args: [orderId],
    });
  };

  const executeTrade = (buyOrderId: bigint, sellOrderId: bigint, kairoFillAmount: bigint) => {
    writeContract({
      address: CONTRACTS.P2P_ESCROW,
      abi: P2PEscrowABI,
      functionName: 'executeTrade',
      args: [buyOrderId, sellOrderId, kairoFillAmount],
    });
  };

  return {
    orderBookStats,
    currentPrice,
    activeBuyOrders,
    activeSellOrders,
    createBuyOrder,
    createSellOrder,
    cancelBuyOrder,
    cancelSellOrder,
    executeTrade,
    refetchStats,
    refetchBuyOrders,
    refetchSellOrders,
    isWritePending,
    isConfirming,
    txHash,
  };
}
