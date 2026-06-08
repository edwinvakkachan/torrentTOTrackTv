
import { ensureEnglishListUnderLimit, addEnglishMoviesBatchToTrakt,ensureEnglishShowListUnderLimit,addEnglishShowsBatchToTrakt } from "./traklistpiratebay.js";
import logger from "./utils/logger.js";
import { publishMessage } from "./queue/publishMessage.js";
import { triggerHomeAssistantWebhookWhenErrorOccurs } from "./homeassistant/homeAssistantWebhook.js";
import { retry } from "./homeassistant/retryWrapper.js";
import pool from "./db/pool.js";
import {
findMovieOnTrakt,
addMovieByTraktId,addShowByTraktId,
findShowOnTrakt
 } from "./traktvlistprocessing.js";
import { delay } from "./delay.js";

async function handleError(error, context = "Unknown") {
  console.error(`🔥 [${context}]`, error);

await publishMessage({
  message: `🔥 [${context}]`
});
}

function cleanTitle(title) {
  return title
    .replace(/\b(19|20)\d{2}\b/g, "")
    .replace(/\b(2160p|1080p|720p|576p|480p)\b/gi, "")
    .replace(/\b(BDRip|DVDRip|DVDSCR|WEBRip|WEB-DL|WEB|BluRay)\b/gi, "")
    .replace(/\b(x264|x265|h264|h265|HEVC|AAC|AC3)\b/gi, "")
    .replace(/\b(EVO|CM8|Hive-CM8|ELEVATE|AFG|NTG)\b/gi, "")
    .replace(/[-_=]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}


export async function traktv(){
    try {
    
console.log('traktv process started');

const movieResult = await pool.query(`
  SELECT *
  FROM trakt_cache
  WHERE trakt_status = 'pending'
    AND list_name = 'Movie English'
      ORDER BY id
  LIMIT 40
`);

const showResult = await pool.query(`
  SELECT *
  FROM trakt_cache
  WHERE trakt_status = 'pending'
    AND list_name = 'showsEnglish'
      ORDER BY id
  LIMIT 40
`);

const movies = movieResult.rows.map(row => ({
  title: row.search_title,
  year: row.year
}));

const shows = showResult.rows.map(row => ({
  title: row.search_title,
  year: row.year
}));

console.log('movie length:', movies.length);
console.log('shows length:', shows.length);
  

if (movies.length > 0) {

  await ensureEnglishListUnderLimit(movies.length);

  for (const cache of movieResult.rows) {

    const movie = await findMovieOnTrakt(
      cleanTitle(cache.search_title),
      cache.year
    );

    if (!movie) {

      console.log(
        `[NOT FOUND] ${cache.search_title}`
      );

      await pool.query(`
        UPDATE trakt_cache
        SET trakt_status = 'not_found'
        WHERE id = $1
      `, [cache.id]);

      continue;
    }

    const result = await addMovieByTraktId(
      movie.ids.trakt
    );

    let status = "unknown";

    if (result.added?.movies > 0) {
      status = "added";
    }

    if (result.existing?.movies > 0) {
      status = "existing";
    }

    await pool.query(`
      UPDATE trakt_cache
      SET
        trakt_id = $1,
        imdb_id = $2,
        tmdb_id = $3,
        trakt_status = $4,
        synced_at = NOW()
      WHERE id = $5
    `, [
      movie.ids.trakt,
      movie.ids.imdb,
      movie.ids.tmdb,
      status,
      cache.id
    ]);

    console.log(
      `[${status.toUpperCase()}] ${movie.title}`
    );

    await delay(500, true);
  }
}

if (shows.length > 0) {

  await ensureEnglishShowListUnderLimit(shows.length);

  for (const cache of showResult.rows) {

    const show = await findShowOnTrakt(
      cleanTitle(cache.search_title),
      cache.year
    );

    if (!show) {

      console.log(
        `[SHOW NOT FOUND] ${cache.search_title}`
      );

      await pool.query(`
        UPDATE trakt_cache
        SET trakt_status = 'not_found'
        WHERE id = $1
      `, [cache.id]);

      continue;
    }

    const result = await addShowByTraktId(
      show.ids.trakt
    );

    let status = "unknown";

    if (result.added?.shows > 0) {
      status = "added";
    }

    if (result.existing?.shows > 0) {
      status = "existing";
    }

    await pool.query(`
      UPDATE trakt_cache
      SET
        trakt_id = $1,
        tvdb_id = $2,
        tmdb_id = $3,
        trakt_status = $4,
        synced_at = NOW()
      WHERE id = $5
    `, [
      show.ids.trakt,
      show.ids.tvdb,
      show.ids.tmdb,
      status,
      cache.id
    ]);

    console.log(
      `[${status.toUpperCase()}] ${show.title}`
    );

    await delay(500, true);
  }
}

  logger.info('TrackTv piratebay  process completed Completed 🎉');
  
  await publishMessage({
    message: 'TrackTv prirate bay  process completed Completed 🎉'
  });
  
  
} catch (error) {
  console.error('error in processtodattag',error)
      await retry(
  triggerHomeAssistantWebhookWhenErrorOccurs,
  { status: "error" },
  "homeassistant-error",
  5
);
  process.exit(1)
}

}