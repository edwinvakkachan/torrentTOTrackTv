import axios from "axios";
import { getValidAccessToken } from "./traktAuth.js";

const {
  TRAKT_CLIENT_ID,
  TRAKT_USERNAME,
  TRAKT_LIST_SLUG
} = process.env;

if (!TRAKT_CLIENT_ID || !TRAKT_USERNAME || !TRAKT_LIST_SLUG) {
  throw new Error("Missing required Trakt environment variables");
}

export async function callTrakt() {
  const startTime = Date.now();

  try {
    const token = await getValidAccessToken();

    const url = `https://api.trakt.tv/users/${TRAKT_USERNAME}/lists/${TRAKT_LIST_SLUG}/items`;

    const response = await axios.get(url, {
      headers: {
        "Content-Type": "application/json",
        "trakt-api-version": "2",
        "trakt-api-key": TRAKT_CLIENT_ID,
        Authorization: `Bearer ${token}`
      },
      timeout: 15000
    });

    console.log(`Trakt fetch successful (${Date.now() - startTime}ms)`);

    return response.data;

  } catch (error) {
    console.error("Trakt API request failed:", {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message
    });

    throw error;
  }
}