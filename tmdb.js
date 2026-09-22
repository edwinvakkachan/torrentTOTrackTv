import dotenv from "dotenv";
import { delay } from "./delay.js";
dotenv.config();

const TMDB_TOKEN = process.env.TMDB_READ_ACCESS_TOKEN;
const TMDB_BASE_URL = "https://api.themoviedb.org/3";

export async function searchTMDB({ title, year, mediaType }) {
  const endpoint =
    mediaType === "tvshows"
      ? "search/tv"
      : "search/movie";

 let url = `${TMDB_BASE_URL}/${endpoint}?query=${encodeURIComponent(title)}`;



  const options = {
    method: "GET",
    headers: {
      accept: "application/json",
      Authorization: `Bearer ${TMDB_TOKEN}`
    }
  };

  const MAX_RETRIES = 3;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await delay(1000, true);

console.log(`🔎 TMDb searching: "${title}"`);
console.log(`🌐 URL: ${url}`);

const response = await fetch(url, options);

console.log(`📡 TMDb response: ${response.status} ${response.statusText}`);

const data = await response.json();

console.log(
  `📊 TMDb results for "${title}": ${data.results?.length ?? 0}`
);

      if (!response.ok) {
        console.error(
          `TMDb HTTP error ${response.status} for "${title}":`,
          data
        );

        return null;
      }

      if (!data.results || data.results.length === 0) {
        console.log(`No TMDb results found for "${title}".`);
        return null;
      }

      const best = data.results[0];

      return {
        tmdbId: best.id,
        title: best.title || best.name,
        originalTitle: best.original_title || best.original_name,
        overview: best.overview,
        poster: best.poster_path
          ? `https://image.tmdb.org/t/p/original${best.poster_path}`
          : null,
        releaseDate: best.release_date || best.first_air_date,
        originalLanguage: best.original_language,
        popularity: best.popularity,
        voteAverage: best.vote_average,
        voteCount: best.vote_count,
        genreIds: best.genre_ids
      };

    } catch (err) {

      console.error(
        `TMDb request failed for "${title}" ` +
        `(attempt ${attempt}/${MAX_RETRIES})`
      );

      console.error(err);

      // Retry only if attempts remain
      if (attempt < MAX_RETRIES) {
        const waitTime = attempt * 3000;

        console.log(
          `Retrying "${title}" in ${waitTime / 1000} seconds...`
        );

        await delay(waitTime, true);
      } else {
        console.error(
          `TMDb failed permanently for "${title}" after ${MAX_RETRIES} attempts.`
        );

        return null;
      }
    }
  }

  return null;
}