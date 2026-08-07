import axios from "axios";
import pool from "./db/pool.js";


export async function addMalayalamMoviesToRadarr() {

      console.log("========================================");
console.log("Starting Radarr sync...");
console.log("========================================");
  // Get Radarr tags
  const { data: existingTags } = await axios.get(
    `${process.env.RADARR_URL}/api/v3/tag`,
    {
      headers: {
        "X-Api-Key": process.env.RADARR_API_KEY,
      },
    }
  );

  const tagMap = {};
  for (const tag of existingTags) {
    tagMap[tag.label.toLowerCase()] = tag.id;
  }

  const malayalamTag = tagMap["malayalam"];
  const predvdTag = tagMap["predvd"];

  if (!malayalamTag) {
    throw new Error("Radarr tag 'malayalam' does not exist.");
  }

  const { rows } = await pool.query(`
    SELECT
      id,
      tmdb_id,
      media_type,
      movie_or_show_name,
      year
    FROM tagged_torrent_items
    WHERE metadata_status = 'completed'
  AND rrr_status = 'pending'
  AND tmdb_id IS NOT NULL
  AND media_type IN ('movie', 'predvd')
    ORDER BY id
  `);

  for (const movie of rows) {
    try {
      const tagIds = [malayalamTag];

      if (movie.media_type === "predvd" && predvdTag) {
        tagIds.push(predvdTag);
      }

      let rootFolderPath;

if (movie.media_type === "predvd") {
  rootFolderPath = process.env.RADARR_PREDVD_ROOT_FOLDER;
} else {
  rootFolderPath = process.env.RADARR_ROOT_FOLDER;
}

      await axios.post(
        `${process.env.RADARR_URL}/api/v3/movie`,
        {
          tmdbId: movie.tmdb_id,
          qualityProfileId: Number(process.env.RADARR_QUALITY_PROFILE_ID),
          rootFolderPath: rootFolderPath,
          monitored: false,
          searchForMovie: false,
          minimumAvailability: "released",
          tags: tagIds,
          addOptions: {
            searchForMovie: false,
          },
        },
        {
          headers: {
            "X-Api-Key": process.env.RADARR_API_KEY,
          },
        }
      );

      console.log(`✓ Added ${movie.movie_or_show_name}`);

      await pool.query(
        `
        UPDATE tagged_torrent_items
        SET rrr_status = 'added'
        WHERE id = $1
      `,
        [movie.id]
      );
    } catch (err) {
  const errorMessage =
    err.response?.data?.[0]?.errorMessage ?? err.message;

  if (errorMessage === "This movie has already been added") {
    console.log(`${movie.movie_or_show_name} already exists in Radarr.`);

    await pool.query(
      `
      UPDATE tagged_torrent_items
      SET rrr_status = 'already_exists'
      WHERE id = $1
      `,
      [movie.id]
    );
  } else {
    console.error(`Failed to add ${movie.movie_or_show_name}`, err.response?.data || err.message);

    await pool.query(
      `
      UPDATE tagged_torrent_items
      SET rrr_status = $1
      WHERE id = $2
      `,
      [errorMessage, movie.id]
    );
  }
}
  }
}