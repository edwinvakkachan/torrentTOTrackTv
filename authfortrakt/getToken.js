import axios from "axios";
import dotenv from "dotenv";
import pkg from "pg";
import { initDB } from "../db/db.js";

dotenv.config();

const { Pool } = pkg;

const {
  DATABASE_URL,
  TRAKT_CLIENT_ID,
  TRAKT_CLIENT_SECRET
} = process.env;

if (!DATABASE_URL || !TRAKT_CLIENT_ID || !TRAKT_CLIENT_SECRET) {
  console.error("Missing required environment variables");
  process.exit(1);
}

if (!process.argv[2]) {
  console.error("Authorization code required");
  console.error("Usage: node getToken.js <authorization_code>");
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function getToken(code) {
  try {
     const pool = await initDB(); 

    const res = await axios.post(
      "https://api.trakt.tv/oauth/token",
      {
        code,
        client_id: TRAKT_CLIENT_ID,
        client_secret: TRAKT_CLIENT_SECRET,
        redirect_uri: "urn:ietf:wg:oauth:2.0:oob",
        grant_type: "authorization_code"
      },
      { timeout: 15000 }
    );

    const { access_token, refresh_token, expires_in } = res.data;

    const expiresAt = new Date(Date.now() + expires_in * 1000);

    // Keep only one active token row
    await pool.query("TRUNCATE TABLE trakt_auth");

    await pool.query(
      `
      INSERT INTO trakt_auth (access_token, refresh_token, expires_at)
      VALUES ($1, $2, $3)
      `,
      [access_token, refresh_token, expiresAt]
    );

    console.log("Token saved successfully");

  } catch (error) {
    console.error("Token generation failed:", {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message
    });
  } finally {
    await pool.end();
  }
}

getToken(process.argv[2]);

// to get token  node authfortrakt/getToken.js 64d7f370