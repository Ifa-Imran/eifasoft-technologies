'use client';

import { useState, useMemo, useEffect } from 'react';
import { Modal, Button } from '@/components/ui';
import { parseUnits, formatUnits } from 'viem';
import { USDT_DECIMALS, KAIRO_DECIMALS } from '@/config/contracts';

interface FillOrderModalProps {
  open: boolean;
  onClose: () => void;
  /** "buy" if filling a buy order (taker SELLS kairo), "sell" if filling a sell order (taker BUYS kairo). */
  side: 'buy' | 'sell';
  /** Order ID on-chain. */
  orderId: bigint;
  /** For buy orders: usdtRemaining (6d). For sell orders: kairoRemaining (18d). */
  orderRemainingRaw: bigint;
  /** Live price (USDT 1e18 per KAIRO unit). */
  currentPrice: bigint;
  /** Taker's wallet KAIRO balance (raw, 18d). */
  kairoBalanceRaw: bigint;
  /** Taker's wallet USDT balance (raw, 6d). */
  usdtBalanceRaw: bigint;
  /** Whether the taker has approved enough of the required token already. */
  hasAllowance: (rawAmount: bigint) => boolean;
  /** Approve the spending. */
  approve: (rawAmount: bigint) => void;
  /** Submit the fill (kairoAmount in 18d raw). */
  onFill: (orderId: bigint, kairoAmountRaw: bigint) => void;
  isPending: boolean;
}

const FEE_BPS = 500n; // 5%
const BPS_DENOM = 10000n;

/**
 * Partial-fill modal for P2P orders.
 *
 * The user enters a KAIRO amount they want to swap (capped by both the order's
 * remaining liquidity and the user's own wallet balance for the required token).
 * Live preview shows fees and net amounts received.
 */
