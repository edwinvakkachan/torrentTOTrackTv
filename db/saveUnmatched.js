
import logger from "../utils/logger.js";
import pool from "./pool.js";


export async function saveUnmatched(title, year, type) {

const db = pool;
  try {
await db.query(
  `INSERT INTO trakt_review_queue (title, year, type)
   VALUES ($1, $2, $3)
   ON CONFLICT (title, year, type) DO NOTHING`,
  [title, year, type]
);
  } catch (err) {
    logger.error("Unmatched insert error:", err.message);
  }
}