import pg from "pg";
import "dotenv/config";

const c = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
await c.connect();

const cols = await c.query(
  `select column_name, data_type from information_schema.columns
   where table_schema = 'public' and table_name = 'profiles' order by ordinal_position`
);
console.log("=== profiles ===");
console.log(cols.rows.map((r) => `${r.column_name}:${r.data_type}`).join("\n"));

const zones = await c.query(
  "select id, name, city, price, zone_type from delivery_zones where is_active = true order by name limit 8"
);
console.log("\n=== delivery_zones sample ===");
console.log(JSON.stringify(zones.rows, null, 2));

const lastOrders = await c.query(
  `select customer_name, customer_phone, delivery_address, delivery_fee
   from orders where customer_phone is not null order by created_at desc limit 3`
);
console.log("\n=== recent orders sample ===");
console.log(JSON.stringify(lastOrders.rows, null, 2));

await c.end();