export function FillOrderModal(props: FillOrderModalProps) {
  const {
    open, onClose, side, orderId, orderRemainingRaw, currentPrice,
    kairoBalanceRaw, usdtBalanceRaw, hasAllowance, approve, onFill, isPending,
  } = props;

  // Compute the max KAIRO the user can fill: bounded by both the order and the wallet.
  const maxFillKairoRaw = useMemo(() => {
    if (currentPrice === 0n) return 0n;
    if (side === 'buy') {
      // Filling a buy order means we (taker) SELL kairo to it.
      // Bound 1: order has usdtRemaining USDT to pay out → max kairo = usdtRemaining * 1e18 / price.
      // Note: usdtRemaining is in 18d in the contract (USDT token is 18d on opBNB testnet).
      const fromOrder = (orderRemainingRaw * (10n ** BigInt(KAIRO_DECIMALS))) / currentPrice;
      const fromWallet = kairoBalanceRaw;
      return fromOrder < fromWallet ? fromOrder : fromWallet;
    } else {
      // Filling a sell order means we (taker) BUY kairo from it. Need USDT.
      // Bound 1: order has kairoRemaining KAIRO available.
      // Bound 2: user's USDT balance covers kairoAmount * price / 1e18.
      const fromOrder = orderRemainingRaw;
      const maxFromWallet = currentPrice > 0n
        ? (usdtBalanceRaw * (10n ** BigInt(KAIRO_DECIMALS))) / currentPrice
        : 0n;
      return fromOrder < maxFromWallet ? fromOrder : maxFromWallet;
    }
  }, [side, orderRemainingRaw, currentPrice, kairoBalanceRaw, usdtBalanceRaw]);

  const maxFillKairoNum = Number(formatUnits(maxFillKairoRaw, KAIRO_DECIMALS));
  const orderRemainingDisplay = side === 'buy'
    ? Number(formatUnits(orderRemainingRaw, USDT_DECIMALS))
    : Number(formatUnits(orderRemainingRaw, KAIRO_DECIMALS));

  const [amountStr, setAmountStr] = useState('');
  const amountNum = Number(amountStr) || 0;

  // Reset input on modal open/close or order change.
  useEffect(() => {
    if (open) setAmountStr('');
  }, [open, orderId]);

  const amountRaw = useMemo(() => {
    if (!amountStr || amountNum <= 0) return 0n;
    try { return parseUnits(amountStr, KAIRO_DECIMALS); } catch { return 0n; }
  }, [amountStr, amountNum]);

  const overMax = amountRaw > maxFillKairoRaw;

  // Live preview: USDT involved + fees + net amounts.
  const preview = useMemo(() => {
    if (amountRaw === 0n || currentPrice === 0n) {
      return { usdt: 0, kairoFee: 0, usdtFee: 0, netKairo: 0, netUsdt: 0 };
    }
    const usdtRaw = (amountRaw * currentPrice) / (10n ** BigInt(KAIRO_DECIMALS));
    const usdtFeeRaw = (usdtRaw * FEE_BPS) / BPS_DENOM;
    const kairoFeeRaw = (amountRaw * FEE_BPS) / BPS_DENOM;
    const netUsdtRaw = usdtRaw - usdtFeeRaw;
    const netKairoRaw = amountRaw - kairoFeeRaw;
    return {
      usdt: Number(formatUnits(usdtRaw, USDT_DECIMALS)),
      kairoFee: Number(formatUnits(kairoFeeRaw, KAIRO_DECIMALS)),
      usdtFee: Number(formatUnits(usdtFeeRaw, USDT_DECIMALS)),
      netKairo: Number(formatUnits(netKairoRaw, KAIRO_DECIMALS)),
      netUsdt: Number(formatUnits(netUsdtRaw, USDT_DECIMALS)),
    };
  }, [amountRaw, currentPrice]);

  // For approval, we approve KAIRO when filling a buy order, USDT when filling a sell order.
  const approvalRequiredRaw = side === 'buy'
    ? amountRaw
    : (amountRaw * currentPrice) / (10n ** BigInt(KAIRO_DECIMALS));

  const needsApproval = amountRaw > 0n && !hasAllowance(approvalRequiredRaw);
  const canSubmit = amountRaw > 0n && !overMax && !isPending;

  const setPct = (pct: number) => {
    if (maxFillKairoNum <= 0) return;
    const v = (maxFillKairoNum * pct) / 100;
    setAmountStr(v > 0 ? v.toFixed(6) : '0');
  };

  const handleSubmit = () => {
    if (!canSubmit) return;
    if (needsApproval) {
      approve(approvalRequiredRaw);
      return;
    }
    onFill(orderId, amountRaw);
  };

  const tokenLabel = side === 'buy' ? 'KAIRO to sell' : 'KAIRO to buy';
  const counterToken = side === 'buy' ? 'USDT (you receive)' : 'USDT (you pay)';

  return (
    <Modal open={open} onOpenChange={(o) => { if (!o) onClose(); }} title={side === 'buy' ? 'Fill Buy Order' : 'Fill Sell Order'}>
      <div className="space-y-4 min-w-0">
        <div className="text-xs text-surface-500 -mt-2 break-words">
          Order #{orderId.toString()} · {side === 'buy' ? 'has' : 'sells'}{' '}
          <span className="font-mono font-semibold text-surface-700">
            {side === 'buy'
              ? `$${orderRemainingDisplay.toFixed(2)}`
              : `${orderRemainingDisplay.toFixed(2)} KAIRO`}
          </span>{' '}
          remaining.{' '}
          <span className="text-surface-400">
            You can fill any partial amount.
          </span>
        </div>

        <div className="min-w-0">
          <div className="flex justify-between items-center mb-1.5 gap-2">
            <label className="text-sm font-medium text-surface-600 truncate">{tokenLabel}</label>
            <span className="text-xs text-surface-400 truncate">
              Max: <button
                type="button"
                onClick={() => setPct(100)}
                className="text-primary-600 hover:text-primary-700 font-medium underline-offset-2 hover:underline"
              >
                {maxFillKairoNum.toFixed(4)} KAIRO
              </button>
            </span>
          </div>
          <input
            type="number"
            placeholder="0.00"
            value={amountStr}
            onChange={(e) => setAmountStr(e.target.value)}
            className="input-field w-full"
            min="0"
            step="any"
            inputMode="decimal"
          />
          <div className="grid grid-cols-4 gap-1.5 mt-2">
            {[25, 50, 75, 100].map((pct) => (
              <button
                key={pct}
                type="button"
                onClick={() => setPct(pct)}
                className="py-1.5 px-1 text-[11px] rounded-lg bg-surface-100 hover:bg-surface-200 text-surface-600 font-medium transition-colors"
              >
                {pct === 100 ? 'MAX' : `${pct}%`}
              </button>
            ))}
          </div>
          {overMax && (
            <p className="mt-1.5 text-xs text-danger-500 break-words">
              Exceeds max ({maxFillKairoNum.toFixed(4)} KAIRO) — capped by{' '}
              {side === 'buy' ? 'order liquidity / your KAIRO balance' : 'order liquidity / your USDT balance'}.
            </p>
          )}
        </div>

        {amountNum > 0 && !overMax && (
          <div className="p-3 rounded-xl bg-surface-50 border border-surface-200 space-y-1.5 text-xs min-w-0">
            <div className="flex justify-between gap-2 text-surface-500">
              <span className="truncate">{counterToken}</span>
              <span className="font-mono flex-shrink-0">${preview.usdt.toFixed(4)}</span>
            </div>
            <div className="flex justify-between gap-2 text-surface-500">
              <span className="truncate">KAIRO fee (5%, burned)</span>
              <span className="font-mono flex-shrink-0">{preview.kairoFee.toFixed(4)} KAIRO</span>
            </div>
            <div className="flex justify-between gap-2 text-surface-500">
              <span className="truncate">USDT fee (5%, to LP)</span>
              <span className="font-mono flex-shrink-0">${preview.usdtFee.toFixed(4)}</span>
            </div>
            <div className="border-t border-surface-200 pt-1.5 flex justify-between gap-2 font-semibold text-surface-900">
              <span className="truncate">You {side === 'buy' ? 'receive' : 'get'}</span>
              <span className="font-mono flex-shrink-0">
                {side === 'buy'
                  ? `$${preview.netUsdt.toFixed(4)}`
                  : `${preview.netKairo.toFixed(4)} KAIRO`}
              </span>
            </div>
          </div>
        )}

        <div className="flex flex-col-reverse sm:flex-row gap-2 pt-1">
          <Button variant="ghost" onClick={onClose} className="sm:flex-1 w-full">Cancel</Button>
          <Button
            variant={side === 'buy' ? 'success' : 'primary'}
            onClick={handleSubmit}
            disabled={!canSubmit}
            loading={isPending}
            className="sm:flex-1 w-full"
          >
            {amountRaw === 0n
              ? 'Enter amount'
              : overMax
                ? 'Amount exceeds max'
                : needsApproval
                  ? `Approve ${side === 'buy' ? 'KAIRO' : 'USDT'}`
                  : side === 'buy' ? 'Sell KAIRO' : 'Buy KAIRO'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
