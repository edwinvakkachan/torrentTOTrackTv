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

  // IMPORTANT:
  // Do NOT send year to TMDb.
  // Torrent years are often incorrect.
  const url =
    `${TMDB_BASE_URL}/${endpoint}?query=${encodeURIComponent(title)}`;

  const options = {
    method: "GET",
    headers: {
      accept: "application/json",
      Authorization: `Bearer ${TMDB_TOKEN}`
    }
  };

  const MAX_RETRIES = 3;

  // -----------------------------------------
  // Normalize title
  // -----------------------------------------
  function normalizeTitle(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  // -----------------------------------------
  // Extract sequel / part number
  //
  // Examples:
  // Sardar 2       -> 2
  // Sardar Part 2  -> 2
  // Sardar II      -> null for now
  // -----------------------------------------
  function extractSequelNumber(value) {
    const normalized = normalizeTitle(value);

    const match = normalized.match(
      /(?:part|season|series)?\s*(\d+)\s*$/i
    );

    return match ? Number(match[1]) : null;
  }

  // -----------------------------------------
  // Get release year from TMDb result
  // -----------------------------------------
  function getResultYear(result) {
    const date =
      mediaType === "tvshows"
        ? result.first_air_date
        : result.release_date;

    if (!date) return null;

    const match = String(date).match(/^(\d{4})/);

    return match ? Number(match[1]) : null;
  }

  // -----------------------------------------
  // Calculate title similarity
  // -----------------------------------------
  function titleSimilarity(searchTitle, resultTitle) {
    const a = normalizeTitle(searchTitle);
    const b = normalizeTitle(resultTitle);

    if (!a || !b) return 0;

    // Exact match
    if (a === b) {
      return 100;
    }

    // One completely contains the other
    if (b.includes(a)) {
      return 80;
    }

    if (a.includes(b)) {
      return 70;
    }

    // Compare individual words
    const aWords = a.split(" ");
    const bWords = b.split(" ");

    const commonWords = aWords.filter(word =>
      bWords.includes(word)
    );

    if (commonWords.length === 0) {
      return 0;
    }

    const wordScore =
      (commonWords.length / Math.max(aWords.length, bWords.length)) *
      60;

    return Math.round(wordScore);
  }

  // -----------------------------------------
  // Select best TMDb result
  // -----------------------------------------
  function selectBestTMDBResult(results) {
    const requestedTitle = normalizeTitle(title);
    const requestedYear = Number(year) || null;
    const requestedSequel = extractSequelNumber(title);

    const candidates = results.map(result => {
      const resultTitle =
        result.title ||
        result.name ||
        "";

      const normalizedResultTitle =
        normalizeTitle(resultTitle);

      const resultYear =
        getResultYear(result);

      const resultSequel =
        extractSequelNumber(resultTitle);

      let score = 0;

      // -------------------------------------
      // 1. TITLE SIMILARITY
      // -------------------------------------
      const similarity =
        titleSimilarity(title, resultTitle);

      score += similarity;

      // -------------------------------------
      // 2. SEQUEL / PART NUMBER
      // -------------------------------------
      if (
        requestedSequel !== null &&
        resultSequel !== null
      ) {
        if (requestedSequel === resultSequel) {
          score += 100;
        } else {
          // Strong penalty if both clearly specify
          // different sequel numbers.
          score -= 80;
        }
      }

      // -------------------------------------
      // 3. YEAR
      //
      // IMPORTANT:
      // Year is ONLY a bonus.
      // It NEVER eliminates a result.
      // -------------------------------------
      if (
        requestedYear &&
        resultYear
      ) {
        if (requestedYear === resultYear) {
          score += 20;
        }
      }

      // -------------------------------------
      // 4. Popularity
      //
      // Only a small tie-breaker.
      // -------------------------------------
      if (result.popularity) {
        score += Math.min(
          Number(result.popularity) / 10,
          5
        );
      }

      return {
        result,
        score,
        similarity,
        resultYear,
        resultSequel,
        normalizedResultTitle
      };
    });

    // Highest score first
    candidates.sort((a, b) => b.score - a.score);

    // -------------------------------------
    // Detailed debugging output
    // -------------------------------------
    console.log("");
    console.log("🎯 TMDb candidate ranking");
    console.log(`Search title : "${title}"`);
    console.log(`Torrent year : ${year || "unknown"}`);
    console.log("----------------------------------------");

    candidates.slice(0, 10).forEach((candidate, index) => {
      const result = candidate.result;

      console.log(
        `${index + 1}. ` +
        `Score=${candidate.score.toFixed(1)} | ` +
        `${result.title || result.name} | ` +
        `Year=${candidate.resultYear || "unknown"} | ` +
        `TMDb=${result.id}`
      );
    });

    console.log("----------------------------------------");

    return candidates[0]?.result || null;
  }

  // -----------------------------------------
  // TMDb request / retry
  // -----------------------------------------
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await delay(1000, true);

      console.log(
        `🔎 TMDb searching: "${title}"`
      );

      console.log(
        `🌐 URL: ${url}`
      );

      const response =
        await fetch(url, options);

      console.log(
        `📡 TMDb response: ${response.status} ${response.statusText}`
      );

      const data =
        await response.json();

      console.log(
        `📊 TMDb results for "${title}": ${
          data.results?.length ?? 0
        }`
      );

      if (!response.ok) {
        console.error(
          `TMDb HTTP error ${response.status} for "${title}":`,
          data
        );

        // Retry server/rate-limit errors
        if (
          response.status === 429 ||
          response.status >= 500
        ) {
          if (attempt < MAX_RETRIES) {
            const waitTime = attempt * 3000;

            console.log(
              `Retrying "${title}" in ${
                waitTime / 1000
              } seconds...`
            );

            await delay(waitTime, true);
            continue;
          }
        }

        return null;
      }

      if (
        !data.results ||
        data.results.length === 0
      ) {
        console.log(
          `No TMDb results found for "${title}".`
        );

        return null;
      }

      // -------------------------------------
      // IMPORTANT:
      // Do NOT use data.results[0]
      // -------------------------------------
      const best =
        selectBestTMDBResult(
          data.results
        );

      if (!best) {
        return null;
      }

      console.log(
        `✅ Selected TMDb result: ${
          best.title || best.name
        } (${getResultYear(best) || "unknown"})`
      );

      console.log(
        `🆔 TMDb ID: ${best.id}`
      );

      return {
        tmdbId: best.id,

        title:
          best.title ||
          best.name,

        originalTitle:
          best.original_title ||
          best.original_name,

        overview:
          best.overview,

        poster:
          best.poster_path
            ? `https://image.tmdb.org/t/p/original${best.poster_path}`
            : null,

        releaseDate:
          best.release_date ||
          best.first_air_date ||
          null,

        originalLanguage:
          best.original_language,

        popularity:
          best.popularity,

        voteAverage:
          best.vote_average,

        voteCount:
          best.vote_count,

        genreIds:
          best.genre_ids
      };

    } catch (err) {
      console.error(
        `TMDb request failed for "${title}" ` +
        `(attempt ${attempt}/${MAX_RETRIES})`
      );

      console.error(err);

      if (attempt < MAX_RETRIES) {
        const waitTime = attempt * 3000;

        console.log(
          `Retrying "${title}" in ${
            waitTime / 1000
          } seconds...`
        );

        await delay(waitTime, true);
      } else {
        console.error(
          `TMDb failed permanently for "${title}" ` +
          `after ${MAX_RETRIES} attempts.`
        );

        return null;
      }
    }
  }

  return null;
}