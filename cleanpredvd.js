import "dotenv/config";
import axios from "axios";

// ============================================================
// ENVIRONMENT
// ============================================================

const RADARR_URL = process.env.RADARR_URL;
const RADARR_API_KEY = process.env.RADARR_API_KEY;

const QBIT_URL = process.env.QBITIP;

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

if (!QBIT_URL) {
    throw new Error("❌ QBIT_URL is missing from .env");
}

// Remove trailing slash
const radarrUrl = RADARR_URL.replace(/\/+$/, "");
const qbitUrl = QBIT_URL.replace(/\/+$/, "");

// ============================================================
// NORMALIZE TITLE
// ============================================================

function normalizeTitle(title) {
    return String(title || "")
        .toLowerCase()

        // Remove video extensions
        .replace(/\.(mkv|mp4|avi|mov|m4v|ts)$/i, "")

        // Remove website names
        .replace(/www\.[^\s]+/gi, "")

        // Replace separators
        .replace(/[._-]+/g, " ")

        // Remove brackets
        .replace(/[\[\](){}]/g, " ")

        // Remove release information
        .replace(
            /\b(2160p|1080p|720p|576p|480p|4k|web-dl|webdl|webrip|bluray|brrip|hdrip|hdtv|predvd|pre-dvd|x264|x265|hevc|avc|h264|h265|aac|ac3|ddp|dd|dts|tamil|malayalam|telugu|hindi|english|clean|hq)\b/gi,
            " "
        )

        // Remove year
        .replace(/\b(19|20)\d{2}\b/g, " ")

        // Collapse spaces
        .replace(/\s+/g, " ")

        .trim();
}

// ============================================================
// GET QBITTORRENT TORRENTS
// ============================================================

async function getQbitTorrents() {
    const response = await axios.get(
        `${qbitUrl}/api/v2/torrents/info`,
        {
            timeout: 20000
        }
    );

    return response.data || [];
}

// ============================================================
// GET RADARR TAGS
// ============================================================

async function getRadarrTags() {
    const response = await axios.get(
        `${radarrUrl}/api/v3/tag`,
        {
            headers: {
                "X-Api-Key": RADARR_API_KEY
            },
            timeout: 20000
        }
    );

    return response.data || [];
}

// ============================================================
// GET RADARR MOVIES
// ============================================================

async function getRadarrMovies() {
    const response = await axios.get(
        `${radarrUrl}/api/v3/movie`,
        {
            headers: {
                "X-Api-Key": RADARR_API_KEY
            },
            timeout: 30000
        }
    );

    return response.data || [];
}

// ============================================================
// CHECK QBIT TORRENT IS PREDVD
// ============================================================

function isPreDVDTorrent(torrent) {
    const category = String(
        torrent.category || ""
    )
        .trim()
        .toLowerCase();

    const tags = String(
        torrent.tags || ""
    )
        .split(",")
        .map(tag => tag.trim().toLowerCase())
        .filter(Boolean);

    return (
        category === PREDVD_TAG ||
        tags.includes(PREDVD_TAG)
    );
}

// ============================================================
// CHECK RADARR MOVIE HAS PREDVD TAG
// ============================================================

function isPreDVDMovie(movie, predvdTagId) {
    return (
        Array.isArray(movie.tags) &&
        movie.tags.includes(predvdTagId)
    );
}

// ============================================================
// FIND MATCHING RADARR PREDVD MOVIE
// ============================================================

function findMatchingPreDVDMovie(
    torrent,
    predvdMovies
) {
    const torrentTitle = normalizeTitle(torrent.name);

    if (!torrentTitle) {
        return null;
    }

    for (const movie of predvdMovies) {

        const radarrTitle = normalizeTitle(
            movie.title
        );

        if (!radarrTitle) {
            continue;
        }

        // Exact match
        if (torrentTitle === radarrTitle) {
            return movie;
        }

        // qBit contains Radarr title
        if (torrentTitle.includes(radarrTitle)) {
            return movie;
        }

        // Radarr contains qBit title
        if (radarrTitle.includes(torrentTitle)) {
            return movie;
        }
    }

    return null;
}

// ============================================================
// FIND PREDVD QBIT TORRENTS FOR MOVIE
// ============================================================

function findPreDVDTorrents(
    torrents,
    movie
) {
    const movieTitle = normalizeTitle(
        movie.title
    );

    return torrents.filter(torrent => {

        // Must be PreDVD
        if (!isPreDVDTorrent(torrent)) {
            return false;
        }

        const torrentTitle = normalizeTitle(
            torrent.name
        );

        if (!torrentTitle) {
            return false;
        }

        return (
            torrentTitle === movieTitle ||
            torrentTitle.includes(movieTitle) ||
            movieTitle.includes(torrentTitle)
        );
    });
}

// ============================================================
// DELETE MOVIE FROM RADARR + FILES
// ============================================================

async function deleteRadarrMovie(movie) {

    console.log("");
    console.log("🗑️ Deleting PreDVD movie from Radarr...");
    console.log(`   Movie : ${movie.title}`);
    console.log(`   ID    : ${movie.id}`);
    console.log(`   Path  : ${movie.path}`);

    await axios.delete(
        `${radarrUrl}/api/v3/movie/${movie.id}`,
        {
            params: {
                deleteFiles: true,
                addImportExclusion: false
            },
            headers: {
                "X-Api-Key": RADARR_API_KEY
            },
            timeout: 30000
        }
    );

    console.log(
        "✅ Radarr movie deleted"
    );

    console.log(
        "✅ Radarr movie files deleted"
    );
}

// ============================================================
// DELETE QBITTORRENT + FILES
// ============================================================

