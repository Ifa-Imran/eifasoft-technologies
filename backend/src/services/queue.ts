/**
 * Queue module (no-op).
 * 
 * All on-chain operations (compounding, rank sync) are now user-initiated
 * from the frontend. The backend is read-only — no signing, no queues.
 * 
 * These exports remain for backward compatibility with index.ts imports.
 */

export async function initQueues(): Promise<void> {
    console.log('[Queues] No queues needed — all on-chain operations are user-initiated.');
}

export async function closeQueues(): Promise<void> {
    // no-op
}
