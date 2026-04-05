'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { formatUnits, parseUnits } from 'viem';
import { motion } from 'framer-motion';
import {
  ArrowsRightLeftIcon,
  ExclamationTriangleIcon,
  WalletIcon,
} from '@heroicons/react/24/outline';
import { useP2P } from '@/hooks/useP2P';
import { useKairoPrice } from '@/hooks/useKairoPrice';
import { useWS } from '@/providers/WebSocketProvider';
import { useToast } from '@/providers/ToastProvider';
import { CONTRACTS, USDTABI, KAIROTokenABI } from '@/lib/contracts';
import { GlassCard } from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/Button';
import { Tabs } from '@/components/ui/Tabs';
import { AnimatedCounter } from '@/components/ui/AnimatedCounter';
import { Skeleton } from '@/components/ui/Skeleton';
import { Modal } from '@/components/ui/Modal';
import { TradingViewChart } from '@/components/exchange/TradingViewChart';
import { OrderBookPanel } from '@/components/exchange/OrderBookPanel';
import { cn, formatAddress } from '@/lib/utils';
import type { WSMessage } from '@/hooks/useWebSocket';

// ─── Types ───────────────────────────────────────────────────────

interface BuyOrderData {
  creator: string;
  usdtAmount: bigint;
  usdtRemaining: bigint;
  active: boolean;
  createdAt: bigint;
}

interface SellOrderData {
  creator: string;
  kairoAmount: bigint;
  kairoRemaining: bigint;
  active: boolean;
  createdAt: bigint;
}

interface RecentTrade {
  time: string;
  price: number;
  amount: number;
  type: 'buy' | 'sell';
}

// ─── Constants ───────────────────────────────────────────────────

const FEE_RATE = 0.02; // 2% total (1% burn + 1% LP)
const FILL_PERCENTAGES = [25, 50, 75, 100];

// ─── Component ───────────────────────────────────────────────────

