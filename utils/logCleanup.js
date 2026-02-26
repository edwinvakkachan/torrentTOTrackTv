import pkg from "pg";
import logger from "./logger.js";
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

export async function cleanupOldLogs() {
  try {
    const result = await pool.query(`
      DELETE FROM app_logs
      WHERE created_at < NOW() - INTERVAL '60 days'
      RETURNING id
    `);

    logger.info(`🧹 Deleted ${result.rowCount} old logs`);
  } catch (err) {
    logger.error("Log cleanup failed:", err);
  }
}