import { Pool, QueryResult, QueryResultRow } from 'pg';
import { config } from '../config';

export const pool = new Pool({
    connectionString: config.databaseUrl,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
});

pool.on('error', (err: Error) => {
    console.error('Unexpected PostgreSQL pool error:', err);
});

pool.on('connect', () => {
    console.log('New PostgreSQL client connected');
});

/**
 * Execute a parameterized SQL query
 */
export async function query<T extends QueryResultRow = any>(
    text: string,
    params?: any[]
): Promise<QueryResult<T>> {
    const start = Date.now();
    const result = await pool.query<T>(text, params);
    const duration = Date.now() - start;

    if (config.nodeEnv === 'development') {
        console.log('Executed query', { text: text.substring(0, 80), duration, rows: result.rowCount });
    }

    return result;
}

/**
 * Get a client from the pool for transactions
 */
export async function getClient() {
    const client = await pool.connect();
    return client;
}

/**
 * Test database connection
 */
export async function testConnection(): Promise<boolean> {
    try {
        await pool.query('SELECT NOW()');
        console.log('PostgreSQL connection successful');
        return true;
    } catch (error) {
        console.error('PostgreSQL connection failed:', error);
        return false;
    }
}
