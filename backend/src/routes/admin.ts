import { Router, Request, Response } from 'express';
import { query } from '../db/connection';
import { isValidAddress } from '../utils/validation';
import { getTeamVolume, getLargestLeg, getDirectReferralCount, getDownline, getUpline } from '../utils/referral-tree';
import { getAffiliateDistributor, getCurrentBlock } from '../services/blockchain';
import { getConnectedClients } from '../services/websocket';
import { pool } from '../db/connection';
import { requireAdminJWT, AdminRequest } from './admin-auth';

const router = Router();

// ============ Legacy Admin Authentication Middleware (API key) ============
function requireAdminAuth(req: Request, res: Response, next: Function): void {
    const apiKey = process.env.ADMIN_API_KEY;
    if (!apiKey) {
        if (process.env.NODE_ENV === 'production') {
            res.status(403).json({ success: false, error: 'Admin access disabled (no ADMIN_API_KEY configured)' });
            return;
        }
        next();
        return;
    }
    const provided = req.headers['x-admin-key'] || req.query.admin_key;
    if (provided !== apiKey) {
        res.status(401).json({ success: false, error: 'Unauthorized: invalid admin key' });
        return;
    }
    next();
}

// Rank thresholds (team volume in USD, matching contract RANK_THRESHOLDS)
const RANK_THRESHOLDS = [
    10_000, 30_000, 100_000, 300_000, 1_000_000,
    3_000_000, 10_000_000, 30_000_000, 100_000_000, 250_000_000,
];

const RANK_NAMES_LIST = ['None', 'Associate', 'Executive', 'Director', 'Vice President', 'Senior VP', 'Managing Director', 'Partner', 'Senior Partner', 'Global Leader', 'Chairman'];

/**
 * Calculate rank for a single user based on team volume + direct referral count.
 * Returns the new rank level.
 */
async function calculateUserRank(address: string): Promise<{
    address: string;
    previousRank: number;
    newRank: number;
    teamVolume: string;
    directCount: number;
}> {
    const walletAddress = address.toLowerCase();

    const [userResult, teamVolume, directCount] = await Promise.all([
        query('SELECT rank_level FROM users WHERE wallet_address = $1', [walletAddress]),
        getTeamVolume(walletAddress),
        getDirectReferralCount(walletAddress),
    ]);

    const previousRank = userResult.rows[0]?.rank_level ?? 0;
    const tvNum = parseFloat(teamVolume);

    // Determine highest eligible rank (just team volume based)
    let newRank = 0;
    for (let i = RANK_THRESHOLDS.length - 1; i >= 0; i--) {
        if (tvNum >= RANK_THRESHOLDS[i]) {
            newRank = i + 1;
            break;
        }
    }

    // Always persist team_volume (keeps cache fresh); persist rank + log if changed
    await query(
        'UPDATE users SET rank_level = $1, team_volume = $2, updated_at = NOW() WHERE wallet_address = $3',
        [newRank, teamVolume, walletAddress]
    );

    if (newRank !== previousRank) {
        // Log rank change for the Rank Promotion Tracker
        await query(
            `INSERT INTO rank_history (wallet_address, previous_rank, new_rank, team_volume, direct_count)
             VALUES ($1, $2, $3, $4, $5)`,
            [walletAddress, previousRank, newRank, teamVolume, directCount]
        ).catch(() => { /* table may not exist yet */ });
    }

    return { address: walletAddress, previousRank, newRank, teamVolume, directCount };
}

/**
 * POST /api/v1/admin/calculate-rank
 * Body: { address?: string }
 * Trigger rank calculation for a specific user or all users.
 * First syncs total_staked_volume from the stakes table, then computes ranks.
 */
