import axios from "axios";
import pkg from "pg";
import dotenv from "dotenv";
import logger from "../utils/logger.js";

dotenv.config();

const { Pool } = pkg;

const {
  DATABASE_URL,
  TRAKT_CLIENT_ID,
  TRAKT_CLIENT_SECRET
} = process.env;

if (!DATABASE_URL || !TRAKT_CLIENT_ID || !TRAKT_CLIENT_SECRET) {
  throw new Error("Missing required environment variables");
}

import pool from "../db/pool.js";

const EXPIRY_MARGIN_MS = 60000; // 60 seconds safety margin

export async function getValidAccessToken() {
  const { rows } = await pool.query(
    `SELECT * FROM trakt_auth ORDER BY id DESC LIMIT 1`
  );

  if (!rows.length) {
    throw new Error("No Trakt token found in DB");
  }

  const tokenData = rows[0];
  const now = new Date();
  const safeExpiry = new Date(
    new Date(tokenData.expires_at).getTime() - EXPIRY_MARGIN_MS
  );

  // Token still valid
  if (now < safeExpiry) {
    return tokenData.access_token;
  }

  logger.info("Token expired. Refreshing...");

  try {
    const res = await axios.post(
      "https://api.trakt.tv/oauth/token",
      {
        refresh_token: tokenData.refresh_token,
        client_id: TRAKT_CLIENT_ID,
        client_secret: TRAKT_CLIENT_SECRET,
        redirect_uri: "urn:ietf:wg:oauth:2.0:oob",
        grant_type: "refresh_token"
      },
      { timeout: 15000 }
    );

    const { access_token, refresh_token, expires_in } = res.data;
    const expiresAt = new Date(Date.now() + expires_in * 1000);

    await pool.query(
      `
      UPDATE trakt_auth
      SET access_token = $1,
          refresh_token = $2,
          expires_at = $3,
          updated_at = NOW()
      WHERE id = $4
      `,
      [access_token, refresh_token, expiresAt, tokenData.id]
    );

    logger.info("Token refreshed successfully");

    return access_token;

  } catch (error) {
    logger.error("Token refresh failed:", {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message
    });

    throw new Error("Trakt refresh failed — reauthentication required");
  }
}