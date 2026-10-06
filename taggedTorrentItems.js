import pool from "./db/pool.js";

// ============================================================
// INSERT RADARR MOVIE INTO tagged_torrent_items
// ============================================================

export async function saveRadarrMovieToTaggedTorrentItems(movie) {

    if (!movie) {
        throw new Error("❌ Radarr movie object is missing");
    }

    // ============================================================
    // DUMMY VALUES
    // ============================================================

    const dummyTorrentHash = `RADARR_PREDVD_DUMMY_${movie.id}`;
    const dummyTorrentName = "Radarr dummy";
   const dummyDateTag = new Date().toISOString().split("T")[0];

    // ============================================================
    // RADARR VALUES
    // ============================================================

    const mediaType = "movie";

    const tmdbId =
        movie.tmdbId !== undefined &&
        movie.tmdbId !== null
            ? Number(movie.tmdbId)
            : 0;

    const originalTitle =
        movie.originalTitle ||
        movie.title ||
        "UNKNOWN_TITLE";

    // ============================================================
    // LOG
    // ============================================================

    console.log("");
    console.log("💾 Saving Radarr movie to tagged_torrent_items...");
    console.log(`   Torrent Hash   : ${dummyTorrentHash}`);
    console.log(`   Torrent Name   : ${dummyTorrentName}`);
    console.log(`   Title          : ${originalTitle}`);
    console.log(`   TMDb ID        : ${tmdbId}`);
    console.log(`   Media Type     : ${mediaType}`);
    console.log(`   Date Tag       : ${dummyDateTag}`);
    console.log(`   rrr_status     : pending`);
    console.log(`   metadata_status: completed`);

    // ============================================================
    // INSERT
    // ============================================================

    const result = await pool.query(
        `
        INSERT INTO public.tagged_torrent_items
        (
            torrent_hash,
            torrent_name,
            movie_or_show_name,
            media_type,
            date_tag,
            tmdb_id,
            original_title,
            rrr_status,
            metadata_status
        )
        VALUES
        (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7,
            $8,
            $9
        )
        RETURNING *
        `,
        [
            dummyTorrentHash,
            dummyTorrentName,
            originalTitle,
            mediaType,
            dummyDateTag,
            tmdbId,
            originalTitle,
            "pending",
            "completed"
        ]
    );

    console.log(
        `✅ Saved "${originalTitle}" to tagged_torrent_items`
    );

    return result.rows[0];
}