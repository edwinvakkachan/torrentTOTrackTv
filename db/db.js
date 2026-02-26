import pkg from "pg";
const { Pool } = pkg;
import 'dotenv/config';
import { delay } from "../delay.js";



const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});
export async function initDB() {
 
 await pool.query(`
  CREATE TABLE IF NOT EXISTS trakt_review_queue (
    id SERIAL PRIMARY KEY,

    title TEXT NOT NULL,
    year INTEGER,
    type TEXT NOT NULL CHECK (type IN ('movie','show')),

    reason TEXT DEFAULT 'not_found_in_trakt',

    status TEXT NOT NULL DEFAULT 'pending'
      CHECK (status IN ('pending','completed','ignored')),

    manually_added BOOLEAN DEFAULT FALSE,
    retry_count INTEGER DEFAULT 0,

    notes TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,

    UNIQUE(title, year, type)
  )
`);

await pool.query(`
  CREATE INDEX IF NOT EXISTS idx_trakt_status
  ON trakt_review_queue(status);

  CREATE INDEX IF NOT EXISTS idx_trakt_created
  ON trakt_review_queue(created_at DESC);
`);

await pool.query(`
  CREATE TABLE IF NOT EXISTS app_logs (
    id SERIAL PRIMARY KEY,
    level VARCHAR(20),
    message TEXT,
    meta JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`);

  return pool;
}

