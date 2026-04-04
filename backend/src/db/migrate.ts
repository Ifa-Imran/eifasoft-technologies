import fs from 'fs';
import path from 'path';
import { pool } from './connection';

async function runMigrations(): Promise<void> {
    const migrationsDir = path.join(__dirname, 'migrations');

    console.log('Running database migrations...');
    console.log(`Migrations directory: ${migrationsDir}`);

    // Get all SQL files sorted by name
    const files = fs.readdirSync(migrationsDir)
        .filter((f) => f.endsWith('.sql'))
        .sort();

    if (files.length === 0) {
        console.log('No migration files found.');
        return;
    }

    const client = await pool.connect();

    try {
        // Create migrations tracking table if not exists
        await client.query(`
            CREATE TABLE IF NOT EXISTS _migrations (
                id SERIAL PRIMARY KEY,
                filename VARCHAR(255) UNIQUE NOT NULL,
                executed_at TIMESTAMP DEFAULT NOW()
            );
        `);

        for (const file of files) {
            // Check if migration already ran
            const { rows } = await client.query(
                'SELECT id FROM _migrations WHERE filename = $1',
                [file]
            );

            if (rows.length > 0) {
                console.log(`  Skipping (already applied): ${file}`);
                continue;
            }

            console.log(`  Applying: ${file}`);

            const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');

            await client.query('BEGIN');
            try {
                await client.query(sql);
                await client.query(
                    'INSERT INTO _migrations (filename) VALUES ($1)',
                    [file]
                );
                await client.query('COMMIT');
                console.log(`  Applied successfully: ${file}`);
            } catch (err) {
                await client.query('ROLLBACK');
                console.error(`  Failed to apply ${file}:`, err);
                throw err;
            }
        }

        console.log('All migrations complete.');
    } finally {
        client.release();
    }
}

// Run if executed directly
runMigrations()
    .then(() => {
        console.log('Migration process finished.');
        process.exit(0);
    })
    .catch((err) => {
        console.error('Migration process failed:', err);
        process.exit(1);
    });

export { runMigrations };
