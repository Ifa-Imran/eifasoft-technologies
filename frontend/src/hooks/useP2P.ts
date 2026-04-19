'use client';

import { useReadContract, useWriteContract, useWaitForTransactionReceipt, useAccount } from 'wagmi';
import { contracts } from '@/config/contracts';
import { AtomicP2pABI } from '@/config/abis/AtomicP2p';
import { useToast } from '@/components/ui/Toast';
import { useEffect, useMemo } from 'react';

export interface P2PBuyOrder {
  id: bigint;
  creator: string;
  usdtAmount: bigint;
  usdtRemaining: bigint;
  active: boolean;
  createdAt: bigint;
}

export interface P2PSellOrder {
  id: bigint;
  creator: string;
  kairoAmount: bigint;
  kairoRemaining: bigint;
  active: boolean;
  createdAt: bigint;
}

export function useP2P() {
  const { address } = useAccount();
  const { toast } = useToast();

  // Fetch order structs
  const { data: rawBuyOrders, isLoading: buyLoading, refetch: refetchBuys } = useReadContract({
    address: contracts.atomicP2p,
    abi: AtomicP2pABI,
    functionName: 'getActiveBuyOrders',
    args: [BigInt(0), BigInt(200)],
    query: {
      enabled: contracts.atomicP2p !== '0x',
      refetchInterval: 10000,
    },
  });

  const { data: rawSellOrders, isLoading: sellLoading, refetch: refetchSells } = useReadContract({
    address: contracts.atomicP2p,
    abi: AtomicP2pABI,
    functionName: 'getActiveSellOrders',
    args: [BigInt(0), BigInt(200)],
    query: {
      enabled: contracts.atomicP2p !== '0x',
      refetchInterval: 10000,
    },
  });

  // Fetch corresponding order IDs (same offset/limit so arrays align 1:1)
  const { data: buyOrderIds, refetch: refetchBuyIds } = useReadContract({
    address: contracts.atomicP2p,
    abi: AtomicP2pABI,
    functionName: 'getActiveBuyOrderIds',
    args: [BigInt(0), BigInt(200)],
    query: {
      enabled: contracts.atomicP2p !== '0x',
      refetchInterval: 10000,
    },
  });

  const { data: sellOrderIds, refetch: refetchSellIds } = useReadContract({
    address: contracts.atomicP2p,
    abi: AtomicP2pABI,
    functionName: 'getActiveSellOrderIds',
    args: [BigInt(0), BigInt(200)],
    query: {
      enabled: contracts.atomicP2p !== '0x',
      refetchInterval: 10000,
    },
  });

  const { data: currentPrice } = useReadContract({
    address: contracts.atomicP2p,
    abi: AtomicP2pABI,
    functionName: 'getCurrentPrice',
    query: {
      enabled: contracts.atomicP2p !== '0x',
      refetchInterval: 5000,
    },
  });

  // Dust threshold: hide orders with remaining value < 1 USDT
  const DUST_THRESHOLD = BigInt(10 ** 18); // 1 USDT (18 decimals)

  // Zip order data with IDs, filter out dust
  const activeBuyOrders: P2PBuyOrder[] = useMemo(() => {
    const orders = (rawBuyOrders as any[]) || [];
    const ids = (buyOrderIds as bigint[]) || [];
    return orders
      .map((o: any, i: number) => ({
        id: ids[i] ?? BigInt(i),
        creator: o.creator,
        usdtAmount: BigInt(o.usdtAmount || 0),
        usdtRemaining: BigInt(o.usdtRemaining || 0),
        active: o.active,
        createdAt: BigInt(o.createdAt || 0),
      }))
      .filter((o) => o.usdtRemaining >= DUST_THRESHOLD);
  }, [rawBuyOrders, buyOrderIds]);

  const activeSellOrders: P2PSellOrder[] = useMemo(() => {
    const orders = (rawSellOrders as any[]) || [];
    const ids = (sellOrderIds as bigint[]) || [];
    const price = (currentPrice as bigint) ?? BigInt(0);
    return orders
      .map((o: any, i: number) => ({
        id: ids[i] ?? BigInt(i),
        creator: o.creator,
        kairoAmount: BigInt(o.kairoAmount || 0),
        kairoRemaining: BigInt(o.kairoRemaining || 0),
        active: o.active,
        createdAt: BigInt(o.createdAt || 0),
      }))
      .filter((o) => {
        if (price === BigInt(0)) return o.kairoRemaining > BigInt(0);
        const usdtValue = o.kairoRemaining * price / BigInt(10 ** 18);
        return usdtValue >= DUST_THRESHOLD;
      });
  }, [rawSellOrders, sellOrderIds, currentPrice]);

  const { writeContract: writeCreateBuy, isPending: createBuyPending, data: createBuyHash } = useWriteContract();
  const { writeContract: writeCreateSell, isPending: createSellPending, data: createSellHash } = useWriteContract();
  const { writeContract: writeSellTo, isPending: sellToPending, data: sellToHash } = useWriteContract();
  const { writeContract: writeBuyFrom, isPending: buyFromPending, data: buyFromHash } = useWriteContract();
  const { writeContract: writeCancelBuy, isPending: cancelBuyPending, data: cancelBuyHash } = useWriteContract();
  const { writeContract: writeCancelSell, isPending: cancelSellPending, data: cancelSellHash } = useWriteContract();

  const { isSuccess: createBuyOk, isError: createBuyFail } = useWaitForTransactionReceipt({ hash: createBuyHash });
  const { isSuccess: createSellOk, isError: createSellFail } = useWaitForTransactionReceipt({ hash: createSellHash });
  const { isSuccess: sellToOk, isError: sellToFail } = useWaitForTransactionReceipt({ hash: sellToHash });
  const { isSuccess: buyFromOk, isError: buyFromFail } = useWaitForTransactionReceipt({ hash: buyFromHash });
  const { isSuccess: cancelBuyOk, isError: cancelBuyFail } = useWaitForTransactionReceipt({ hash: cancelBuyHash });
  const { isSuccess: cancelSellOk, isError: cancelSellFail } = useWaitForTransactionReceipt({ hash: cancelSellHash });

  useEffect(() => { if (createBuyOk) { toast({ type: 'success', title: 'Buy order created!' }); refetch(); } }, [createBuyOk]);
  useEffect(() => { if (createBuyFail) toast({ type: 'error', title: 'Buy order failed' }); }, [createBuyFail]);
  useEffect(() => { if (createSellOk) { toast({ type: 'success', title: 'Sell order created!' }); refetch(); } }, [createSellOk]);
  useEffect(() => { if (createSellFail) toast({ type: 'error', title: 'Sell order failed' }); }, [createSellFail]);
  useEffect(() => { if (sellToOk) { toast({ type: 'success', title: 'Order filled!' }); refetch(); } }, [sellToOk]);
  useEffect(() => { if (sellToFail) toast({ type: 'error', title: 'Fill order failed' }); }, [sellToFail]);
  useEffect(() => { if (buyFromOk) { toast({ type: 'success', title: 'Order filled!' }); refetch(); } }, [buyFromOk]);
  useEffect(() => { if (buyFromFail) toast({ type: 'error', title: 'Fill order failed' }); }, [buyFromFail]);
  useEffect(() => { if (cancelBuyOk) { toast({ type: 'success', title: 'Buy order cancelled!' }); refetch(); } }, [cancelBuyOk]);
  useEffect(() => { if (cancelBuyFail) toast({ type: 'error', title: 'Cancel failed' }); }, [cancelBuyFail]);
  useEffect(() => { if (cancelSellOk) { toast({ type: 'success', title: 'Sell order cancelled!' }); refetch(); } }, [cancelSellOk]);
  useEffect(() => { if (cancelSellFail) toast({ type: 'error', title: 'Cancel failed' }); }, [cancelSellFail]);

  const createBuyOrder = (usdtAmount: bigint) => {
    writeCreateBuy({
      address: contracts.atomicP2p,
      abi: AtomicP2pABI,
      functionName: 'createBuyOrder',
      args: [usdtAmount],
    });
    toast({ type: 'pending', title: 'Creating buy order...' });
  };

  const createSellOrder = (kairoAmount: bigint) => {
    writeCreateSell({
      address: contracts.atomicP2p,
      abi: AtomicP2pABI,
      functionName: 'createSellOrder',
      args: [kairoAmount],
    });
    toast({ type: 'pending', title: 'Creating sell order...' });
  };

  const sellToOrder = (orderId: bigint, kairoAmount: bigint) => {
    writeSellTo({
      address: contracts.atomicP2p,
      abi: AtomicP2pABI,
      functionName: 'sellToOrder',
      args: [orderId, kairoAmount],
    });
    toast({ type: 'pending', title: 'Filling buy order...' });
  };

  const buyFromOrder = (orderId: bigint, kairoAmount: bigint) => {
    writeBuyFrom({
      address: contracts.atomicP2p,
      abi: AtomicP2pABI,
      functionName: 'buyFromOrder',
      args: [orderId, kairoAmount],
    });
    toast({ type: 'pending', title: 'Filling sell order...' });
  };

  const cancelBuyOrder = (orderId: bigint) => {
    writeCancelBuy({
      address: contracts.atomicP2p,
      abi: AtomicP2pABI,
      functionName: 'cancelBuyOrder',
      args: [orderId],
    });
    toast({ type: 'pending', title: 'Cancelling buy order...' });
  };

  const cancelSellOrder = (orderId: bigint) => {
    writeCancelSell({
      address: contracts.atomicP2p,
      abi: AtomicP2pABI,
      functionName: 'cancelSellOrder',
      args: [orderId],
    });
    toast({ type: 'pending', title: 'Cancelling sell order...' });
  };

  const refetch = () => {
    refetchBuys();
    refetchSells();
    refetchBuyIds();
    refetchSellIds();
  };

  return {
    activeBuyOrders,
    activeSellOrders,
    currentPrice: currentPrice as bigint | undefined,
    createBuyOrder,
    createSellOrder,
    sellToOrder,
    buyFromOrder,
    cancelBuyOrder,
    cancelSellOrder,
    refetch,
    isLoading: buyLoading || sellLoading,
    isPending: createBuyPending || createSellPending || sellToPending || buyFromPending || cancelBuyPending || cancelSellPending,
  };
}
