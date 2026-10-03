import "dotenv/config";
import axios from "axios";
import pool from "./db/pool.js";

// ============================================================
// ENVIRONMENT
// ============================================================

const RADARR_URL = process.env.RADARR_URL;
const RADARR_API_KEY = process.env.RADARR_API_KEY;

const PREDVD_TAG = "predvd";

// ============================================================
// VALIDATE ENV
// ============================================================

if (!RADARR_URL) {
    throw new Error("❌ RADARR_URL is missing from .env");
}

if (!RADARR_API_KEY) {
    throw new Error("❌ RADARR_API_KEY is missing from .env");
}

const radarrUrl = RADARR_URL.replace(/\/+$/, "");

const radarrHeaders = {
    "X-Api-Key": RADARR_API_KEY
};

// ============================================================
// NORMALIZE TITLE
// ============================================================

function normalizeTitle(title) {
    return String(title || "")
        .toLowerCase()

        // Remove video extensions
        .replace(/\.(mkv|mp4|avi|mov|m4v|ts)$/i, "")

        // Remove website prefixes
        .replace(/www\.[^\s]+/gi, "")

        // Replace separators
        .replace(/[._-]+/g, " ")

        // Remove brackets
        .replace(/[\[\](){}]/g, " ")

        // Collapse spaces
        .replace(/\s+/g, " ")

        .trim();
}

// ============================================================
// GET RADARR TAGS
// ============================================================

async function getRadarrTags() {

    const response = await axios.get(
        `${radarrUrl}/api/v3/tag`,
        {
            headers: radarrHeaders,
            timeout: 20000
        }
    );

    return response.data || [];
}

// ============================================================
// FIND PREDVD TAG ID
// ============================================================

async function getPreDVDTagId() {

    const tags = await getRadarrTags();

    const predvdTag = tags.find(
        tag =>
            String(tag.label || "")
                .trim()
                .toLowerCase() === PREDVD_TAG
    );

    if (!predvdTag) {
        throw new Error(
            `Radarr tag "${PREDVD_TAG}" was not found`
        );
    }

    console.log(
        `🏷️ Radarr PreDVD tag: ${predvdTag.label} (ID: ${predvdTag.id})`
    );

    return predvdTag.id;
}

// ============================================================
// GET RADARR MOVIES
// ============================================================

async function getRadarrMovies() {

    const response = await axios.get(
        `${radarrUrl}/api/v3/movie`,
        {
            headers: radarrHeaders,
            timeout: 30000
        }
    );

    return response.data || [];
}

// ============================================================
// GET QUEUED CLEANUP MOVIES
// ============================================================

async function getCleanupQueue() {

    const result = await pool.query(`
        SELECT
            id,
            title,
            year,
            processed,
            created_at
        FROM public.radarr_cleanup_queue
        WHERE processed = false
        ORDER BY created_at ASC
    `);

    return result.rows;
}

// ============================================================
// CHECK RADARR MOVIE HAS PREDVD TAG
// ============================================================

function isPreDVDMovie(movie, predvdTagId) {

    if (!Array.isArray(movie.tags)) {
        return false;
    }

    return movie.tags.some(
        tag => Number(tag) === Number(predvdTagId)
    );
}

// ============================================================
// FIND RADARR MOVIE
//
// IMPORTANT:
// Match BOTH title AND year.
//
// Only movies having the "predvd" tag are considered.
// ============================================================

