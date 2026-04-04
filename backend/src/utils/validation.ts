import { Request, Response, NextFunction } from 'express';

/**
 * Validate Ethereum address format (0x + 40 hex chars)
 */
export function isValidAddress(address: string): boolean {
    return /^0x[0-9a-fA-F]{40}$/.test(address);
}

/**
 * Middleware: validate :address param
 */
export function validateAddressParam(req: Request, res: Response, next: NextFunction): void {
    const { address } = req.params;
    if (!address || !isValidAddress(address)) {
        res.status(400).json({
            success: false,
            error: 'Invalid Ethereum address format. Expected 0x followed by 40 hex characters.',
        });
        return;
    }
    next();
}

/**
 * Clamp a numeric query param to a safe range
 */
export function clampInt(value: string | undefined, defaultVal: number, min: number, max: number): number {
    const parsed = parseInt(value as string, 10);
    if (isNaN(parsed)) return defaultVal;
    return Math.max(min, Math.min(max, parsed));
}

/**
 * Global error handling middleware
 */
export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
    console.error('Unhandled error:', err);
    res.status(500).json({
        success: false,
        error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error',
    });
}
