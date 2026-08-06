import dotenv from "dotenv";
dotenv.config();

const OMDB_API_KEY = process.env.OMDB_API_KEY;
const OMDB_BASE_URL = "https://www.omdbapi.com";

/**
 * Fetch movie metadata from OMDb using IMDb ID.
 *
 * @param {string} imdbId
 * @returns {Promise<Object|null>}
 */
export async function getOMDB(imdbId) {
  if (!imdbId) {
    return null;
  }

  const url = `${OMDB_BASE_URL}/?apikey=${OMDB_API_KEY}&i=${imdbId}`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`OMDb returned ${response.status}`);
    }

    const data = await response.json();

    if (data.Response === "False") {
      console.log(`OMDb: ${data.Error}`);
      return null;
    }

    return data;
  } catch (err) {
    console.error("OMDb Error:", err.message);
    return null;
  }
}