function findMatchingRadarrMovie(
    queueItem,
    radarrMovies,
    predvdTagId
) {

    const queueTitle =
        normalizeTitle(queueItem.title);

    const queueYear =
        Number(queueItem.year);

    if (!queueTitle || !queueYear) {
        return null;
    }

    const predvdMovies = radarrMovies.filter(
        movie =>
            isPreDVDMovie(movie, predvdTagId)
    );

    console.log(
        `   Radarr PreDVD movies available: ${predvdMovies.length}`
    );

    // --------------------------------------------------------
    // First: exact title + exact year
    // --------------------------------------------------------

    const exactMatches = predvdMovies.filter(
        movie => {

            const radarrTitle =
                normalizeTitle(movie.title);

            const radarrYear =
                Number(movie.year);

            return (
                radarrTitle === queueTitle &&
                radarrYear === queueYear
            );
        }
    );

    if (exactMatches.length === 1) {
        return exactMatches[0];
    }

    // Multiple exact matches is unsafe
    if (exactMatches.length > 1) {

        console.log(
            `⚠️ Multiple exact Radarr matches found for ${queueItem.title} (${queueItem.year})`
        );

        for (const movie of exactMatches) {
            console.log(
                `   - ${movie.title} (${movie.year}) ID=${movie.id}`
            );
        }

        return null;
    }

    // --------------------------------------------------------
    // Second: contained title + exact year
    //
    // Example:
    //
    // Queue:       Toxic
    // Radarr:      Toxic: A Fairy Tale for Grown-Ups
    //
    // Only used if exact match failed.
    // --------------------------------------------------------

    const partialMatches = predvdMovies.filter(
        movie => {

            const radarrTitle =
                normalizeTitle(movie.title);

            const radarrYear =
                Number(movie.year);

            if (radarrYear !== queueYear) {
                return false;
            }

            return (
                radarrTitle.includes(queueTitle) ||
                queueTitle.includes(radarrTitle)
            );
        }
    );

    if (partialMatches.length === 1) {
        return partialMatches[0];
    }

    if (partialMatches.length > 1) {

        console.log(
            `⚠️ Multiple partial Radarr matches found for ${queueItem.title} (${queueItem.year})`
        );

        for (const movie of partialMatches) {
            console.log(
                `   - ${movie.title} (${movie.year}) ID=${movie.id}`
            );
        }

        return null;
    }

    return null;
}

// ============================================================
// DELETE RADARR MOVIE + FILES
// ============================================================

async function deleteRadarrMovie(movie) {

    console.log("");
    console.log("🗑️ Deleting PreDVD movie from Radarr...");
    console.log(`   Movie : ${movie.title}`);
    console.log(`   Year  : ${movie.year}`);
    console.log(`   ID    : ${movie.id}`);
    console.log(`   Path  : ${movie.path}`);

    await axios.delete(
        `${radarrUrl}/api/v3/movie/${movie.id}`,
        {
            params: {
                deleteFiles: true,
                addImportExclusion: false
            },

            headers: radarrHeaders,

            timeout: 30000
        }
    );

    console.log(
        `✅ Deleted "${movie.title}" from Radarr`
    );

    console.log(
        `✅ Radarr movie files deleted`
    );
}

// ============================================================
// MARK QUEUE ITEM PROCESSED
// ============================================================

async function markQueueProcessed(queueId) {

    await pool.query(
        `
        UPDATE public.radarr_cleanup_queue
        SET
            processed = true
        WHERE id = $1
        `,
        [queueId]
    );
}

// ============================================================
// MAIN CLEANUP FUNCTION
// ============================================================

