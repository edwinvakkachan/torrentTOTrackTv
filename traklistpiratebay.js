import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();
import logger from "./utils/logger.js";
import { saveUnmatched } from './db/saveUnmatched.js';
import { getValidAccessToken } from './authfortrakt/traktAuth.js';
import { publishMessage } from './queue/publishMessage.js';

export async function parseTitle(rawName) {
  let name = rawName.toLowerCase().trim();

  // TV Show
  const showMatch = name.match(/(.+?)\s+s(\d{1,2})e(\d{1,2})/i);

  if (showMatch) {
    return {
      title: showMatch[1]
        .replace(/[.\-_]+/g, " ")
        .trim(),
      year: null,
      type: "show"
    };
  }

  // Movie with year anywhere
  const movieMatch = name.match(/(.+?)\s+(19\d{2}|20\d{2})/);

  if (movieMatch) {
    return {
      title: movieMatch[1]
        .replace(/[.\-_]+/g, " ")
        .trim(),
      year: parseInt(movieMatch[2]),
      type: "movie"
    };
  }

  return null;
}

export async function getEnglishMovieListItems() {
  const token = await getValidAccessToken();
  const response = await axios.get(
    "https://api.trakt.tv/users/wreath1553/lists/movie-english/items",
    {
      headers: {
        "Content-Type": "application/json",
        "trakt-api-version": "2",
        "trakt-api-key": process.env.TRAKT_CLIENT_ID,
        "Authorization": `Bearer ${token}`
      }
    }
  );

  return response.data;
}



export async function removeMoviesFromEnglishList(movieIds) {
  try {
    const token = await getValidAccessToken();
    const response = await axios.post(
      "https://api.trakt.tv/users/wreath1553/lists/movie-english/items/remove",
      {
        movies: movieIds.map(id => ({
          ids: { trakt: id }
        }))
      },
      {
        headers: {
          "Content-Type": "application/json",
          "trakt-api-version": "2",
          "trakt-api-key": process.env.TRAKT_CLIENT_ID,
          "Authorization": `Bearer ${token}`
        }
      }
    );

    logger.info("🗑 Removed response:", response.data);
  } catch (error) {
    logger.error("Delete error:", error.response?.data || error.message);
  }
}



export async function ensureEnglishListUnderLimit(incomingCount, limit = 80) {
  const items = await getEnglishMovieListItems();

  const current = items.length;
  const space = limit - current;

  if (space >= incomingCount) return;

  const overflow = incomingCount - space;

  // const toRemove = items.slice(0, overflow);
  const toRemove = items.slice(-overflow);
  const ids = toRemove.map(item => item.movie.ids.trakt);


  console.log('⚠️ following movies are removing from the list to stay under the limit');

  for (const x of toRemove){
    console.log(`❗${x.movie.title}`);
  }


  await publishMessage({
  message: `😭 🗑 Removing ${ids.length} movies to stay under limit`
});

  logger.info(`🗑 Removing ${ids.length} movies to stay under limit`);

  await removeMoviesFromEnglishList(ids);
}




export async function addEnglishMoviesBatchToTrakt(movies) {
  try {
    const token = await getValidAccessToken();
    const response = await axios.post(
      "https://api.trakt.tv/users/wreath1553/lists/movie-english/items",
      { movies },
      {
        headers: {
          "Content-Type": "application/json",
          "trakt-api-version": "2",
          "trakt-api-key": process.env.TRAKT_CLIENT_ID,
          "Authorization": `Bearer ${token}`
        }
      }
    );

    const result = response.data;

    logger.info("🎬 Batch Movie Response:");
    console.log(`total added movies: ${result.added.movies} \n Existing: ${result.existing.movies}`)
  
    // ✅ Check rejected movies
   if (result.not_found?.movies?.length > 0) {
  logger.info("❌ Rejected movies:");
    await publishMessage({
  message: "❌ Rejected movies:"
});

  for (const value of result.not_found.movies) {
    logger.info(value.title);
       await publishMessage({
  message: `${value.title}`
});

    await saveUnmatched(
      value.title,
      value.year || null,
      "movie"
    );
  }
}

       await publishMessage({
  message:  `🎬 Added movies: ${result.added.movies}, Existing movies: ${result.existing.movies}`
});
    

  } catch (error) {
    logger.error("Batch Movie Error:", error.response?.data || error.message);
  }
}


export async function addEnglishShowsBatchToTrakt(shows) {
  try {
    const token = await getValidAccessToken();
    const response = await axios.post(
      "https://api.trakt.tv/users/wreath1553/lists/showsenglish/items",
      { shows },
      {
        headers: {
          "Content-Type": "application/json",
          "trakt-api-version": "2",
          "trakt-api-key": process.env.TRAKT_CLIENT_ID,
          "Authorization": `Bearer ${token}`
        }
      }
    );

    const result = response.data;

    logger.info("📺 Batch Show Response:");
    console.log(`total added shows: ${result.added?.shows || 0} \n Existing: ${result.existing?.shows || 0}`)

    // ✅ Send added/existing counts
           await publishMessage({
  message:  `📺 Added shows: ${result.added?.shows || 0}, Existing shows: ${result.existing?.shows || 0}`
});

    // ✅ Check rejected shows
   if (result.not_found?.shows?.length > 0) {
  logger.error("❌ Rejected shows:");
             await publishMessage({
  message:  "❌ Rejected shows:"
});


  for (const value of result.not_found.shows) {
    logger.info(value.title);
           await publishMessage({
  message:  `${value.title} (${value.year || "Unknown Year"})`
});
    await saveUnmatched(
      value.title,
      value.year || null,
      "show"
    );
  }
}

  } catch (error) {
    logger.error("Batch Show Error:", error.response?.data || error.message);
  }
}

export async function getEnglishShowListItems() {
  const token = await getValidAccessToken();
  const response = await axios.get(
    "https://api.trakt.tv/users/wreath1553/lists/showsenglish/items",
    {
      headers: {
        "Content-Type": "application/json",
        "trakt-api-version": "2",
        "trakt-api-key": process.env.TRAKT_CLIENT_ID,
        "Authorization": `Bearer ${token}`
      }
    }
  );

  return response.data;
}

export async function removeEnglishShowsFromList(showIds) {
  try {
    const token = await getValidAccessToken();
    const response = await axios.post(
      "https://api.trakt.tv/users/wreath1553/lists/showsenglish/items/remove",
      {
        shows: showIds.map(id => ({
          ids: { trakt: id }
        }))
      },
      {
        headers: {
          "Content-Type": "application/json",
          "trakt-api-version": "2",
          "trakt-api-key": process.env.TRAKT_CLIENT_ID,
          "Authorization": `Bearer ${token}`
        }
      }
    );

    logger.info("🗑 Shows removed:", response.data);

  } catch (error) {
    logger.error("Show delete error:", error.response?.data || error.message);
  }
}
export async function ensureEnglishShowListUnderLimit(incomingCount, limit = 80) {
  const items = await getEnglishShowListItems();

  const current = items.length;
  const space = limit - current;

  if (space >= incomingCount) return;

  const overflow = incomingCount - space;
  const toRemove = items.slice(-overflow);

console.log('⚠️ following shows  are removing from the list to stay under the limit');

  for (const x of toRemove){
    console.log(`❗${x.show.title}`);
  }

  
  const ids = toRemove.map(item => item.show.ids.trakt);
           await publishMessage({
  message:  `🗑 Removing ${ids.length} shows to stay under limit`
});
  logger.info(`🗑 Removing ${ids.length} shows to stay under limit`);

  await removeEnglishShowsFromList(ids);
}

