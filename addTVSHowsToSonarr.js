import pool from "./db/pool.js";
import axios from "axios";
import { publishMessage } from "./queue/publishMessage.js";

export async function addTVSHowsToSonarr() {

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

    // ---------------------------------------------------------
    // Get Sonarr tags
    // ---------------------------------------------------------

    const { data: existingTags } = await axios.get(
        `${process.env.SONARR_URL}/api/v3/tag`,
        {
            headers: {
                "X-Api-Key": process.env.SONARR_API_KEY
            }
        }
    );

    const tagMap = {};

    for (const tag of existingTags) {
        tagMap[tag.label.toLowerCase()] = tag.id;
    }

    const malayalamTag = tagMap["mal"];

    if (!malayalamTag) {
        throw new Error("Sonarr tag 'mal' does not exist.");
    }

    // ---------------------------------------------------------
    // Process shows
    // ---------------------------------------------------------

    for (const show of rows) {

        console.log("");
        console.log("========================================");
        console.log(
            `Processing: ${show.movie_or_show_name} (TMDb: ${show.tmdb_id})`
        );
        console.log("========================================");

        try {

            let series = null;

            // =================================================
            // STEP 1
            // Try exact TMDB ID lookup
            // =================================================

            console.log(
                `Trying Sonarr TMDB lookup: tmdb:${show.tmdb_id}`
            );

            try {

                const { data } = await axios.get(
                    `${process.env.SONARR_URL}/api/v3/series/lookup?term=tmdb:${show.tmdb_id}`,
                    {
                        headers: {
                            "X-Api-Key": process.env.SONARR_API_KEY
                        }
                    }
                );

                console.log(
                    `TMDB lookup returned ${Array.isArray(data) ? data.length : 0} result(s)`
                );

                if (Array.isArray(data)) {

                    series = data.find(
                        s =>
                            Number(s.tmdbId) === Number(show.tmdb_id)
                    );

                    if (series) {

                        console.log(
                            `✅ Exact TMDB match found: ${series.title}`
                        );

                    } else {

                        console.log(
                            `⚠️ No exact TMDB match found for ${show.tmdb_id}`
                        );

                        if (data.length > 0) {

                            console.log(
                                "Sonarr returned:"
                            );

                            for (const item of data) {
                                console.log({
                                    title: item.title,
                                    tmdbId: item.tmdbId,
                                    tvdbId: item.tvdbId,
                                    year: item.year
                                });
                            }
                        }
                    }
                }

            } catch (lookupError) {

                console.log(
                    `⚠️ TMDB lookup failed: ${
                        lookupError.response?.data ||
                        lookupError.message
                    }`
                );
            }


            // =================================================
            // STEP 2
            // Fallback to title lookup
            //
            // IMPORTANT:
            // No year is used here.
            // =================================================

            if (!series) {

                const searchTitle =
                    show.title ||
                    show.movie_or_show_name;

                console.log(
                    `Trying title fallback lookup: "${searchTitle}"`
                );

                const { data: titleResults } = await axios.get(
                    `${process.env.SONARR_URL}/api/v3/series/lookup`,
                    {
                        params: {
                            term: searchTitle
                        },
                        headers: {
                            "X-Api-Key": process.env.SONARR_API_KEY
                        }
                    }
                );

                console.log(
                    `Title lookup returned ${
                        Array.isArray(titleResults)
                            ? titleResults.length
                            : 0
                    } result(s)`
                );


                if (Array.isArray(titleResults) && titleResults.length > 0) {

                    const normalizedSearchTitle =
                        normalizeTitle(searchTitle);


                    // -----------------------------------------
                    // First: exact normalized title
                    // -----------------------------------------

                    series = titleResults.find(item =>
                        normalizeTitle(item.title) ===
                        normalizedSearchTitle
                    );


                    if (series) {

                        console.log(
                            `✅ Exact title match found: ${series.title}`
                        );

                    } else {

                        // -------------------------------------
                        // Second: original title match
                        // -------------------------------------

                        series = titleResults.find(item => {

                            if (!item.originalTitle) {
                                return false;
                            }

                            return normalizeTitle(item.originalTitle) ===
                                normalizedSearchTitle;
                        });


                        if (series) {

                            console.log(
                                `✅ Original title match found: ${series.title}`
                            );
                        }
                    }


                    // -----------------------------------------
                    // Third: contains match
                    //
                    // Only use if there is a single sensible
                    // candidate.
                    // -----------------------------------------

                    if (!series) {

                        const containsMatches =
                            titleResults.filter(item => {

                                const resultTitle =
                                    normalizeTitle(item.title);

                                return (
                                    resultTitle.includes(
                                        normalizedSearchTitle
                                    ) ||
                                    normalizedSearchTitle.includes(
                                        resultTitle
                                    )
                                );
                            });


                        if (containsMatches.length === 1) {

                            series = containsMatches[0];

                            console.log(
                                `✅ Single title candidate found: ${series.title}`
                            );

                        } else if (containsMatches.length > 1) {

                            console.log(
                                `⚠️ Multiple title candidates found for "${searchTitle}"`
                            );

                            for (const item of containsMatches) {

                                console.log({
                                    title: item.title,
                                    tmdbId: item.tmdbId,
                                    tvdbId: item.tvdbId,
                                    year: item.year
                                });
                            }

                        }
                    }
                }
            }


            // =================================================
            // STEP 3
            // No match
            // =================================================

            if (!series) {

                console.log(
                    `❌ No Sonarr lookup match for ${show.movie_or_show_name}`
                );

                await publishMessage({
                    message:
                        `No Sonarr lookup match for ${show.movie_or_show_name}`
                });

                continue;
            }


            // =================================================
            // STEP 4
            // Show selected series information
            // =================================================

            console.log("");
            console.log("Selected Sonarr series:");

            console.log({
                title: series.title,
                year: series.year,
                tmdbId: series.tmdbId,
                tvdbId: series.tvdbId
            });


            // =================================================
            // STEP 5
            // Configure series
            // =================================================

            series.qualityProfileId =
                Number(process.env.SONARR_QUALITY_PROFILE_ID);

            series.languageProfileId =
                Number(process.env.SONARR_LANGUAGE_PROFILE_ID);

            series.rootFolderPath =
                process.env.SONARR_ROOT_FOLDER;

            series.monitored = true;

            series.seasonFolder = true;

            series.tags = [
                malayalamTag
            ];

            series.addOptions = {
                searchForMissingEpisodes: false
            };


            // =================================================
            // STEP 6
            // Add to Sonarr
            // =================================================

            console.log("");
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


            // =================================================
            // STEP 7
            // Success
            // =================================================

            console.log(
                `✅ Added ${series.title} (TVDB ${series.tvdbId})`
            );

            await pool.query(
                `
                UPDATE tagged_torrent_items
                SET rrr_status = 'added'
                WHERE id = $1
                `,
                [show.id]
            );


        } catch (err) {

            const errorMessage =
                err.response?.data?.[0]?.errorMessage ??
                err.response?.data?.message ??
                err.message;


            // =================================================
            // Already exists
            // =================================================

            if (
                errorMessage ===
                "This series has already been added"
            ) {

                console.log(
                    `ℹ️ ${show.movie_or_show_name} already exists.`
                );

                await pool.query(
                    `
                    UPDATE tagged_torrent_items
                    SET rrr_status = 'already_exists'
                    WHERE id = $1
                    `,
                    [show.id]
                );


            } else {

                // =================================================
                // Other error
                // =================================================

                console.error(
                    `❌ Failed to add ${show.movie_or_show_name}`
                );

                console.error(
                    err.response?.data ||
                    err.message
                );


                await pool.query(
                    `
                    UPDATE tagged_torrent_items
                    SET rrr_status = $1
                    WHERE id = $2
                    `,
                    [
                        errorMessage,
                        show.id
                    ]
                );
            }
        }
    }
}


// =============================================================
// Normalize title
//
// Purpose:
// "Vadhandhi: The Mystery of Mani"
// "Vadhandhi The Mystery of Mani"
// "vadhandhi - the mystery of mani"
// will all become comparable.
//
// Year is deliberately NOT included.
// =============================================================

function normalizeTitle(title) {

    if (!title) {
        return "";
    }

    return title
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[:\-–—'".,!?()[\]{}]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}