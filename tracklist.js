import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();
import { sendMessage } from './telegram/sendTelegramMessage.js';
import { delay } from './delay.js';


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
  const response = await axios.get(
    "https://api.trakt.tv/users/wreath1553/lists/movie-malayalam/items",
    {
      headers: {
        "Content-Type": "application/json",
        "trakt-api-version": "2",
        "trakt-api-key": process.env.TRAKT_CLIENT_ID,
        "Authorization": `Bearer ${process.env.TRAKT_TOKEN}`
      }
    }
  );

  return response.data;
}


export async function removeMoviesFromList(movieIds) {
  try {
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
          "Authorization": `Bearer ${process.env.TRAKT_TOKEN}`
        }
      }
    );

    console.log("🗑 Removed response:", response.data);
  } catch (error) {
    console.log("Delete error:", error.response?.data || error.message);
  }
}

export async function ensureListUnderLimit(incomingCount, limit = 80) {
  const items = await getMovieListItems();

  const current = items.length;
  const space = limit - current;

  if (space >= incomingCount) return;

  const overflow = incomingCount - space;

  const toRemove = items.slice(0, overflow);
  const ids = toRemove.map(item => item.movie.ids.trakt);
  await sendMessage(`😭 removing ${ids.length} movies from trakt`);

  console.log(`🗑 Removing ${ids.length} movies to stay under limit`);

  await removeMoviesFromList(ids);
}

// export async function addMoviesBatchToTrakt(movies) {
//   try {
//     const response = await axios.post(
//       "https://api.trakt.tv/users/wreath1553/lists/movie-malayalam/items",
//       { movies },
//       {
//         headers: {
//           "Content-Type": "application/json",
//           "trakt-api-version": "2",
//           "trakt-api-key": process.env.TRAKT_CLIENT_ID,
//           "Authorization": `Bearer ${process.env.TRAKT_TOKEN}`
//         }
//       }
//     );

//     console.log("🎬 Batch Movie Response:", response.data);
//     await sendMessage(`🎬 Batch movies processed: ${movies.length}`);

//   } catch (error) {
//     console.log("Batch Movie Error:", error.response?.data || error.message);
//   }
// }

export async function addMoviesBatchToTrakt(movies) {
  try {
    const response = await axios.post(
      "https://api.trakt.tv/users/wreath1553/lists/movie-malayalam/items",
      { movies },
      {
        headers: {
          "Content-Type": "application/json",
          "trakt-api-version": "2",
          "trakt-api-key": process.env.TRAKT_CLIENT_ID,
          "Authorization": `Bearer ${process.env.TRAKT_TOKEN}`
        }
      }
    );

    const result = response.data;

    console.log("🎬 Batch Movie Response:", result);

    // ✅ Check rejected movies
    if (result.not_found?.movies?.length > 0) {
      console.log("❌ Rejected movies:");
      await sendMessage("❌ Rejected movies:")
      for (const value of result.not_found.movies){
        console.log(value.title);
        await sendMessage(value.title)

      }
    }

    await sendMessage(
      `🎬 Added: ${result.added.movies}, Existing: ${result.existing.movies}`
    );

  } catch (error) {
    console.log("Batch Movie Error:", error.response?.data || error.message);
  }
}

// export async function addShowsBatchToTrakt(shows) {
//   try {
//     const response = await axios.post(
//       "https://api.trakt.tv/users/wreath1553/lists/showother/items",
//       { shows },
//       {
//         headers: {
//           "Content-Type": "application/json",
//           "trakt-api-version": "2",
//           "trakt-api-key": process.env.TRAKT_CLIENT_ID,
//           "Authorization": `Bearer ${process.env.TRAKT_TOKEN}`
//         }
//       }
//     );


//  const result = response.data;

//     console.log("📺 Batch Show Response:", result);
//     await sendMessage(`📺 Batch shows processed: ${shows.length}`);

//     // ✅ Check rejected movies
//     if (result.not_found?.shows?.length > 0) {
//       console.log("❌ Rejected shows:");
//       await sendMessage("❌ Rejected shows:")
//       for (const value of result.not_found.shows){
//         console.log(value.title);
//         await sendMessage(value.title)

//       }
//     }



//   } catch (error) {
//     console.log("Batch Show Error:", error.response?.data || error.message);
//   }
// }

export async function addShowsBatchToTrakt(shows) {
  try {
    const response = await axios.post(
      "https://api.trakt.tv/users/wreath1553/lists/showother/items",
      { shows },
      {
        headers: {
          "Content-Type": "application/json",
          "trakt-api-version": "2",
          "trakt-api-key": process.env.TRAKT_CLIENT_ID,
          "Authorization": `Bearer ${process.env.TRAKT_TOKEN}`
        }
      }
    );

    const result = response.data;

    console.log("📺 Batch Show Response:", result);

    // ✅ Send added/existing counts
    await sendMessage(
      `📺 Added: ${result.added?.shows || 0}, Existing: ${result.existing?.shows || 0}`
    );

    // ✅ Check rejected shows
    if (result.not_found?.shows?.length > 0) {
      console.log("❌ Rejected shows:");
      await sendMessage("❌ Rejected shows:");

      for (const value of result.not_found.shows) {
        console.log(value.title);
        await sendMessage(`${value.title} (${value.year || "Unknown Year"})`);
      }
    }

  } catch (error) {
    console.log("Batch Show Error:", error.response?.data || error.message);
  }
}

export async function getShowListItems() {
  const response = await axios.get(
    "https://api.trakt.tv/users/wreath1553/lists/showother/items",
    {
      headers: {
        "Content-Type": "application/json",
        "trakt-api-version": "2",
        "trakt-api-key": process.env.TRAKT_CLIENT_ID,
        "Authorization": `Bearer ${process.env.TRAKT_TOKEN}`
      }
    }
  );

  return response.data;
}

export async function removeShowsFromList(showIds) {
  try {
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
          "Authorization": `Bearer ${process.env.TRAKT_TOKEN}`
        }
      }
    );

    console.log("🗑 Shows removed:", response.data);

  } catch (error) {
    console.log("Show delete error:", error.response?.data || error.message);
  }
}
export async function ensureShowListUnderLimit(incomingCount, limit = 80) {
  const items = await getShowListItems();

  const current = items.length;
  const space = limit - current;

  if (space >= incomingCount) return;

  const overflow = incomingCount - space;
  const toRemove = items.slice(0, overflow);
  const ids = toRemove.map(item => item.show.ids.trakt);
  await sendMessage(`😭 removing ${ids.length} shows from trakt`)

  console.log(`🗑 Removing ${ids.length} shows to stay under limit`);

  await removeShowsFromList(ids);
}