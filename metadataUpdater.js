import pool from "./db/pool.js";

/**
 * Update metadata for a tagged torrent item.
 *
 * @param {number} id
 * @param {Object} metadata
 */
export async function updateTaggedTorrentMetadata(id, metadata) {
  const {
    imdbId = null,
    tmdbId = null,
    tvdbId = null,
    originalTitle = null,
    genres = null,
    imdbRating = null,
    imdbVotes = null,
    runtime = null,
    releaseDate = null,
    originalLanguage=null,
    metadataStatus = "completed",
    title=null,
  } = metadata;


  await pool.query(
    `
    UPDATE tagged_torrent_items
    SET
        imdb_id = $1,
        tmdb_id = $2,
        tvdb_id = $3,
        original_title = $4,
        genres = $5,
        imdb_rating = $6,
        imdb_votes = $7,
        runtime = $8,
        release_date = $9,
        metadata_status = $10,
        title=$11,
        originalLanguage=$12,
        last_metadata_check = NOW(),
        updated_at = NOW()
    WHERE id = $13
    `,
    [
      imdbId,
      tmdbId,
      tvdbId,
      originalTitle,
      genres,
      imdbRating,
      imdbVotes,
      runtime,
      releaseDate,
      metadataStatus,
      title,
      originalLanguage,
      id
    ]
  );
}

export async function markMetadataNotFound(id) {
    await pool.query(
        `
        UPDATE tagged_torrent_items
        SET
            metadata_status = 'not_found',
            last_metadata_check = NOW(),
            updated_at = NOW()
        WHERE id = $1
        `,
        [id]
    );
}