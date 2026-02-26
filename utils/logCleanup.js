import pkg from "pg";
import logger from "./logger.js";
const { Pool } = pkg;

import pool from "../db/pool.js";

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