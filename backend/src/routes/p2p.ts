import { Router, Request, Response } from 'express';
import { ethers } from 'ethers';
import { query } from '../db/connection';
import { clampInt } from '../utils/validation';
import { cache, TTL } from '../utils/cache';
import { getLivePrice } from '../services/blockchain';

const router = Router();

/**
 * GET /api/v1/p2p/orderbook
 * Query params: ?side=buy|sell|all&page=1&limit=50&sort=price_asc|price_desc|time_desc
 */
router.get('/p2p/orderbook', async (req: Request, res: Response) => {
    try {
        const side = (req.query.side as string) || 'all';
        const page = clampInt(req.query.page as string, 1, 1, 1000);
        const limit = clampInt(req.query.limit as string, 50, 1, 100);
        const sort = (req.query.sort as string) || 'price_desc';
        const offset = (page - 1) * limit;

        // Determine sort clause per side
        const buySortClause =
            sort === 'price_asc'
                ? 'price_per_token ASC'
                : sort === 'time_desc'
                ? 'created_at DESC'
                : 'price_per_token DESC'; // best bids first

        const sellSortClause =
            sort === 'price_desc'
                ? 'price_per_token DESC'
                : sort === 'time_desc'
                ? 'created_at DESC'
                : 'price_per_token ASC'; // best asks first

        const fetchBuy = side === 'all' || side === 'buy';
        const fetchSell = side === 'all' || side === 'sell';

        // Parallel queries
        const [buyResult, sellResult, buyCountResult, sellCountResult] = await Promise.all([
            fetchBuy
                ? query(
                      `SELECT order_id_on_chain AS "orderId", creator, amount, price_per_token AS "pricePerToken",
                              remaining, created_at AS "createdAt"
                       FROM p2p_orders
                       WHERE order_type = 'buy' AND is_active = TRUE
                       ORDER BY ${buySortClause}
                       LIMIT $1 OFFSET $2`,
                      [limit, offset]
                  )
                : Promise.resolve({ rows: [] }),
            fetchSell
                ? query(
                      `SELECT order_id_on_chain AS "orderId", creator, amount, price_per_token AS "pricePerToken",
                              remaining, created_at AS "createdAt"
                       FROM p2p_orders
                       WHERE order_type = 'sell' AND is_active = TRUE
                       ORDER BY ${sellSortClause}
                       LIMIT $1 OFFSET $2`,
                      [limit, offset]
                  )
                : Promise.resolve({ rows: [] }),
            fetchBuy
                ? query(`SELECT COUNT(*)::int AS count FROM p2p_orders WHERE order_type = 'buy' AND is_active = TRUE`)
                : Promise.resolve({ rows: [{ count: 0 }] }),
            fetchSell
                ? query(`SELECT COUNT(*)::int AS count FROM p2p_orders WHERE order_type = 'sell' AND is_active = TRUE`)
                : Promise.resolve({ rows: [{ count: 0 }] }),
        ]);

        // Market price (cached)
        let marketPrice = '0';
        try {
            const priceBn = await cache.getOrSet('live:price', TTL.PRICE, getLivePrice);
            marketPrice = ethers.formatEther(priceBn);
        } catch {
            // best-effort
        }

        res.json({
            success: true,
            data: {
                buyOrders: buyResult.rows,
                sellOrders: sellResult.rows,
                pagination: {
                    page,
                    limit,
                    totalBuy: buyCountResult.rows[0]?.count || 0,
                    totalSell: sellCountResult.rows[0]?.count || 0,
                },
                marketPrice,
            },
        });
    } catch (error) {
        console.error('P2P orderbook error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

/**
 * GET /api/v1/p2p/trades
 * Query params: ?page=1&limit=50
 */
router.get('/p2p/trades', async (req: Request, res: Response) => {
    try {
        const page = clampInt(req.query.page as string, 1, 1, 1000);
        const limit = clampInt(req.query.limit as string, 50, 1, 100);
        const offset = (page - 1) * limit;

        const [tradesResult, countResult] = await Promise.all([
            query(
                `SELECT buy_order_id AS "buyOrderId", sell_order_id AS "sellOrderId",
                        buyer, seller, amount, price, tx_hash AS "txHash",
                        created_at AS "createdAt"
                 FROM p2p_trades
                 ORDER BY created_at DESC
                 LIMIT $1 OFFSET $2`,
                [limit, offset]
            ),
            query('SELECT COUNT(*)::int AS count FROM p2p_trades'),
        ]);

        res.json({
            success: true,
            data: {
                trades: tradesResult.rows,
                pagination: {
                    page,
                    limit,
                    total: countResult.rows[0]?.count || 0,
                },
            },
        });
    } catch (error) {
        console.error('P2P trades error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

export default router;