export async function cleanupPreDVDFromRadarr() {

    console.log("");
    console.log("=================================================");
    console.log("🧹 RADARR PRE-DVD CLEANUP");
    console.log("=================================================");

    let processedCount = 0;
    let deletedCount = 0;
    let notFoundCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    try {

        // ====================================================
        // 1. GET QUEUE
        // ====================================================

        console.log("");
        console.log("📥 Reading radarr_cleanup_queue...");

        const queue =
            await getCleanupQueue();

        console.log(
            `   Pending queue items: ${queue.length}`
        );

        if (!queue.length) {

            console.log(
                "ℹ️ No pending Radarr cleanup items"
            );

            return;
        }

        // ====================================================
        // 2. GET RADARR PREDVD TAG
        // ====================================================

        console.log("");
        console.log("🏷️ Reading Radarr tags...");

        const predvdTagId =
            await getPreDVDTagId();

        // ====================================================
        // 3. GET RADARR MOVIES
        // ====================================================

        console.log("");
        console.log("🎬 Reading movies from Radarr...");

        const radarrMovies =
            await getRadarrMovies();

        console.log(
            `   Total Radarr movies: ${radarrMovies.length}`
        );

        const predvdMovies =
            radarrMovies.filter(
                movie =>
                    isPreDVDMovie(
                        movie,
                        predvdTagId
                    )
            );

        console.log(
            `   Movies with "${PREDVD_TAG}" tag: ${predvdMovies.length}`
        );

        // ====================================================
        // 4. PROCESS QUEUE
        // ====================================================

        for (const queueItem of queue) {

            console.log("");
            console.log("-----------------------------------------------");

            console.log(
                `🎯 Queue item: ${queueItem.title} (${queueItem.year})`
            );

            console.log(
                `   Queue ID: ${queueItem.id}`
            );

            // ------------------------------------------------
            // Find matching Radarr movie
            // ------------------------------------------------

            const movie =
                findMatchingRadarrMovie(
                    queueItem,
                    radarrMovies,
                    predvdTagId
                );

            if (!movie) {

                console.log(
                    `⚠️ No matching PreDVD movie found in Radarr`
                );

                /*
                 * IMPORTANT:
                 *
                 * Do NOT mark the queue item processed.
                 *
                 * It may appear in Radarr later.
                 */

                notFoundCount++;

                continue;
            }

            console.log("");
            console.log("🎯 RADARR MATCH FOUND");

            console.log(
                `   Queue : ${queueItem.title} (${queueItem.year})`
            );

            console.log(
                `   Radarr: ${movie.title} (${movie.year})`
            );

            console.log(
                `   ID    : ${movie.id}`
            );

            console.log(
                `   Path  : ${movie.path}`
            );

            // ------------------------------------------------
            // Verify PreDVD tag AGAIN before deletion
            // ------------------------------------------------

            if (!isPreDVDMovie(movie, predvdTagId)) {

                console.log(
                    `🛑 Safety check failed: movie does not have "${PREDVD_TAG}" tag`
                );

                skippedCount++;

                continue;
            }

            // ------------------------------------------------
            // DELETE MOVIE
            // ------------------------------------------------

            try {

                await deleteRadarrMovie(movie);

                deletedCount++;

                // --------------------------------------------
                // Mark queue item processed ONLY after
                // successful Radarr deletion
                // --------------------------------------------

                await markQueueProcessed(
                    queueItem.id
                );

                processedCount++;

                console.log(
                    `✅ Queue item marked processed`
                );

            } catch (error) {

                failedCount++;

                console.error(
                    `❌ Failed to delete ${movie.title}`
                );

                console.error(
                    error.response?.data ||
                    error.message
                );

                /*
                 * Do NOT mark processed.
                 *
                 * It will be retried on the next run.
                 */
            }
        }

        // ====================================================
        // SUMMARY
        // ====================================================

        console.log("");
        console.log("=================================================");
        console.log("✅ RADARR PRE-DVD CLEANUP FINISHED");
        console.log("=================================================");

        console.log(
            `📋 Queue items       : ${queue.length}`
        );

        console.log(
            `🗑️ Movies deleted    : ${deletedCount}`
        );

        console.log(
            `✅ Marked processed  : ${processedCount}`
        );

        console.log(
            `🔎 Not found         : ${notFoundCount}`
        );

        console.log(
            `⏭️ Skipped           : ${skippedCount}`
        );

        console.log(
            `❌ Failed            : ${failedCount}`
        );

        console.log("=================================================");
        console.log("");

    } catch (error) {

        console.error("");
        console.error(
            "❌ Radarr PreDVD cleanup failed"
        );

        console.error(
            error.response?.data ||
            error.message
        );

        console.error("");
    }
}

// ============================================================
// OPTIONAL DIRECT EXECUTION
// ============================================================
//
// If this file is executed directly:
//     node cleanpredvd.js
//
// it will run the cleanup automatically.
//
// Remove this section if another script imports and calls
// cleanupPreDVDFromRadarr().
// ============================================================

if (import.meta.url === `file://${process.argv[1]}`) {

    try {

        await cleanupPreDVDFromRadarr();

    } finally {

        await pool.end();
    }
}