
import pool from "./db/pool.js";
import axios from "axios";
import { publishMessage } from "./queue/publishMessage.js";
publishMessage

export async function addTVSHowsToSonarr(){

    console.log("========================================");
console.log("Starting Sonarr sync...");
console.log("========================================");

    const { rows } = await pool.query(`
SELECT
    id,
    tmdb_id,
    title,
    movie_or_show_name
FROM tagged_torrent_items
WHERE metadata_status = 'completed'
  AND media_type = 'tvshows'
  AND tmdb_id IS NOT NULL
  AND COALESCE(rrr_status, 'pending') NOT IN ('already_exists', 'added')
ORDER BY id;
`);


const { data: existingTags } = await axios.get(
  `${process.env.SONARR_URL}/api/v3/tag`,
  {
    headers: {
      "X-Api-Key": process.env.SONARR_API_KEY,
    },
  }
);

const tagMap = {};

for (const tag of existingTags) {
  tagMap[tag.label.toLowerCase()] = tag.id;
}

const malayalamTag = tagMap["mal"];

if (!malayalamTag) {
  throw new Error("Sonarr tag 'malayalam' does not exist.");
}




for (const show of rows) {
    console.log(
    `\nProcessing: ${show.movie_or_show_name} (TMDb: ${show.tmdb_id})`
  );

  try {
//
const { data } = await axios.get(
  `${process.env.SONARR_URL}/api/v3/series/lookup?term=tmdb:${show.tmdb_id}`,
  {
    headers: {
      "X-Api-Key": process.env.SONARR_API_KEY,
    },
  }
);


const series = data.find(
  s => s.tmdbId === show.tmdb_id
);

if (!series) {
  console.log(`No lookup result for ${show.movie_or_show_name}`);
    await publishMessage({
      message: `No lookup result for ${show.movie_or_show_name}`
    });
    
  continue;
}

console.log({
  title: series.title,
  tmdbId: series.tmdbId,
  tvdbId: series.tvdbId
});

series.qualityProfileId =
  Number(process.env.SONARR_QUALITY_PROFILE_ID);

series.languageProfileId =
  Number(process.env.SONARR_LANGUAGE_PROFILE_ID);

series.rootFolderPath =
  process.env.SONARR_ROOT_FOLDER;

series.monitored = true;
series.seasonFolder = true;
series.tags = [malayalamTag];

series.addOptions = {
  searchForMissingEpisodes: false
};

console.log("Sending to Sonarr...");




await axios.post(
  `${process.env.SONARR_URL}/api/v3/series`,
  series,
  {
    headers: {
      "X-Api-Key": process.env.SONARR_API_KEY
    }
  }
);

  console.log(
  `✅ Added ${series.title} (TVDB ${series.tvdbId})`
);

    await pool.query(
      `
      UPDATE tagged_torrent_items
      SET rrr_status='added'
      WHERE id=$1
      `,
      [show.id]
    );

  } catch (err) {

    const errorMessage =
      err.response?.data?.[0]?.errorMessage ?? err.message;

    if (errorMessage === "This series has already been added") {

      console.log(`${show.movie_or_show_name} already exists.`);

      await pool.query(
        `
        UPDATE tagged_torrent_items
        SET rrr_status='already_exists'
        WHERE id=$1
        `,
        [show.id]
      );

    } else {

      console.error(
        `Failed to add ${show.movie_or_show_name}`,
        err.response?.data || err.message
      );

      await pool.query(
        `
        UPDATE tagged_torrent_items
        SET rrr_status=$1
        WHERE id=$2
        `,
        [errorMessage, show.id]
      );
    }
  }
}


}