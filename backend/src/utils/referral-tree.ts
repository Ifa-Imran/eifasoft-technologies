import { PoolClient } from 'pg';
import { query } from '../db/connection';

/**
 * Build referral tree entries when a new referrer is set.
 * Inserts ancestor-descendant pairs for all levels:
 *   - (referrer, user, depth=1)
 *   - All existing ancestors of referrer become ancestors of user at depth+1
 *
 * @param client - PG client (for use within a transaction)
 * @param user - The new user's wallet address (lowercase)
 * @param referrer - The referrer's wallet address (lowercase)
 */
export async function buildReferralTree(
    client: PoolClient,
    user: string,
    referrer: string
): Promise<void> {
    // Insert direct relationship: referrer -> user at depth 1
    await client.query(
        `INSERT INTO referral_tree (ancestor, descendant, depth)
         VALUES ($1, $2, 1)
         ON CONFLICT (ancestor, descendant) DO NOTHING`,
        [referrer, user]
    );

    // Insert self-referencing entry: user -> user at depth 0 (for closure table queries)
    await client.query(
        `INSERT INTO referral_tree (ancestor, descendant, depth)
         VALUES ($1, $1, 0)
         ON CONFLICT (ancestor, descendant) DO NOTHING`,
        [user]
    );

    // Ensure referrer has self-entry too
    await client.query(
        `INSERT INTO referral_tree (ancestor, descendant, depth)
         VALUES ($1, $1, 0)
         ON CONFLICT (ancestor, descendant) DO NOTHING`,
        [referrer]
    );

    // For all existing ancestors of referrer, add them as ancestors of user at depth+1
    // This propagates the full upline chain (capped at 15 levels for the affiliate system)
    await client.query(
        `INSERT INTO referral_tree (ancestor, descendant, depth)
         SELECT rt.ancestor, $1, rt.depth + 1
         FROM referral_tree rt
         WHERE rt.descendant = $2 AND rt.ancestor != $2 AND rt.depth + 1 <= 15
         ON CONFLICT (ancestor, descendant) DO NOTHING`,
        [user, referrer]
    );
}

/**
 * Get downline (descendants) of a user up to maxDepth levels.
 * @param user - Wallet address (lowercase)
 * @param maxDepth - Maximum depth to query (default 15)
 * @returns Array of { descendant, depth } objects
 */
export async function getDownline(
    user: string,
    maxDepth: number = 15
): Promise<Array<{ descendant: string; depth: number }>> {
    const result = await query(
        `SELECT descendant, depth FROM referral_tree
         WHERE ancestor = $1 AND depth > 0 AND depth <= $2
         ORDER BY depth ASC`,
        [user, maxDepth]
    );
    return result.rows;
}

/**
 * Get upline (ancestors) of a user up to maxDepth levels.
 * @param user - Wallet address (lowercase)
 * @param maxDepth - Maximum depth to query (default 15)
 * @returns Array of { ancestor, depth } objects
 */
export async function getUpline(
    user: string,
    maxDepth: number = 15
): Promise<Array<{ ancestor: string; depth: number }>> {
    const result = await query(
        `SELECT ancestor, depth FROM referral_tree
         WHERE descendant = $1 AND depth > 0 AND depth <= $2
         ORDER BY depth ASC`,
        [user, maxDepth]
    );
    return result.rows;
}

/**
 * Calculate total team volume for a user.
 * Sums total_staked_volume for all descendants in the referral tree.
 * @param user - Wallet address (lowercase)
 * @returns Team volume as a string (decimal)
 */
export async function getTeamVolume(user: string): Promise<string> {
    const result = await query(
        `SELECT COALESCE(SUM(u.total_staked_volume), 0) AS team_volume
         FROM referral_tree rt
         JOIN users u ON u.wallet_address = rt.descendant
         WHERE rt.ancestor = $1 AND rt.depth > 0`,
        [user]
    );
    return result.rows[0]?.team_volume || '0';
}

/**
 * Find the largest leg volume for a user.
 * A "leg" is a direct referral's total subtree volume (including the direct referral's own stake).
 * @param user - Wallet address (lowercase)
 * @returns Object with { largestLeg, largestLegAddress }
 */
export async function getLargestLeg(
    user: string
): Promise<{ largestLeg: string; largestLegAddress: string }> {
    // Get direct referrals (depth=1 descendants)
    const directsResult = await query(
        `SELECT descendant FROM referral_tree
         WHERE ancestor = $1 AND depth = 1`,
        [user]
    );

    let largestLeg = '0';
    let largestLegAddress = '';

    for (const row of directsResult.rows) {
        const directRef = row.descendant;

        // Get subtree volume for this direct referral (their own volume + their downline's)
        const volResult = await query(
            `SELECT COALESCE(SUM(u.total_staked_volume), 0) AS leg_volume
             FROM referral_tree rt
             JOIN users u ON u.wallet_address = rt.descendant
             WHERE rt.ancestor = $1 AND rt.depth >= 0`,
            [directRef]
        );

        const legVolume = volResult.rows[0]?.leg_volume || '0';

        if (parseFloat(legVolume) > parseFloat(largestLeg)) {
            largestLeg = legVolume;
            largestLegAddress = directRef;
        }
    }

    return { largestLeg, largestLegAddress };
}

/**
 * Get all leg volumes for a user.
 * Each "leg" is a direct referral's total subtree volume (including their own stake).
 * Used for the 50%-of-rank-target qualification rule.
 * @param user - Wallet address (lowercase)
 * @returns Array of leg volumes as numbers
 */
export async function getAllLegVolumes(user: string): Promise<number[]> {
    const directsResult = await query(
        `SELECT descendant FROM referral_tree
         WHERE ancestor = $1 AND depth = 1`,
        [user]
    );

    const legVolumes: number[] = [];

    for (const row of directsResult.rows) {
        const directRef = row.descendant;

        const volResult = await query(
            `SELECT COALESCE(SUM(u.total_staked_volume), 0) AS leg_volume
             FROM referral_tree rt
             JOIN users u ON u.wallet_address = rt.descendant
             WHERE rt.ancestor = $1 AND rt.depth >= 0`,
            [directRef]
        );

        legVolumes.push(parseFloat(volResult.rows[0]?.leg_volume || '0'));
    }

    return legVolumes;
}

/**
 * Get direct referral count for a user.
 * @param user - Wallet address (lowercase)
 * @returns Number of direct referrals
 */
export async function getDirectReferralCount(user: string): Promise<number> {
    const result = await query(
        `SELECT COUNT(*) AS count FROM referral_tree
         WHERE ancestor = $1 AND depth = 1`,
        [user]
    );
    return parseInt(result.rows[0]?.count || '0', 10);
}
