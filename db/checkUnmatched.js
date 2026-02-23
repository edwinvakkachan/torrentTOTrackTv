import { initDB } from "./db.js";

export async function isUnmatched(title, year, type) {
  const db = await initDB();

const result = await db.query(
  `SELECT 1 FROM trakt_review_queue
   WHERE title = $1
   AND year IS NOT DISTINCT FROM $2
   AND type = $3
   AND status != 'completed'`,
  [title, year, type]
);

  return result.rowCount > 0;
}