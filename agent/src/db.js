// agent/src/db.js
import pg from 'pg';
import 'dotenv/config';

const pool = new pg.Pool({
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT),
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
  max: 10,
  idleTimeoutMillis: 30000
});

export const db = {
  query: (text, params) => pool.query(text, params),
  end: () => pool.end()
};
