'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { GlassCard, Button, Input, Tabs, TabContent } from '@/components/ui';
import { useP2P } from '@/hooks/useP2P';
import { useApproval } from '@/hooks/useApproval';
import { useTokenBalances } from '@/hooks/useTokenBalances';
import { useKairoPrice } from '@/hooks/useKairoPrice';
import { contracts, USDT_DECIMALS, KAIRO_DECIMALS } from '@/config/contracts';
import { parseUnits, formatUnits } from 'viem';
import {
  ArrowsRightLeftIcon,
  ShoppingCartIcon,
  TagIcon,
  XMarkIcon,
  CurrencyDollarIcon,
  ChartBarSquareIcon,
} from '@heroicons/react/24/outline';

export default function ExchangePage() {
  const { isConnected, address } = useAccount();
  const [tab, setTab] = useState('book');
  const [orderType, setOrderType] = useState<'buy' | 'sell'>('buy');
  const [amount, setAmount] = useState('');
  const { activeBuyOrders, activeSellOrders, currentPrice, createBuyOrder, createSellOrder, cancelBuyOrder, cancelSellOrder, sellToOrder, buyFromOrder, isPending } = useP2P();
  const { kairoFormatted, usdtFormatted } = useTokenBalances();
  const { price: livePrice } = useKairoPrice();
  const usdtApproval = useApproval(contracts.usdt, contracts.atomicP2p);
  const kairoApproval = useApproval(contracts.kairoToken, contracts.atomicP2p);

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
        <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-primary-400 to-secondary-400 flex items-center justify-center mb-2 shadow-xl shadow-primary-300/30">
          <ArrowsRightLeftIcon className="w-10 h-10 text-white" />
        </div>
        <h2 className="text-2xl font-orbitron font-bold text-surface-900">Connect Wallet to Trade</h2>
        <p className="text-surface-500 text-sm">Access peer-to-peer KAIRO trading</p>
        <ConnectButton />
      </div>
    );
  }

  const numAmount = Number(amount) || 0;
  const priceVal = currentPrice ? Number(formatUnits(currentPrice, USDT_DECIMALS)) : 0;

  // Market stats
  const totalBuyVolume = activeBuyOrders.reduce((sum: number, o: any) => sum + Number(formatUnits(BigInt(o.usdtAmount || 0), USDT_DECIMALS)), 0);
  const totalSellVolume = activeSellOrders.reduce((sum: number, o: any) => sum + Number(formatUnits(BigInt(o.kairoAmount || 0), KAIRO_DECIMALS)), 0);
  const bestBuyPrice = activeBuyOrders.length > 0 ? Math.max(...activeBuyOrders.map((o: any) => {
    const usdt = Number(formatUnits(BigInt(o.usdtAmount || 0), USDT_DECIMALS));
    const kairo = Number(formatUnits(BigInt(o.kairoAmount || 0), KAIRO_DECIMALS));
    return kairo > 0 ? usdt / kairo : 0;
  })) : 0;
  const bestSellPrice = activeSellOrders.length > 0 ? Math.min(...activeSellOrders.filter((o: any) => {
    const kairo = Number(formatUnits(BigInt(o.kairoAmount || 0), KAIRO_DECIMALS));
    return kairo > 0;
  }).map((o: any) => {
    const usdt = Number(formatUnits(BigInt(o.usdtAmount || 0), USDT_DECIMALS));
    const kairo = Number(formatUnits(BigInt(o.kairoAmount || 0), KAIRO_DECIMALS));
    return usdt / kairo;
  })) : 0;
  const spread = bestSellPrice > 0 && bestBuyPrice > 0 ? ((bestSellPrice - bestBuyPrice) / bestBuyPrice * 100) : 0;

  // My orders
  const myBuyOrders = activeBuyOrders.filter((o: any) => o.buyer?.toLowerCase() === address?.toLowerCase());
  const mySellOrders = activeSellOrders.filter((o: any) => o.seller?.toLowerCase() === address?.toLowerCase());

  const handleCreateOrder = () => {
    if (orderType === 'buy') {
      const usdtAmount = parseUnits(amount, USDT_DECIMALS);
      if (!usdtApproval.hasAllowance(usdtAmount)) {
        usdtApproval.approve(usdtAmount);
        return;
      }
      createBuyOrder(usdtAmount);
    } else {
      const kairoAmount = parseUnits(amount, KAIRO_DECIMALS);
      if (!kairoApproval.hasAllowance(kairoAmount)) {
        kairoApproval.approve(kairoAmount);
        return;
      }
      createSellOrder(kairoAmount);
    }
    setAmount('');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-orbitron font-bold gradient-text">P2P Exchange</h1>
          <p className="text-base text-surface-500 mt-1">Atomic peer-to-peer KAIRO trading</p>
        </div>
        {priceVal > 0 && (
          <div className="rounded-2xl px-5 py-3 bg-gradient-to-r from-primary-100 to-secondary-100 border-2 border-primary-300/50 flex items-center gap-3 shadow-sm shadow-primary-200/20">
            <div className="w-2.5 h-2.5 rounded-full bg-success-500 animate-pulse" />
            <div>
              <p className="text-[10px] uppercase tracking-wider text-surface-400">DEX Price</p>
              <p className="font-mono font-bold text-surface-900">${priceVal.toFixed(4)}</p>
            </div>
          </div>
        )}
      </div>

      {/* Market Overview Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <GlassCard padding="p-4" variant="cyan">
          <p className="text-[10px] uppercase tracking-wider text-surface-400 mb-1">Buy Orders</p>
          <p className="text-xl font-mono font-bold text-surface-900">{activeBuyOrders.length}</p>
          <p className="text-xs text-surface-500">${totalBuyVolume.toLocaleString('en-US', { maximumFractionDigits: 0 })} USDT</p>
        </GlassCard>
        <GlassCard padding="p-4" variant="purple">
          <p className="text-[10px] uppercase tracking-wider text-surface-400 mb-1">Sell Orders</p>
          <p className="text-xl font-mono font-bold text-surface-900">{activeSellOrders.length}</p>
          <p className="text-xs text-surface-500">{totalSellVolume.toLocaleString('en-US', { maximumFractionDigits: 0 })} KAIRO</p>
        </GlassCard>
        <GlassCard padding="p-4">
          <p className="text-[10px] uppercase tracking-wider text-surface-400 mb-1">Best Bid</p>
          <p className="text-xl font-mono font-bold text-success-600">${bestBuyPrice > 0 ? bestBuyPrice.toFixed(4) : '--'}</p>
        </GlassCard>
        <GlassCard padding="p-4">
          <p className="text-[10px] uppercase tracking-wider text-surface-400 mb-1">Spread</p>
          <p className="text-xl font-mono font-bold text-surface-900">{spread > 0 ? spread.toFixed(2) + '%' : '--'}</p>
        </GlassCard>
      </div>

      <Tabs
        tabs={[
          { value: 'book', label: 'Order Book' },
          { value: 'create', label: 'Create Order' },
          { value: 'my', label: `My Orders (${myBuyOrders.length + mySellOrders.length})` },
        ]}
        value={tab}
        onValueChange={setTab}
      >
        <TabContent value="book" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Buy Orders */}
            <GlassCard>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-success-400 to-success-300 flex items-center justify-center shadow-sm shadow-success-300/30">
                  <ShoppingCartIcon className="w-4 h-4 text-white" />
                </div>
                <h3 className="text-sm font-semibold text-success-600">Buy Orders</h3>
                <span className="ml-auto text-xs font-mono text-surface-400">{activeBuyOrders.length}</span>
              </div>
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {activeBuyOrders.length === 0 ? (
                  <div className="text-center py-8">
                    <ShoppingCartIcon className="w-8 h-8 text-surface-300 mx-auto mb-2" />
                    <p className="text-surface-400 text-sm">No active buy orders</p>
                  </div>
                ) : (
                  activeBuyOrders.slice(0, 15).map((order: any, i: number) => {
                    const usdtVal = Number(formatUnits(BigInt(order.usdtAmount || 0), USDT_DECIMALS));
                    const kairoVal = Number(formatUnits(BigInt(order.kairoAmount || 0), KAIRO_DECIMALS));
                    const impliedPrice = kairoVal > 0 ? (usdtVal / kairoVal) : 0;
                    return (
                      <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-success-100/60 to-success-50/40 border-2 border-success-200/50 hover:border-success-400 transition-colors">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-mono font-semibold text-surface-900">${usdtVal.toFixed(2)}</p>
                            {impliedPrice > 0 && <span className="text-[10px] text-surface-400">@ ${impliedPrice.toFixed(4)}</span>}
                          </div>
                          <p className="text-xs text-surface-400 truncate">{order.buyer || ''}</p>
                        </div>
                        {order.buyer?.toLowerCase() !== address?.toLowerCase() && (
                          <Button size="sm" variant="success" onClick={() => sellToOrder(BigInt(order.id || i), BigInt(order.kairoAmount || 0))}>
                            Fill
                          </Button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </GlassCard>

            {/* Sell Orders */}
            <GlassCard>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-danger-400 to-danger-300 flex items-center justify-center shadow-sm shadow-danger-300/30">
                  <TagIcon className="w-4 h-4 text-white" />
                </div>
                <h3 className="text-sm font-semibold text-danger-500">Sell Orders</h3>
                <span className="ml-auto text-xs font-mono text-surface-400">{activeSellOrders.length}</span>
              </div>
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {activeSellOrders.length === 0 ? (
                  <div className="text-center py-8">
                    <TagIcon className="w-8 h-8 text-surface-300 mx-auto mb-2" />
                    <p className="text-surface-400 text-sm">No active sell orders</p>
                  </div>
                ) : (
                  activeSellOrders.slice(0, 15).map((order: any, i: number) => {
                    const kairoVal = Number(formatUnits(BigInt(order.kairoAmount || 0), KAIRO_DECIMALS));
                    const usdtVal = Number(formatUnits(BigInt(order.usdtAmount || 0), USDT_DECIMALS));
                    const impliedPrice = kairoVal > 0 ? (usdtVal / kairoVal) : 0;
                    return (
                      <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-danger-100/60 to-danger-50/40 border-2 border-danger-200/50 hover:border-danger-400 transition-colors">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-mono font-semibold text-surface-900">{kairoVal.toFixed(2)} KAIRO</p>
                            {impliedPrice > 0 && <span className="text-[10px] text-surface-400">@ ${impliedPrice.toFixed(4)}</span>}
                          </div>
                          <p className="text-xs text-surface-400 truncate">{order.seller || ''}</p>
                        </div>
                        {order.seller?.toLowerCase() !== address?.toLowerCase() && (
                          <Button size="sm" onClick={() => buyFromOrder(BigInt(order.id || i), BigInt(order.kairoAmount || 0))}>
                            Fill
                          </Button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </GlassCard>
          </div>
        </TabContent>

        <TabContent value="create">
          <GlassCard className="max-w-lg mx-auto" variant="gradient">
            <div className="flex gap-2 mb-6">
              <button
                onClick={() => setOrderType('buy')}
                className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-all ${
                  orderType === 'buy'
                    ? 'bg-success-500 text-white shadow-lg shadow-success-500/20'
                    : 'bg-surface-100 text-surface-500 hover:bg-surface-200'
                }`}
              >
                Buy KAIRO
              </button>
              <button
                onClick={() => setOrderType('sell')}
                className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-all ${
                  orderType === 'sell'
                    ? 'bg-danger-500 text-white shadow-lg shadow-danger-500/20'
                    : 'bg-surface-100 text-surface-500 hover:bg-surface-200'
                }`}
              >
                Sell KAIRO
              </button>
            </div>

            <Input
              label={orderType === 'buy' ? 'USDT Amount' : 'KAIRO Amount'}
              type="number"
              placeholder="Enter amount..."
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              helperText={orderType === 'buy' ? `Balance: ${Number(usdtFormatted).toFixed(2)} USDT` : `Balance: ${Number(kairoFormatted).toFixed(2)} KAIRO`}
            />

            {numAmount > 0 && (
              <div className="mt-4 p-4 rounded-xl bg-white/60 border border-surface-200 space-y-2 text-xs">
                <div className="flex justify-between text-surface-500">
                  <span>DEX Reference Price</span>
                  <span className="font-mono">${priceVal.toFixed(4)}</span>
                </div>
                <div className="flex justify-between text-surface-500">
                  <span>Trading Fee</span>
                  <span className="font-mono">3%</span>
                </div>
                <div className="flex justify-between font-semibold text-surface-900 border-t border-surface-200 pt-2">
                  <span>Estimated {orderType === 'buy' ? 'KAIRO' : 'USDT'}</span>
                  <span className="font-mono">
                    {orderType === 'buy'
                      ? (priceVal > 0 ? (numAmount * 0.97 / priceVal).toFixed(4) + ' KAIRO' : '--')
                      : '$' + (numAmount * priceVal * 0.97).toFixed(2)}
                  </span>
                </div>
              </div>
            )}

            <Button onClick={handleCreateOrder} loading={isPending} disabled={numAmount <= 0} className="w-full mt-4">
              {orderType === 'buy'
                ? !usdtApproval.hasAllowance(numAmount > 0 ? parseUnits(amount, USDT_DECIMALS) : BigInt(0))
                  ? 'Approve USDT'
                  : 'Create Buy Order'
                : !kairoApproval.hasAllowance(numAmount > 0 ? parseUnits(amount, KAIRO_DECIMALS) : BigInt(0))
                  ? 'Approve KAIRO'
                  : 'Create Sell Order'}
            </Button>
          </GlassCard>
        </TabContent>

        <TabContent value="my" className="space-y-4">
          {myBuyOrders.length === 0 && mySellOrders.length === 0 ? (
            <GlassCard>
              <div className="text-center py-12">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-400 to-secondary-400 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-primary-300/30">
                  <ChartBarSquareIcon className="w-8 h-8 text-white" />
                </div>
                <p className="text-surface-500 text-sm">You have no active orders.</p>
                <p className="text-surface-400 text-xs mt-1">Create a buy or sell order to get started.</p>
              </div>
            </GlassCard>
          ) : (
            <>
              {myBuyOrders.length > 0 && (
                <GlassCard>
                  <h3 className="text-sm font-semibold text-success-600 mb-3 flex items-center gap-2">
                    <ShoppingCartIcon className="w-4 h-4" /> My Buy Orders
                  </h3>
                  <div className="space-y-2">
                    {myBuyOrders.map((order: any, i: number) => (
                      <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-success-50/40 border border-success-100">
                        <div>
                          <p className="text-sm font-mono font-semibold text-surface-900">
                            ${Number(formatUnits(BigInt(order.usdtAmount || 0), USDT_DECIMALS)).toFixed(2)} USDT
                          </p>
                          <p className="text-xs text-surface-400">for {Number(formatUnits(BigInt(order.kairoAmount || 0), KAIRO_DECIMALS)).toFixed(2)} KAIRO</p>
                        </div>
                        <Button size="sm" variant="ghost" onClick={() => cancelBuyOrder(BigInt(order.id || i))} icon={<XMarkIcon className="w-4 h-4" />}>
                          Cancel
                        </Button>
                      </div>
                    ))}
                  </div>
                </GlassCard>
              )}
              {mySellOrders.length > 0 && (
                <GlassCard>
                  <h3 className="text-sm font-semibold text-danger-500 mb-3 flex items-center gap-2">
                    <TagIcon className="w-4 h-4" /> My Sell Orders
                  </h3>
                  <div className="space-y-2">
                    {mySellOrders.map((order: any, i: number) => (
                      <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-danger-50/40 border border-danger-100">
                        <div>
                          <p className="text-sm font-mono font-semibold text-surface-900">
                            {Number(formatUnits(BigInt(order.kairoAmount || 0), KAIRO_DECIMALS)).toFixed(2)} KAIRO
                          </p>
                          <p className="text-xs text-surface-400">for ${Number(formatUnits(BigInt(order.usdtAmount || 0), USDT_DECIMALS)).toFixed(2)} USDT</p>
                        </div>
                        <Button size="sm" variant="ghost" onClick={() => cancelSellOrder(BigInt(order.id || i))} icon={<XMarkIcon className="w-4 h-4" />}>
                          Cancel
                        </Button>
                      </div>
                    ))}
                  </div>
                </GlassCard>
              )}
            </>
          )}
        </TabContent>
      </Tabs>
    </div>
  );
}