export default function ExchangePage() {
  const { address, isConnected } = useAccount();
  const { addToast } = useToast();
  const { subscribe } = useWS();

  const {
    orderBookStats,
    currentPrice,
    activeBuyOrders,
    activeBuyOrderIds,
    activeSellOrders,
    activeSellOrderIds,
    createBuyOrder,
    createSellOrder,
    cancelBuyOrder,
    cancelSellOrder,
    executeTrade,
    isWritePending,
    isConfirming,
  } = useP2P();

  const { price: kairoPrice, isLoading: isPriceLoading } = useKairoPrice();

  // ─── Local State ─────────────────────────────────────────────

  const [buyAmount, setBuyAmount] = useState('');
  const [sellAmount, setSellAmount] = useState('');
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<{ id: bigint; isBuy: boolean } | null>(null);
  const [fillPercent, setFillPercent] = useState(100);
  const [selectedOrder, setSelectedOrder] = useState<{
    side: 'buy' | 'sell';
    orderId: bigint;
    amount: number;
  } | null>(null);
  const [recentTrades, setRecentTrades] = useState<RecentTrade[]>([]);
  const [myOrdersTab, setMyOrdersTab] = useState<'active' | 'history'>('active');

  // ─── Allowances ──────────────────────────────────────────────

  const { data: usdtAllowance } = useReadContract({
    address: CONTRACTS.USDT,
    abi: USDTABI,
    functionName: 'allowance',
    args: address ? [address, CONTRACTS.ATOMIC_P2P] : undefined,
    query: { enabled: !!address && !!CONTRACTS.USDT && !!CONTRACTS.ATOMIC_P2P },
  });

  const { data: kairoAllowance } = useReadContract({
    address: CONTRACTS.KAIRO_TOKEN,
    abi: KAIROTokenABI,
    functionName: 'allowance',
    args: address ? [address, CONTRACTS.ATOMIC_P2P] : undefined,
    query: { enabled: !!address && !!CONTRACTS.KAIRO_TOKEN && !!CONTRACTS.ATOMIC_P2P },
  });

  const { writeContract: writeApprove, data: approveTx, isPending: isApproving } = useWriteContract();
  const { isLoading: isApproveConfirming } = useWaitForTransactionReceipt({
    hash: approveTx,
    query: { enabled: !!approveTx },
  });

  // ─── Derived Values ──────────────────────────────────────────

  const priceUSD = currentPrice ? Number(formatUnits(currentPrice as bigint, 18)) : kairoPrice;
  const parsedBuy = parseFloat(buyAmount) || 0;
  const parsedSell = parseFloat(sellAmount) || 0;

  const usdtAllow = usdtAllowance ? Number(formatUnits(usdtAllowance as bigint, 18)) : 0;
  const kairoAllow = kairoAllowance ? Number(formatUnits(kairoAllowance as bigint, 18)) : 0;

  const buyNeedsApproval = parsedBuy > usdtAllow;
  const sellNeedsApproval = parsedSell > kairoAllow;

  const buyEstKairo = priceUSD > 0 ? parsedBuy / priceUSD : 0;
  const buyFee = parsedBuy * FEE_RATE;
  const buyNetKairo = priceUSD > 0 ? (parsedBuy - buyFee) / priceUSD : 0;

  const sellEstUsdt = parsedSell * priceUSD;
  const sellFee = sellEstUsdt * FEE_RATE;
  const sellNetUsdt = sellEstUsdt - sellFee;

  const stats = useMemo(() => {
    if (!orderBookStats) return { totalBuy: 0, totalSell: 0, totalTrades: 0, activeBuy: 0, activeSell: 0 };
    const [tb, ts, tt, ab, as_] = orderBookStats as unknown as bigint[];
    return {
      totalBuy: Number(tb), totalSell: Number(ts), totalTrades: Number(tt),
      activeBuy: Number(ab), activeSell: Number(as_),
    };
  }, [orderBookStats]);

  // 24h change (derived from price data if available)
  const [priceChange24h, setPriceChange24h] = useState(0);

  // ─── My Orders ───────────────────────────────────────────────

  const myBuyOrders = useMemo(() => {
    if (!activeBuyOrders || !activeBuyOrderIds || !address) return [] as { order: BuyOrderData; orderId: bigint }[];
    const orders = activeBuyOrders as unknown as BuyOrderData[];
    const ids = activeBuyOrderIds as unknown as bigint[];
    return orders
      .map((o, i) => ({ order: o, orderId: ids[i] }))
      .filter(({ order: o, orderId }) => orderId !== undefined && o.creator.toLowerCase() === address.toLowerCase() && o.active);
  }, [activeBuyOrders, activeBuyOrderIds, address]);

  const mySellOrders = useMemo(() => {
    if (!activeSellOrders || !activeSellOrderIds || !address) return [] as { order: SellOrderData; orderId: bigint }[];
    const orders = activeSellOrders as unknown as SellOrderData[];
    const ids = activeSellOrderIds as unknown as bigint[];
    return orders
      .map((o, i) => ({ order: o, orderId: ids[i] }))
      .filter(({ order: o, orderId }) => orderId !== undefined && o.creator.toLowerCase() === address.toLowerCase() && o.active);
  }, [activeSellOrders, activeSellOrderIds, address]);

  // ─── WebSocket for Recent Trades ─────────────────────────────

  const handleWSMessage = useCallback((msg: WSMessage) => {
    if (msg.type === 'trade_executed') {
      const trade: RecentTrade = {
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        price: parseFloat(msg.data.price) || 0,
        amount: parseFloat(msg.data.amount) || 0,
        type: parseFloat(msg.data.amount) > 0 ? 'buy' : 'sell',
      };
      setRecentTrades((prev) => [trade, ...prev.slice(0, 19)]);
      addToast('info', 'Trade Executed', `${msg.data.amount} KAIRO @ $${msg.data.price}`);
    }
  }, [addToast]);

  useEffect(() => {
    const unsub = subscribe(handleWSMessage);
    return unsub;
  }, [subscribe, handleWSMessage]);

  // ─── Handlers ────────────────────────────────────────────────

  const handleApproveBuy = () => {
    const amt = parseUnits(buyAmount, 18);
    writeApprove({
      address: CONTRACTS.USDT,
      abi: USDTABI,
      functionName: 'approve',
      args: [CONTRACTS.ATOMIC_P2P, amt],
    });
  };

  const handleApproveSell = () => {
    const amt = parseUnits(sellAmount, 18);
    writeApprove({
      address: CONTRACTS.KAIRO_TOKEN,
      abi: KAIROTokenABI,
      functionName: 'approve',
      args: [CONTRACTS.ATOMIC_P2P, amt],
    });
  };

  const handleCreateBuy = () => {
    if (parsedBuy <= 0) return;
    createBuyOrder(parseUnits(buyAmount, 18));
    setBuyAmount('');
    addToast('success', 'Buy Order', 'Creating buy order...');
  };

  const handleCreateSell = () => {
    if (parsedSell <= 0) return;
    createSellOrder(parseUnits(sellAmount, 18));
    setSellAmount('');
    addToast('success', 'Sell Order', 'Creating sell order...');
  };

  const handleCancelClick = (orderId: bigint, isBuy: boolean) => {
    setCancelTarget({ id: orderId, isBuy });
    setCancelModalOpen(true);
  };

  const handleConfirmCancel = () => {
    if (!cancelTarget) return;
    if (cancelTarget.isBuy) cancelBuyOrder(cancelTarget.id);
    else cancelSellOrder(cancelTarget.id);
    setCancelModalOpen(false);
    setCancelTarget(null);
    addToast('info', 'Order Cancelled', 'Cancelling order...');
  };

  const handleOrderBookSelect = (side: 'buy' | 'sell', orderId: bigint, amount: number) => {
    setSelectedOrder({ side, orderId, amount });
    setFillPercent(100);
    // Auto-fill the opposite form
    if (side === 'sell') {
      // Clicking a sell order -> user wants to buy
      const fillAmount = (amount * fillPercent) / 100;
      const usdtNeeded = fillAmount * priceUSD;
      setBuyAmount(usdtNeeded.toFixed(2));
    } else {
      // Clicking a buy order -> user wants to sell
      const fillAmount = (amount * fillPercent) / 100;
      setSellAmount(fillAmount.toFixed(4));
    }
  };

  const isLoading = isWritePending || isConfirming;

  // ─── Disconnected State ──────────────────────────────────────

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <div className="w-20 h-20 rounded-full bg-glass flex items-center justify-center mx-auto mb-6">
            <WalletIcon className="w-10 h-10 text-gray-600" />
          </div>
          <h2 className="text-xl font-orbitron text-white mb-2">Connect Your Wallet</h2>
          <p className="text-gray-500 text-sm max-w-sm">
            Connect your wallet to access the KAIRO P2P Exchange
          </p>
        </motion.div>
      </div>
    );
  }

  // ─── Main Layout ─────────────────────────────────────────────

  return (
    <div className="space-y-4 p-2 md:p-4 lg:p-6">
      {/* ═══ Price Header Bar ═══ */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <GlassCard padding="sm" className="!p-3 md:!p-4">
          <div className="flex flex-wrap items-center gap-4 md:gap-8">
            {/* Pair name */}
            <div className="flex items-center gap-2">
              <span className="font-orbitron text-base md:text-lg text-white font-bold tracking-wider">
                KAIRO / USDT
              </span>
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-neon-cyan/10 text-[10px] font-mono text-neon-cyan">
                <span className="w-1.5 h-1.5 rounded-full bg-neon-cyan animate-pulse" />
                LIVE
              </span>
            </div>

            {/* Current price */}
            <div>
              {isPriceLoading ? (
                <Skeleton variant="text" className="w-32 h-8" />
              ) : (
                <AnimatedCounter
                  value={priceUSD}
                  prefix="$"
                  decimals={4}
                  className="text-2xl md:text-3xl font-bold text-neon-cyan font-mono"
                />
              )}
            </div>

            {/* 24h change */}
            <div
              className={cn(
                'flex items-center gap-1 px-3 py-1 rounded-lg text-sm font-mono font-semibold',
                priceChange24h >= 0
                  ? 'bg-matrix-green/10 text-matrix-green'
                  : 'bg-neon-coral/10 text-neon-coral',
              )}
            >
              {priceChange24h >= 0 ? '+' : ''}{priceChange24h.toFixed(2)}%
              <span className="text-[10px] opacity-60">24h</span>
            </div>

            {/* Volume */}
            <div className="hidden md:flex items-center gap-2 text-xs text-gray-500">
              <span>24h Vol:</span>
              <span className="font-mono text-gray-300">
                {stats.totalTrades} trades
              </span>
            </div>
          </div>
        </GlassCard>
      </motion.div>

      {/* ═══ Main Grid ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* ─── LEFT PANEL (Order Book + Trade Form) ─── */}
        <div className="lg:col-span-2 space-y-4 order-2 lg:order-1">
          {/* Create Order */}
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
            <GlassCard padding="sm">
              <Tabs
                tabs={[
                  {
                    value: 'buy',
                    label: 'Buy KAIRO',
                    content: (
                      <div className="space-y-3">
                        {/* Oracle price */}
                        <div className="flex items-center justify-between px-1">
                          <span className="text-[11px] text-gray-500">Oracle Price</span>
                          <span className="text-xs font-mono text-neon-cyan">${priceUSD.toFixed(4)}</span>
                        </div>

                        {/* USDT Amount input */}
                        <div>
                          <label className="block text-xs text-gray-500 mb-1 px-1">USDT Amount</label>
                          <div className="relative">
                            <input
                              type="number"
                              value={buyAmount}
                              onChange={(e) => setBuyAmount(e.target.value)}
                              placeholder="0.00"
                              className="w-full px-4 py-3 rounded-xl bg-void/60 border border-white/[0.06] text-white text-sm font-mono placeholder:text-gray-700 focus:outline-none focus:border-neon-cyan/40 transition-colors"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-600 font-mono">USDT</span>
                          </div>
                        </div>

                        {/* Calculation */}
                        {parsedBuy > 0 && (
                          <div className="space-y-1.5 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                            <div className="flex justify-between text-xs">
                              <span className="text-gray-500">You will receive</span>
                              <span className="text-white font-mono">~{buyEstKairo.toFixed(4)} KAIRO</span>
                            </div>
                            <div className="flex justify-between text-xs">
                              <span className="text-gray-600">Trading Fee (2%)</span>
                              <span className="text-gray-500 font-mono">{buyFee.toFixed(2)} USDT</span>
                            </div>
                            <div className="flex justify-between text-xs border-t border-white/[0.04] pt-1.5">
                              <span className="text-gray-400">Net Received</span>
                              <span className="text-neon-cyan font-mono font-semibold">~{buyNetKairo.toFixed(4)} KAIRO</span>
                            </div>
                            <p className="text-[10px] text-gray-600 mt-1">1% Burn + 1% LP</p>
                          </div>
                        )}

                        {/* Selected order fill */}
                        {selectedOrder?.side === 'sell' && (
                          <div className="space-y-2 p-3 rounded-xl bg-neon-cyan/5 border border-neon-cyan/10">
                            <span className="text-[10px] text-neon-cyan font-semibold uppercase tracking-wider">
                              Fill Sell Order #{selectedOrder.orderId.toString()}
                            </span>
                            <div className="flex gap-1">
                              {FILL_PERCENTAGES.map((pct) => (
                                <button
                                  key={pct}
                                  onClick={() => {
                                    setFillPercent(pct);
                                    const fillAmt = (selectedOrder.amount * pct) / 100;
                                    setBuyAmount((fillAmt * priceUSD).toFixed(2));
                                  }}
                                  className={cn(
                                    'flex-1 py-2 min-h-[40px] text-xs font-mono rounded-lg transition-all focus-visible:ring-2 focus-visible:ring-neon-cyan/50',
                                    fillPercent === pct
                                      ? 'bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/30'
                                      : 'bg-white/5 text-gray-500 hover:text-gray-300',
                                  )}
                                >
                                  {pct}%
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Action button */}
                        {buyNeedsApproval ? (
                          <Button
                            variant="secondary"
                            size="lg"
                            className="w-full"
                            loading={isApproving || isApproveConfirming}
                            disabled={parsedBuy <= 0}
                            onClick={handleApproveBuy}
                          >
                            Approve USDT
                          </Button>
                        ) : (
                          <Button
                            variant="primary"
                            size="lg"
                            className="w-full"
                            loading={isLoading}
                            disabled={parsedBuy <= 0}
                            onClick={handleCreateBuy}
                          >
                            Create Buy Order
                          </Button>
                        )}
                      </div>
                    ),
                  },
                  {
                    value: 'sell',
                    label: 'Sell KAIRO',
                    content: (
                      <div className="space-y-3">
                        {/* Oracle price */}
                        <div className="flex items-center justify-between px-1">
                          <span className="text-[11px] text-gray-500">Oracle Price</span>
                          <span className="text-xs font-mono text-neon-cyan">${priceUSD.toFixed(4)}</span>
                        </div>

                        {/* KAIRO Amount input */}
                        <div>
                          <label className="block text-xs text-gray-500 mb-1 px-1">KAIRO Amount</label>
                          <div className="relative">
                            <input
                              type="number"
                              value={sellAmount}
                              onChange={(e) => setSellAmount(e.target.value)}
                              placeholder="0.0000"
                              className="w-full px-4 py-3 rounded-xl bg-void/60 border border-white/[0.06] text-white text-sm font-mono placeholder:text-gray-700 focus:outline-none focus:border-neon-cyan/40 transition-colors"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-600 font-mono">KAIRO</span>
                          </div>
                        </div>

                        {/* Calculation */}
                        {parsedSell > 0 && (
                          <div className="space-y-1.5 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                            <div className="flex justify-between text-xs">
                              <span className="text-gray-500">You will receive</span>
                              <span className="text-white font-mono">~{sellEstUsdt.toFixed(2)} USDT</span>
                            </div>
                            <div className="flex justify-between text-xs">
                              <span className="text-gray-600">Trading Fee (2%)</span>
                              <span className="text-gray-500 font-mono">{sellFee.toFixed(2)} USDT</span>
                            </div>
                            <div className="flex justify-between text-xs border-t border-white/[0.04] pt-1.5">
                              <span className="text-gray-400">Net Received</span>
                              <span className="text-neon-cyan font-mono font-semibold">~{sellNetUsdt.toFixed(2)} USDT</span>
                            </div>
                            <p className="text-[10px] text-gray-600 mt-1">1% Burn + 1% LP</p>
                          </div>
                        )}

                        {/* Selected order fill */}
                        {selectedOrder?.side === 'buy' && (
                          <div className="space-y-2 p-3 rounded-xl bg-neon-cyan/5 border border-neon-cyan/10">
                            <span className="text-[10px] text-neon-cyan font-semibold uppercase tracking-wider">
                              Fill Buy Order #{selectedOrder.orderId.toString()}
                            </span>
                            <div className="flex gap-1">
                              {FILL_PERCENTAGES.map((pct) => (
                                <button
                                  key={pct}
                                  onClick={() => {
                                    setFillPercent(pct);
                                    const fillAmt = (selectedOrder.amount * pct) / 100;
                                    setSellAmount(fillAmt.toFixed(4));
                                  }}
                                  className={cn(
                                    'flex-1 py-2 min-h-[40px] text-xs font-mono rounded-lg transition-all focus-visible:ring-2 focus-visible:ring-neon-cyan/50',
                                    fillPercent === pct
                                      ? 'bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/30'
                                      : 'bg-white/5 text-gray-500 hover:text-gray-300',
                                  )}
                                >
                                  {pct}%
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Action button */}
                        {sellNeedsApproval ? (
                          <Button
                            variant="secondary"
                            size="lg"
                            className="w-full"
                            loading={isApproving || isApproveConfirming}
                            disabled={parsedSell <= 0}
                            onClick={handleApproveSell}
                          >
                            Approve KAIRO
                          </Button>
                        ) : (
                          <Button
                            variant="danger"
                            size="lg"
                            className="w-full"
                            loading={isLoading}
                            disabled={parsedSell <= 0}
                            onClick={handleCreateSell}
                          >
                            Create Sell Order
                          </Button>
                        )}
                      </div>
                    ),
                  },
                ]}
              />
            </GlassCard>
          </motion.div>

          {/* Order Book */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="min-h-[350px]"
          >
            <OrderBookPanel
              buyOrders={activeBuyOrders as any}
              sellOrders={activeSellOrders as any}
              buyOrderIds={activeBuyOrderIds as any}
              sellOrderIds={activeSellOrderIds as any}
              currentPrice={priceUSD}
              onSelectOrder={handleOrderBookSelect}
            />
          </motion.div>
        </div>

        {/* ─── RIGHT PANEL (Chart + Recent Trades + My Orders) ─── */}
        <div className="lg:col-span-3 space-y-4 order-1 lg:order-2">
          {/* TradingView Chart */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15 }}
            className="min-h-[300px] h-[350px] sm:h-[400px] lg:h-[450px]"
          >
            <TradingViewChart />
          </motion.div>

          {/* My Orders */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
          >
            <GlassCard padding="sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-orbitron text-white font-semibold tracking-wider">
                  My Orders
                </h3>
                <div className="flex gap-1">
                  <button
                    onClick={() => setMyOrdersTab('active')}
                    className={cn(
                      'px-3 py-1.5 text-xs font-medium rounded-lg transition-all min-h-[36px] focus-visible:ring-2 focus-visible:ring-neon-cyan/50 focus-visible:ring-offset-2 focus-visible:ring-offset-void',
                      myOrdersTab === 'active'
                        ? 'bg-neon-cyan/10 text-neon-cyan'
                        : 'text-gray-500 hover:text-gray-300',
                    )}
                  >
                    Active ({myBuyOrders.length + mySellOrders.length})
                  </button>
                  <button
                    onClick={() => setMyOrdersTab('history')}
                    className={cn(
                      'px-3 py-1.5 text-xs font-medium rounded-lg transition-all min-h-[36px] focus-visible:ring-2 focus-visible:ring-neon-cyan/50 focus-visible:ring-offset-2 focus-visible:ring-offset-void',
                      myOrdersTab === 'history'
                        ? 'bg-neon-cyan/10 text-neon-cyan'
                        : 'text-gray-500 hover:text-gray-300',
                    )}
                  >
                    History
                  </button>
                </div>
              </div>

              {myOrdersTab === 'active' ? (
                <div className="space-y-1.5 max-h-[250px] overflow-y-auto">
                  {myBuyOrders.length === 0 && mySellOrders.length === 0 ? (
                    <div className="text-center py-6">
                      <ArrowsRightLeftIcon className="w-8 h-8 text-gray-700 mx-auto mb-2" />
                      <p className="text-xs text-gray-500">No active orders</p>
                    </div>
                  ) : (
                    <>
                      {myBuyOrders.map(({ order, orderId }) => {
                        const amt = Number(formatUnits(order.usdtAmount, 18));
                        const rem = Number(formatUnits(order.usdtRemaining, 18));
                        const filled = amt > 0 ? ((amt - rem) / amt) * 100 : 0;
                        return (
                          <div
                            key={`my-buy-${orderId.toString()}`}
                            className="flex items-center gap-3 p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:border-white/[0.08] transition-colors"
                          >
                            <span className="px-2 py-0.5 rounded-md bg-matrix-green/10 text-matrix-green text-[10px] font-bold uppercase">
                              Buy
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-white font-mono">{rem.toFixed(2)} USDT</span>
                                <span className="text-[10px] text-gray-600 font-mono">{filled.toFixed(0)}% filled</span>
                              </div>
                              <div className="mt-1 h-1 rounded-full bg-white/5 overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-matrix-green/40"
                                  style={{ width: `${filled}%` }}
                                />
                              </div>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="!px-2 !py-1 text-neon-coral hover:bg-neon-coral/10"
                              disabled={isLoading}
                              onClick={() => handleCancelClick(orderId, true)}
                            >
                              Cancel
                            </Button>
                          </div>
                        );
                      })}
                      {mySellOrders.map(({ order, orderId }) => {
                        const amt = Number(formatUnits(order.kairoAmount, 18));
                        const rem = Number(formatUnits(order.kairoRemaining, 18));
                        const filled = amt > 0 ? ((amt - rem) / amt) * 100 : 0;
                        return (
                          <div
                            key={`my-sell-${orderId.toString()}`}
                            className="flex items-center gap-3 p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:border-white/[0.08] transition-colors"
                          >
                            <span className="px-2 py-0.5 rounded-md bg-neon-coral/10 text-neon-coral text-[10px] font-bold uppercase">
                              Sell
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-white font-mono">{rem.toFixed(4)} KAIRO</span>
                                <span className="text-[10px] text-gray-600 font-mono">{filled.toFixed(0)}% filled</span>
                              </div>
                              <div className="mt-1 h-1 rounded-full bg-white/5 overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-neon-coral/40"
                                  style={{ width: `${filled}%` }}
                                />
                              </div>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="!px-2 !py-1 text-neon-coral hover:bg-neon-coral/10"
                              disabled={isLoading}
                              onClick={() => handleCancelClick(orderId, false)}
                            >
                              Cancel
                            </Button>
                          </div>
                        );
                      })}
                    </>
                  )}
                </div>
              ) : (
                <div className="text-center py-6">
                  <p className="text-xs text-gray-500">Trade history is indexed from blockchain events</p>
                </div>
              )}
            </GlassCard>
          </motion.div>

          {/* Recent Trades */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <GlassCard padding="sm">
              <h3 className="text-sm font-orbitron text-white font-semibold tracking-wider mb-3">
                Recent Trades
              </h3>

              {/* Header */}
              <div className="grid grid-cols-4 text-[10px] text-gray-600 mb-1.5 px-1 uppercase tracking-wider">
                <span>Time</span>
                <span className="text-right">Price</span>
                <span className="text-right">Amount</span>
                <span className="text-right">Type</span>
              </div>

              <div className="space-y-px max-h-[200px] overflow-y-auto">
                {recentTrades.length === 0 ? (
                  <div className="text-center py-6">
                    <p className="text-[10px] text-gray-500">Waiting for trades...</p>
                  </div>
                ) : (
                  recentTrades.map((trade, i) => (
                    <div
                      key={`trade-${i}`}
                      className="grid grid-cols-4 text-xs py-1.5 px-1 hover:bg-white/[0.03] transition-colors rounded"
                    >
                      <span className="text-gray-500 font-mono text-[11px]">{trade.time}</span>
                      <span
                        className={cn(
                          'text-right font-mono text-[11px]',
                          trade.type === 'buy' ? 'text-matrix-green' : 'text-neon-coral',
                        )}
                      >
                        {trade.price.toFixed(4)}
                      </span>
                      <span className="text-right text-gray-400 font-mono text-[11px]">
                        {trade.amount.toFixed(2)}
                      </span>
                      <span className="text-right">
                        <span
                          className={cn(
                            'inline-block px-1.5 py-0.5 rounded text-[9px] font-bold uppercase',
                            trade.type === 'buy'
                              ? 'bg-matrix-green/10 text-matrix-green'
                              : 'bg-neon-coral/10 text-neon-coral',
                          )}
                        >
                          {trade.type}
                        </span>
                      </span>
                    </div>
                  ))
                )}
              </div>
            </GlassCard>
          </motion.div>
        </div>
      </div>

      {/* ═══ Cancel Confirmation Modal ═══ */}
      <Modal isOpen={cancelModalOpen} onClose={() => setCancelModalOpen(false)} title="Cancel Order">
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-solar-amber/5 border border-solar-amber/15">
            <div className="flex items-start gap-3">
              <ExclamationTriangleIcon className="w-5 h-5 text-solar-amber shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-solar-amber font-medium">Cancel this order?</p>
                <p className="text-xs text-gray-500 mt-1">
                  Locked funds will be returned to your wallet.
                </p>
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <Button variant="ghost" size="md" className="flex-1" onClick={() => setCancelModalOpen(false)}>
              Keep Order
            </Button>
            <Button variant="danger" size="md" className="flex-1" loading={isLoading} onClick={handleConfirmCancel}>
              Cancel Order
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
