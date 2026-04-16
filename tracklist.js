import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();
import logger from "./utils/logger.js";
import { saveUnmatched } from './db/saveUnmatched.js';
import { getValidAccessToken } from './authfortrakt/traktAuth.js';
import { publishMessage } from './queue/publishMessage.js';

export async function parseTitle(rawName) {

  let name = rawName;

  // 1️⃣ Remove website prefix completely
  if (name.includes(" - ")) {
    name = name.split(" - ").slice(1).join(" - ");
  }

  name = name.trim();

  // 2️⃣ Extract title and year
  const match = name.match(/(.+?)\s*\((\d{4})\)/);
  if (!match) return null;

  let title = match[1].trim();
  const year = parseInt(match[2]);

  // 3️⃣ Detect show
  const isSeries = /S\d{1,2}|E\d{1,2}|Season|EP|Episode/i.test(name);

  return {
    title,
    year,
    type: isSeries ? "show" : "movie"
  };
}

export async function getMovieListItems() {
  const token = await getValidAccessToken();
  const response = await axios.get(
    "https://api.trakt.tv/users/wreath1553/lists/movie-malayalam/items",
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

export async function getpredvdMovieListItems() {
  const token = await getValidAccessToken();
  const response = await axios.get(
    "https://api.trakt.tv/users/wreath1553/lists/predvd/items",
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

export async function removeMoviesFromList(movieIds) {
  try {
    const token = await getValidAccessToken();
    const response = await axios.post(
      "https://api.trakt.tv/users/wreath1553/lists/movie-malayalam/items/remove",
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

export async function removeMoviesFrompredvdList(movieIds) {
  try {
    const token = await getValidAccessToken();
    const response = await axios.post(
      "https://api.trakt.tv/users/wreath1553/lists/predvd/items/remove",
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

export async function ensureListUnderLimit(incomingCount, limit = 80) {
  const items = await getMovieListItems();

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

  await removeMoviesFromList(ids);
}

export async function ensurepredvdListUnderLimit(incomingCount, limit = 80) {
  const items = await getpredvdMovieListItems();

  const current = items.length;
  const space = limit - current;

  if (space >= incomingCount) return;

  const overflow = incomingCount - space;

  const toRemove = items.slice(-overflow);
  const ids = toRemove.map(item => item.movie.ids.trakt);


  await publishMessage({
  message: `😭 🗑 Removing ${ids.length} Predvd movies to stay under limit`
});

console.log('⚠️ following predvd movies are removing from the list to stay under the limit');

  for (const x of toRemove){
    console.log(`❗${x.movie.title}`);
  }

  logger.info(`🗑 Removing ${ids.length} Predvd movies to stay under limit`);

  await removeMoviesFrompredvdList(ids);
}


export async function addMoviesBatchToTrakt(movies) {
  try {
    const token = await getValidAccessToken();
    const response = await axios.post(
      "https://api.trakt.tv/users/wreath1553/lists/movie-malayalam/items",
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

    logger.info("🎬 Batch Movie Response:", result);
  
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
  message:  `🎬 Added: ${result.added.movies}, Existing: ${result.existing.movies}`
});
    

  } catch (error) {
    logger.error("Batch Movie Error:", error.response?.data || error.message);
  }
}

export async function addMoviesBatchToTraktpredvd(movies) {
  try {
    const token = await getValidAccessToken();
    const response = await axios.post(
      "https://api.trakt.tv/users/wreath1553/lists/predvd/items",
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

    logger.info("🎬 Batch Movie Response:", result);

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
  message:  `🎬 Added: ${result.added.movies}, Existing: ${result.existing.movies}`
});
    

  } catch (error) {
    logger.error("Batch Movie Error:", error.response?.data || error.message);
  }
}

export async function addShowsBatchToTrakt(shows) {
  try {
    const token = await getValidAccessToken();
    const response = await axios.post(
      "https://api.trakt.tv/users/wreath1553/lists/showother/items",
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

    logger.info("📺 Batch Show Response:", result);

    // ✅ Send added/existing counts
           await publishMessage({
  message:  `📺 Added: ${result.added?.shows || 0}, Existing: ${result.existing?.shows || 0}`
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

export async function getShowListItems() {
  const token = await getValidAccessToken();
  const response = await axios.get(
    "https://api.trakt.tv/users/wreath1553/lists/showother/items",
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

export async function removeShowsFromList(showIds) {
  try {
    const token = await getValidAccessToken();
    const response = await axios.post(
      "https://api.trakt.tv/users/wreath1553/lists/showother/items/remove",
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
export async function ensureShowListUnderLimit(incomingCount, limit = 80) {
  const items = await getShowListItems();

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

  await removeShowsFromList(ids);
}