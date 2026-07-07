import pg from "pg";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const sqlPath = path.join(__dirname, "migrate-auth-rls.sql");
const sql = fs.readFileSync(sqlPath, "utf8");

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

await client.connect();

try {
  await client.query(sql);
  console.log("OK: auth RLS migration applied");

  const policies = await client.query(`
    select tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and policyname like 'admin all%'
    order by tablename
  `);
  console.log("admin policies:", policies.rows.map((r) => `${r.tablename}:${r.policyname}`).join(", "));
} catch (e) {
  console.error("ERR:", e.message);
  process.exit(1);
} finally {
  await client.end();
}
