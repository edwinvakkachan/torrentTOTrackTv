import pkg from "pg";
const { Pool } = pkg;

import pool from "../db/pool.js";

export async function cleanupOldLogs() {
  try {
    const result = await pool.query(`
      DELETE FROM app_logs
      WHERE created_at < NOW() - INTERVAL '60 days'
      RETURNING id
    `);

  } catch (err) {
    console.error("Log cleanup failed:", err);
  }
}
