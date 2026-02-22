import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();
import { sendMessage } from './telegram/sendTelegramMessage.js';
import { delay } from './delay.js';

export async function addShowToTrakt(title, year) {
  try {
    const response = await axios.post(
      "https://api.trakt.tv/users/wreath1553/lists/showother/items",
      {
        shows: [{ title, year }]
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

    console.log("Trakt Show Response:", response.data);

    const { added, existing, not_found } = response.data;

    if (added.shows > 0) {
      console.log(`➕ Added to ShowOther: ${title}`);
      await sendMessage(`➕ Added to ShowOther: ${title}`);

    } else if (existing.shows > 0) {
      console.log(`⚠️ Already exists in list: ${title}`);
      // await sendMessage(`⚠️ Already exists in list: ${title}`);

    } else if (not_found.shows.length > 0) {
      console.log(`❌ Show not found in Trakt database: ${title}`);
      console.log("🚧 Not found details:", not_found.shows);
      await sendMessage(`❌ Show not found in Trakt database:`);
      await sendMessage(`${title}`)
    } else {
      console.log(`⚠️ Unknown state for show: ${title}`);
      await sendMessage(`⚠️ Unknown state for show:`);
      await sendMessage(`${title}`)
    }

  } catch (error) {
  const status = error.response?.status;

  if (status === 420 || status === 429) {
    console.log("⚠️ Rate limited by Trakt. Waiting 10 seconds...");
    await sendMessage("⚠️ Trakt rate limited. Waiting 10 seconds...");
    await delay(10000, true);
    // return addMovieToTrakt(title, year); // retry once
  }

  if (status === 401) {
    console.log("🔐 Trakt token expired!");
    await sendMessage("🔐 Trakt token expired!");
    return;
  }

  console.error("❌ Trakt Error:", error.response?.data || error.message);
}
}



export async function addMovieToTrakt(title, year) {
  try {
    const response = await axios.post(
      "https://api.trakt.tv/users/wreath1553/lists/movie-malayalam/items",
      {
        movies: [{ title, year }]
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

    console.log("Trakt Response:", response.data);

    console.log("Trakt Response:", response.data);

const { added, existing, not_found } = response.data;

if (added.movies > 0) {
  console.log(`➕ Added to Movie malayalam: ${title}`);
  await sendMessage(`➕ Added to Movie malayalam: ${title}`);

} else if (existing.movies > 0) {
  console.log(`⚠️ Already exists in list: ${title}`);
  await sendMessage(`⚠️ Already exists in list: ${title}`);

} else if (not_found.movies.length > 0) {
  console.log(`❌ Not found in Trakt database: ${title}`);
  await sendMessage(`❌ Not found in Trakt database: `);
  await sendMessage(`${title}`)
} else {
  console.log(`⚠️ Unknown state for: ${title}`);
  sendMessage(`⚠️ Unknown state for:`)
  await sendMessage(`${title}`)
}

  } catch (error) {
  const status = error.response?.status;

  if (status === 420 || status === 429) {
    console.log("⚠️ Rate limited by Trakt. Waiting 10 seconds...");
    await sendMessage("⚠️ Trakt rate limited. Waiting 10 seconds...");
    await delay(10000, true);
    // return addMovieToTrakt(title, year); // retry once
  }

  if (status === 401) {
    console.log("🔐 Trakt token expired!");
    await sendMessage("🔐 Trakt token expired!");
    return;
  }

  console.error("❌ Trakt Error:", error.response?.data || error.message);
}
}

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


