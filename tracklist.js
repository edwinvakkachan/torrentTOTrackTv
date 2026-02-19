import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();


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

    console.log("Trakt Response:", response.data);

    if (response.data.added.shows > 0) {
      console.log(`✅ Added to ShowOther: ${title}`);
    } else {
      console.log(`⚠️ Already exists: ${title}`);
    }

  } catch (error) {
    console.error("❌ Trakt Show Error:", error.response?.data || error.message);
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

    if (response.data.added.movies > 0) {
      console.log(`✅ Added to Movie malayalam: ${title}`);
    } else {
      console.log(`⚠️ Already exists: ${title}`);
    }

  } catch (error) {
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


