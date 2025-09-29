// agent/src/db.js
import pg from 'pg';
import 'dotenv/config';

const pool = new pg.Pool({
  host: process.env.PGHOST || '10.33.16.10',
  port: Number(process.env.PGPORT || 5433),
  user: process.env.PGUSER || 'yugabyte',
  password: process.env.PGPASSWORD || 'yugabyte',
  database: process.env.PGDATABASE || 'upi',
  max: 10,
  idleTimeoutMillis: 30000
});

export const db = {
  query: (text, params) => pool.query(text, params),
  end: () => pool.end()
};
