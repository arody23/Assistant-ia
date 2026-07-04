import pg from 'pg';

const c = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
await c.connect();

const tables = await c.query(`
  select table_name from information_schema.tables
  where table_schema = 'public' and table_type = 'BASE TABLE'
  order by table_name
`);
console.log('ALL TABLES:', tables.rows.map((r) => r.table_name).join(', '));

const pattern = /order|commande|checkout|delivery|livraison|cart|panier|product/i;
for (const { table_name } of tables.rows.filter((r) => pattern.test(r.table_name))) {
  const cols = await c.query(
    `select column_name, data_type from information_schema.columns
     where table_schema = 'public' and table_name = $1 order by ordinal_position`,
    [table_name]
  );
  console.log(`\n=== ${table_name} ===`);
  console.log(cols.rows.map((r) => `${r.column_name}:${r.data_type}`).join('\n'));
}

await c.end();