router.post('/admin/calculate-rank', requireAdminJWT, async (req: AdminRequest, res: Response) => {
    try {
        const { address } = req.body;

        // Step 1: Sync total_staked_volume from active stakes for accuracy
        console.log('[calculate-rank] Syncing total_staked_volume from stakes table...');
        await query(
            `UPDATE users u SET
                total_staked_volume = COALESCE((
                    SELECT SUM(s.original_amount)
                    FROM stakes s
                    WHERE s.user_address = u.wallet_address AND s.is_active = TRUE
                ), 0),
                updated_at = NOW()`
        );
        console.log('[calculate-rank] Volume sync complete.');

        if (address) {
            if (!isValidAddress(address)) {
                res.status(400).json({ success: false, error: 'Invalid Ethereum address' });
                return;
            }

            const userResult = await query(
                'SELECT * FROM users WHERE wallet_address = $1',
                [address.toLowerCase()]
            );
            if (userResult.rows.length === 0) {
                res.status(404).json({ success: false, error: 'User not found' });
                return;
            }

            const result = await calculateUserRank(address);

            res.json({
                success: true,
                message: `Rank calculation complete for ${address}`,
                data: result,
            });
        } else {
            // Calculate for all users
            const usersResult = await query('SELECT wallet_address FROM users ORDER BY created_at ASC');
            const results = [];
            let updated = 0;

            for (const row of usersResult.rows) {
                const result = await calculateUserRank(row.wallet_address);
                if (result.newRank !== result.previousRank) updated++;
                results.push(result);
            }

            res.json({
                success: true,
                message: `Rank calculation complete for ${usersResult.rows.length} users, ${updated} updated`,
                data: {
                    total: usersResult.rows.length,
                    updated,
                    results,
                },
            });
        }
    } catch (error) {
        console.error('Calculate rank error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

/**
 * GET /api/v1/admin/system-stats
 * System health: DB connections, last indexed block, queue sizes, WS clients
 */
router.get('/admin/system-stats', requireAdminAuth, async (_req: Request, res: Response) => {
    try {
        // DB pool stats
        const poolStats = {
            totalConnections: pool.totalCount,
            idleConnections: pool.idleCount,
            waitingRequests: pool.waitingCount,
        };

        // Last indexed blocks
        const indexerResult = await query(
            'SELECT contract_name, last_block, updated_at FROM indexer_state ORDER BY contract_name ASC'
        );

        // Current chain block
        let currentBlock = 0;
        try {
            currentBlock = await getCurrentBlock();
        } catch {
            // best-effort
        }

        // Basic counts
        const [usersCount, stakesCount, ordersCount] = await Promise.all([
            query('SELECT COUNT(*)::int AS count FROM users'),
            query('SELECT COUNT(*)::int AS count FROM stakes WHERE is_active = TRUE'),
            query('SELECT COUNT(*)::int AS count FROM p2p_orders WHERE is_active = TRUE'),
        ]);

        res.json({
            success: true,
            data: {
                database: poolStats,
                indexer: {
                    contracts: indexerResult.rows,
                    currentBlock,
                },
                websocket: {
                    connectedClients: getConnectedClients(),
                },
                counts: {
                    users: usersCount.rows[0]?.count || 0,
                    activeStakes: stakesCount.rows[0]?.count || 0,
                    activeOrders: ordersCount.rows[0]?.count || 0,
                },
                uptime: process.uptime(),
                memoryUsage: process.memoryUsage(),
            },
        });
    } catch (error) {
        console.error('System stats error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// ============ NEW: Staking Volume Tracker ============
/**
 * GET /api/v1/admin/staking-volume
 * Query params: wallet (optional), from, to, preset (24h|48h|7d), mode (self|team)
 */
router.get('/admin/staking-volume', requireAdminJWT, async (req: AdminRequest, res: Response) => {
    try {
        const { wallet, from, to, preset, mode } = req.query as Record<string, string>;

        let startDate: Date;
        let endDate: Date = new Date();

        if (preset) {
            const hours = preset === '24h' ? 24 : preset === '48h' ? 48 : 168; // 7d = 168h
            startDate = new Date(Date.now() - hours * 60 * 60 * 1000);
        } else if (from) {
            startDate = new Date(from);
            if (to) endDate = new Date(to);
        } else {
            startDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // default 24h
        }

        let sql = `
            SELECT user_address, 
                   COUNT(*)::int AS stake_count,
                   COALESCE(SUM(original_amount), 0) AS new_volume,
                   json_agg(json_build_object(
                       'stakeId', stake_id_on_chain,
                       'amount', original_amount,
                       'tier', tier,
                       'createdAt', created_at
                   ) ORDER BY created_at DESC) AS stakes
            FROM stakes
            WHERE created_at >= $1 AND created_at <= $2
        `;
        const params: any[] = [startDate.toISOString(), endDate.toISOString()];

        if (wallet && isValidAddress(wallet)) {
            const walletLower = wallet.toLowerCase();
            if (mode === 'team') {
                // Get all downline wallets from referral_tree
                const downlineResult = await query(
                    `SELECT descendant FROM referral_tree WHERE ancestor = $1 AND depth > 0`,
                    [walletLower]
                );
                const teamWallets = downlineResult.rows.map((r: any) => r.descendant);
                if (teamWallets.length === 0) {
                    res.json({
                        success: true,
                        data: {
                            from: startDate.toISOString(),
                            to: endDate.toISOString(),
                            mode: 'team',
                            parentWallet: walletLower,
                            totalWallets: 0,
                            totalVolume: '0',
                            wallets: [],
                        },
                    });
                    return;
                }
                // Build IN clause
                const placeholders = teamWallets.map((_: any, i: number) => `$${params.length + 1 + i}`).join(',');
                sql += ` AND user_address IN (${placeholders})`;
                params.push(...teamWallets);
            } else {
                sql += ` AND user_address = $${params.length + 1}`;
                params.push(walletLower);
            }
        }

        sql += ` GROUP BY user_address ORDER BY new_volume DESC`;

        const result = await query(sql, params);

        res.json({
            success: true,
            data: {
                from: startDate.toISOString(),
                to: endDate.toISOString(),
                mode: mode || 'self',
                parentWallet: wallet ? wallet.toLowerCase() : undefined,
                totalWallets: result.rows.length,
                totalVolume: result.rows.reduce((acc: number, r: any) => acc + parseFloat(r.new_volume), 0).toString(),
                wallets: result.rows.map((r: any) => ({
                    wallet: r.user_address,
                    stakeCount: r.stake_count,
                    newVolume: r.new_volume,
                    stakes: r.stakes,
                })),
            },
        });
    } catch (error) {
        console.error('Staking volume tracker error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// ============ NEW: Rank Holders List ============
/**
 * GET /api/v1/admin/rank-holders
 * Returns all users who qualify for a rank based on team volume.
 * Computes team volume LIVE from the referral_tree + total_staked_volume
 * so results are accurate even if the cached team_volume column is stale.
 * Also syncs total_staked_volume from active stakes before computing.
 */
router.get('/admin/rank-holders', requireAdminJWT, async (req: AdminRequest, res: Response) => {
    try {
        // Step 0: Sync total_staked_volume from stakes table for accuracy
        await query(
            `UPDATE users u SET
                total_staked_volume = COALESCE((
                    SELECT SUM(s.original_amount)
                    FROM stakes s
                    WHERE s.user_address = u.wallet_address AND s.is_active = TRUE
                ), 0),
                updated_at = NOW()`
        );

        // Compute team volume live: sum of descendants' total_staked_volume
        const result = await query(
            `SELECT
                u.wallet_address,
                u.rank_level,
                u.total_staked_volume,
                u.created_at,
                COALESCE(tv.computed_team_volume, 0) AS computed_team_volume,
                COALESCE(dc.direct_count, 0) AS direct_count
             FROM users u
             INNER JOIN (
                 SELECT rt.ancestor, SUM(u2.total_staked_volume) AS computed_team_volume
                 FROM referral_tree rt
                 JOIN users u2 ON u2.wallet_address = rt.descendant
                 WHERE rt.depth > 0
                 GROUP BY rt.ancestor
                 HAVING SUM(u2.total_staked_volume) >= $1
             ) tv ON tv.ancestor = u.wallet_address
             LEFT JOIN (
                 SELECT ancestor, COUNT(*)::int AS direct_count
                 FROM referral_tree WHERE depth = 1
                 GROUP BY ancestor
             ) dc ON dc.ancestor = u.wallet_address
             ORDER BY tv.computed_team_volume DESC`,
            [RANK_THRESHOLDS[0]]
        );

        const holders = result.rows.map((r: any) => {
            const tv = parseFloat(r.computed_team_volume || '0');
            // Calculate rank on the fly
            let computedRank = 0;
            for (let i = RANK_THRESHOLDS.length - 1; i >= 0; i--) {
                if (tv >= RANK_THRESHOLDS[i]) {
                    computedRank = i + 1;
                    break;
                }
            }
            return {
                wallet: r.wallet_address,
                rankLevel: computedRank,
                rankName: RANK_NAMES_LIST[computedRank] || `Rank ${computedRank}`,
                teamVolume: r.computed_team_volume,
                personalVolume: r.total_staked_volume,
                directCount: r.direct_count,
                joinedAt: r.created_at,
                dbRankLevel: r.rank_level,
            };
        }).filter((h: any) => h.rankLevel > 0);

        // Also update the cached team_volume column for users we just computed
        for (const h of holders) {
            query(
                'UPDATE users SET team_volume = $1, rank_level = $2, updated_at = NOW() WHERE wallet_address = $3',
                [h.teamVolume, h.rankLevel, h.wallet]
            ).catch(() => { /* best-effort cache update */ });
        }

        // Add diagnostic info to help debug empty results
        const [userCount, stakeCount, treeCount, volumeStats] = await Promise.all([
            query('SELECT COUNT(*)::int AS count FROM users'),
            query('SELECT COUNT(*)::int AS count FROM stakes WHERE is_active = TRUE'),
            query('SELECT COUNT(*)::int AS count FROM referral_tree WHERE depth > 0'),
            query('SELECT COUNT(*)::int AS with_volume FROM users WHERE total_staked_volume > 0'),
        ]);

        res.json({
            success: true,
            data: {
                totalHolders: holders.length,
                holders,
                diagnostics: {
                    totalUsers: userCount.rows[0]?.count || 0,
                    activeStakes: stakeCount.rows[0]?.count || 0,
                    referralTreeEntries: treeCount.rows[0]?.count || 0,
                    usersWithVolume: volumeStats.rows[0]?.with_volume || 0,
                    minRankThreshold: RANK_THRESHOLDS[0],
                },
            },
        });
    } catch (error) {
        console.error('Rank holders error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// ============ NEW: Rank Promotion Tracker ============
/**
 * GET /api/v1/admin/rank-promotions
 * Query params: from (ISO date), to (ISO date)
 */
router.get('/admin/rank-promotions', requireAdminJWT, async (req: AdminRequest, res: Response) => {
    try {
        const { from, to } = req.query as Record<string, string>;

        if (!from || !to) {
            res.status(400).json({ success: false, error: 'Both "from" and "to" date params are required' });
            return;
        }

        const result = await query(
            `SELECT wallet_address, previous_rank, new_rank, team_volume, direct_count, changed_at
             FROM rank_history
             WHERE changed_at >= $1 AND changed_at <= $2
               AND new_rank > previous_rank
             ORDER BY changed_at DESC`,
            [new Date(from).toISOString(), new Date(to).toISOString()]
        );

        res.json({
            success: true,
            data: {
                from,
                to,
                totalPromotions: result.rows.length,
                promotions: result.rows.map((r: any) => ({
                    wallet: r.wallet_address,
                    previousRank: r.previous_rank,
                    newRank: r.new_rank,
                    teamVolume: r.team_volume,
                    directCount: r.direct_count,
                    changedAt: r.changed_at,
                })),
            },
        });
    } catch (error) {
        console.error('Rank promotions tracker error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// ============ NEW: Volume Disbursement ============
/**
 * POST /api/v1/admin/disburse
 * Body: { wallet, amount, note? }
 */
router.post('/admin/disburse', requireAdminJWT, async (req: AdminRequest, res: Response) => {
    try {
        const { wallet, amount, note } = req.body;

        if (!wallet || !isValidAddress(wallet)) {
            res.status(400).json({ success: false, error: 'Valid wallet address required' });
            return;
        }
        if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
            res.status(400).json({ success: false, error: 'Valid positive amount required' });
            return;
        }

        const walletAddress = wallet.toLowerCase();
        const adminUsername = req.adminUsername || 'unknown';

        // Insert disbursement record
        const disbResult = await query(
            `INSERT INTO disbursements (target_wallet, amount, note, admin_username)
             VALUES ($1, $2, $3, $4) RETURNING id, created_at`,
            [walletAddress, amount, note || null, adminUsername]
        );
        const disbursementId = disbResult.rows[0].id;

        // Get upline tree and create rollup entries
        const upline = await getUpline(walletAddress, 15);
        const rollups: Array<{ wallet: string; depth: number }> = [];

        for (const ancestor of upline) {
            await query(
                `INSERT INTO disbursement_rollups (disbursement_id, wallet_address, depth, amount)
                 VALUES ($1, $2, $3, $4)`,
                [disbursementId, ancestor.ancestor, ancestor.depth, amount]
            );
            rollups.push({ wallet: ancestor.ancestor, depth: ancestor.depth });
        }

        res.json({
            success: true,
            data: {
                disbursementId,
                targetWallet: walletAddress,
                amount,
                note: note || null,
                adminUsername,
                createdAt: disbResult.rows[0].created_at,
                uplineRollups: rollups,
            },
        });
    } catch (error) {
        console.error('Disburse error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

/**
 * GET /api/v1/admin/disbursements
 * Query params: wallet (optional), page, limit
 */
router.get('/admin/disbursements', requireAdminJWT, async (req: AdminRequest, res: Response) => {
    try {
        const { wallet, page: pageStr, limit: limitStr } = req.query as Record<string, string>;
        const page = Math.max(1, parseInt(pageStr) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(limitStr) || 50));
        const offset = (page - 1) * limit;

        let sql = `SELECT id, target_wallet, amount, note, admin_username, created_at FROM disbursements`;
        let countSql = `SELECT COUNT(*)::int AS total FROM disbursements`;
        const params: any[] = [];
        const countParams: any[] = [];

        if (wallet && isValidAddress(wallet)) {
            sql += ` WHERE target_wallet = $1`;
            countSql += ` WHERE target_wallet = $1`;
            params.push(wallet.toLowerCase());
            countParams.push(wallet.toLowerCase());
        }

        sql += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(limit, offset);

        const [dataResult, countResult] = await Promise.all([
            query(sql, params),
            query(countSql, countParams),
        ]);

        res.json({
            success: true,
            data: {
                disbursements: dataResult.rows,
                pagination: {
                    page,
                    limit,
                    total: countResult.rows[0]?.total || 0,
                    pages: Math.ceil((countResult.rows[0]?.total || 0) / limit),
                },
            },
        });
    } catch (error) {
        console.error('List disbursements error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

/**
 * GET /api/v1/admin/disbursement-total/:wallet
 * Returns total disbursed for a wallet (direct + rollup from downline)
 */
router.get('/admin/disbursement-total/:wallet', requireAdminJWT, async (req: AdminRequest, res: Response) => {
    try {
        const { wallet } = req.params;
        if (!wallet || !isValidAddress(wallet)) {
            res.status(400).json({ success: false, error: 'Valid wallet address required' });
            return;
        }
        const walletAddress = wallet.toLowerCase();

        const [directResult, rollupResult] = await Promise.all([
            query(
                `SELECT COALESCE(SUM(amount), 0) AS total FROM disbursements WHERE target_wallet = $1`,
                [walletAddress]
            ),
            query(
                `SELECT COALESCE(SUM(amount), 0) AS total FROM disbursement_rollups WHERE wallet_address = $1`,
                [walletAddress]
            ),
        ]);

        const directTotal = parseFloat(directResult.rows[0]?.total || '0');
        const rollupTotal = parseFloat(rollupResult.rows[0]?.total || '0');

        res.json({
            success: true,
            data: {
                wallet: walletAddress,
                directDisbursed: directTotal.toString(),
                rollupFromDownline: rollupTotal.toString(),
                grandTotal: (directTotal + rollupTotal).toString(),
            },
        });
    } catch (error) {
        console.error('Disbursement total error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

export default router;
