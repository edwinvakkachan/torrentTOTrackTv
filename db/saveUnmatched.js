import { initDB } from "./db.js";

export async function saveUnmatched(title, year, type) {
  const db = await initDB();

  try {
await db.query(
  `INSERT INTO trakt_review_queue (title, year, type)
   VALUES ($1, $2, $3)
   ON CONFLICT (title, year, type) DO NOTHING`,
  [title, year, type]
);
  } catch (err) {
    console.error("Unmatched insert error:", err.message);
  }
}