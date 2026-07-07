import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

const sqlPath = path.join(__dirname, '..', 'supabase-schema.sql');
const sql = fs.readFileSync(sqlPath, 'utf8');

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

await client.connect();

try {
  await client.query(sql);
  console.log('OK: full schema applied');

  const checks = await client.query(`
    select column_name from information_schema.columns
    where table_schema = 'public' and table_name = 'conversations'
      and column_name in ('notes', 'profile', 'channel', 'starred', 'interest_score')
    order by column_name
  `);
  console.log('conversations columns:', checks.rows.map((r) => r.column_name).join(', '));

  const assetCols = await client.query(`
    select column_name from information_schema.columns
    where table_schema = 'public' and table_name = 'ambassador_assets'
      and column_name in ('description', 'keywords')
    order by column_name
  `);
  console.log('ambassador_assets v4:', assetCols.rows.map((r) => r.column_name).join(', ') || 'missing');

  const policies = await client.query(`
    select policyname from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname like '%ambassador-media%'
  `);
  console.log('storage policies:', policies.rows.map((r) => r.policyname).join(', ') || 'none');
} catch (e) {
  console.error('ERR:', e.message);
  process.exit(1);
} finally {
  await client.end();
}
