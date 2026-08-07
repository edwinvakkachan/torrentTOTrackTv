import pool from "../db/pool.js";
import { searchTMDB } from "../tmdb.js";
import { updateTaggedTorrentMetadata,markMetadataNotFound } from "../metadataUpdater.js";
import { publishMessage } from "../queue/publishMessage.js";
import { delay } from "../delay.js";

export async function getPendingMovieOrShowNames() {
  const { rows } = await pool.query(`
SELECT
    id,
    movie_or_show_name,
    year,
    media_type
FROM tagged_torrent_items
WHERE metadata_status = 'pending'
   OR metadata_status = 'not_found'

ORDER BY id
LIMIT 100;
`);

for (const row of rows) {
   console.log(`searching ${row.movie_or_show_name}`)
    const tmdb = await searchTMDB({
    title: row.movie_or_show_name,
    year: row.year,
    mediaType: row.media_type
});

if (!tmdb) {
    await markMetadataNotFound(row.id);
    await delay(1000,true);
 await publishMessage({
    message: `No TMDb results found ${row.movie_or_show_name}`
  });
    continue;
}


await updateTaggedTorrentMetadata(row.id, {
    tmdbId: tmdb.tmdbId,
    tvdbId: null,
    title:tmdb.title,
    originalTitle: tmdb.originalTitle,
    releaseDate:tmdb.releaseDate,
    originalLanguage:tmdb.originalLanguage,
    metadataStatus: "completed"
});
}

}