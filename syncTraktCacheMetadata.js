import axios from "axios";
import pool from "./db/pool.js";

export async function syncTraktCacheMetadata() {

  const result = await pool.query(`
    SELECT *
    FROM trakt_cache
    WHERE year IS NULL
    ORDER BY id
    LIMIT 100
  `);

  for (const item of result.rows) {

    try {

      const url =
        `https://api.trakt.tv/search/${item.trakt_type}` +
        `?query=${encodeURIComponent(item.search_title)}`;

      const { data } = await axios.get(url, {
        headers: {
          "Content-Type": "application/json",
          "trakt-api-version": "2",
          "trakt-api-key": process.env.TRAKT_CLIENT_ID
        }
      });

      if (!data.length) {
        continue;
      }

      let match = data[0];

if (item.year) {

  const yearMatch = data.find(x => {

    const media =
      item.trakt_type === "movie"
        ? x.movie
        : x.show;

    return media.year === item.year;
  });

  if (yearMatch) {
    match = yearMatch;
  }
}

      const media =
        item.trakt_type === "movie"
          ? match.movie
          : match.show;

      await pool.query(`
        UPDATE trakt_cache
        SET
          trakt_id = $1,
          imdb_id = $2,
          tmdb_id = $3,
          tvdb_id = $4,
          year = $5,
          original_title = $6,
          synced_at = NOW()
        WHERE id = $7
      `, [
        media.ids?.trakt ?? null,
        media.ids?.imdb ?? null,
        media.ids?.tmdb ?? null,
        media.ids?.tvdb ?? null,
        media.year ?? null,
        media.title ?? null,
        item.id
      ]);

      console.log(
        `✅ ${item.search_title} (${media.year})`
      );

    } catch (err) {

      console.error(
        `❌ ${item.search_title}`,
        err.message
      );

    }
  }
}