async function deleteQbitTorrent(torrent) {

    console.log("");
    console.log("🗑️ Deleting PreDVD torrent...");
    console.log(`   Name : ${torrent.name}`);
    console.log(`   Hash : ${torrent.hash}`);

    const body = new URLSearchParams();

    body.append(
        "hashes",
        torrent.hash
    );

    body.append(
        "deleteFiles",
        "true"
    );

    await axios.post(
        `${qbitUrl}/api/v2/torrents/delete`,
        body,
        {
            headers: {
                "Content-Type":
                    "application/x-www-form-urlencoded"
            },
            timeout: 30000
        }
    );

    console.log(
        "✅ qBittorrent torrent deleted"
    );

    console.log(
        "✅ qBittorrent files deleted"
    );
}

// ============================================================
// MAIN CLEANUP FUNCTION
// ============================================================

export async function cleanupPreDVDFromQbit() {

    console.log("");
    console.log("=================================================");
    console.log("🧹 PreDVD CLEANUP");
    console.log("=================================================");

    try {

        // --------------------------------------------------------
        // GET QBIT TORRENTS
        // --------------------------------------------------------

        console.log("");
        console.log("📥 Reading torrents from qBittorrent...");

        const torrents = await getQbitTorrents();

        console.log(
            `   Found ${torrents.length} torrents`
        );

        // --------------------------------------------------------
        // GET RADARR TAGS
        // --------------------------------------------------------

        console.log("");
        console.log("🏷️ Reading Radarr tags...");

        const tags = await getRadarrTags();

        const predvdTag = tags.find(
            tag =>
                String(tag.label || "")
                    .trim()
                    .toLowerCase() === PREDVD_TAG
        );

        if (!predvdTag) {

            console.log(
                `❌ Radarr tag "${PREDVD_TAG}" was not found`
            );

            return;
        }

        console.log(
            `   PreDVD tag ID: ${predvdTag.id}`
        );

        // --------------------------------------------------------
        // GET RADARR MOVIES
        // --------------------------------------------------------

        console.log("");
        console.log("🎬 Reading Radarr movies...");

        const movies = await getRadarrMovies();

        console.log(
            `   Found ${movies.length} movies`
        );

        // --------------------------------------------------------
        // ONLY PREDVD RADARR MOVIES
        // --------------------------------------------------------

        const predvdMovies = movies.filter(
            movie =>
                isPreDVDMovie(
                    movie,
                    predvdTag.id
                )
        );

        console.log(
            `   PreDVD movies: ${predvdMovies.length}`
        );

        if (!predvdMovies.length) {

            console.log(
                "ℹ️ No PreDVD movies found in Radarr"
            );

            return;
        }

        // --------------------------------------------------------
        // PROCESS QBIT TORRENTS
        // --------------------------------------------------------

        console.log("");
        console.log("🔎 Checking qBittorrent torrents...");

        let matchedCount = 0;

        for (const torrent of torrents) {

            // ----------------------------------------------------
            // IMPORTANT:
            // Ignore PreDVD torrent itself.
            //
            // We are looking for a NEW torrent that replaces
            // an existing PreDVD movie.
            // ----------------------------------------------------

            if (isPreDVDTorrent(torrent)) {

                console.log(
                    `⏭️ Skipping PreDVD torrent: ${torrent.name}`
                );

                continue;
            }

            const normalizedTorrentTitle =
                normalizeTitle(torrent.name);

            if (!normalizedTorrentTitle) {
                continue;
            }

            console.log("");
            console.log(
                `🔍 Checking: ${torrent.name}`
            );

            const matchedMovie =
                findMatchingPreDVDMovie(
                    torrent,
                    predvdMovies
                );

            if (!matchedMovie) {

                console.log(
                    "   ↳ No PreDVD match"
                );

                continue;
            }

            matchedCount++;

            console.log("");
            console.log("🎯 MATCH FOUND");
            console.log(
                `   New torrent : ${torrent.name}`
            );
            console.log(
                `   PreDVD movie: ${matchedMovie.title}`
            );
            console.log(
                `   Radarr ID   : ${matchedMovie.id}`
            );

            // ----------------------------------------------------
            // FIND PREDVD TORRENTS
            // ----------------------------------------------------

            const predvdTorrents =
                findPreDVDTorrents(
                    torrents,
                    matchedMovie
                );

            console.log(
                `   PreDVD qBit torrents: ${predvdTorrents.length}`
            );

            // ----------------------------------------------------
            // DELETE RADARR MOVIE FIRST
            // ----------------------------------------------------

            try {

                await deleteRadarrMovie(
                    matchedMovie
                );

            } catch (error) {

                console.error(
                    "❌ Radarr deletion failed"
                );

                console.error(
                    error.response?.data ||
                    error.message
                );

                // Do NOT delete qBit files
                // if Radarr deletion failed.
                continue;
            }

            // ----------------------------------------------------
            // DELETE PREDVD QBIT TORRENTS
            // ----------------------------------------------------

            for (
                const predvdTorrent
                of predvdTorrents
            ) {

                try {

                    await deleteQbitTorrent(
                        predvdTorrent
                    );

                } catch (error) {

                    console.error(
                        `❌ qBittorrent deletion failed: ${predvdTorrent.name}`
                    );

                    console.error(
                        error.response?.data ||
                        error.message
                    );
                }
            }
        }

        // --------------------------------------------------------
        // SUMMARY
        // --------------------------------------------------------

        console.log("");
        console.log("=================================================");
        console.log("✅ PreDVD CLEANUP FINISHED");
        console.log("=================================================");
        console.log(
            `🎯 Matches found: ${matchedCount}`
        );
        console.log("=================================================");
        console.log("");

    } catch (error) {

        console.error("");
        console.error(
            "❌ PreDVD cleanup failed"
        );

        console.error(
            error.response?.data ||
            error.message
        );

        console.error("");
    }
}