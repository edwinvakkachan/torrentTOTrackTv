import { delay } from "./delay.js";
import { sendMessage } from "./telegram/sendTelegramMessage.js";

import { loginQB, getTorrentsByCurrentDateTag } from "./qbittorrent/qb.js";
import {
  parseTitle,
  addMoviesBatchToTrakt,
  addShowsBatchToTrakt,
  ensureListUnderLimit,
  ensureShowListUnderLimit
} from "./tracklist.js";

import { log } from "./timelog.js";
import { isUnmatched } from "./db/checkUnmatched.js";

/* ============================================================
   CENTRALIZED ERROR HANDLER
============================================================ */
async function handleError(error, context = "Unknown") {
  console.error(`🔥 [${context}]`, error);

  try {
    await sendMessage(`🔥 TrackTv Error (${context})`);
    await sendMessage(error?.message || "Unknown error");
  } catch (notifyErr) {
    console.error("Failed to send Telegram alert:", notifyErr.message);
  }
}

/* ============================================================
   SAFE EXECUTION WRAPPER
   Prevents crashes from individual async failures
============================================================ */
async function safeExecute(fn, context) {
  try {
    return await fn();
  } catch (error) {
    await handleError(error, context);
    return null;
  }
}

/* ============================================================
   MOVIE PROCESSING
============================================================ */
async function processMovies(movies) {
  if (!movies.length) return;

  await safeExecute(
    () => ensureListUnderLimit(movies.length),
    "Ensure Movie List Limit"
  );

  await safeExecute(
    () => addMoviesBatchToTrakt(movies),
    "Add Movies Batch"
  );
}

/* ============================================================
   SHOW PROCESSING
============================================================ */
async function processShows(shows) {
  if (!shows.length) return;

  await safeExecute(
    () => ensureShowListUnderLimit(shows.length),
    "Ensure Show List Limit"
  );

  await safeExecute(
    () => addShowsBatchToTrakt(shows),
    "Add Shows Batch"
  );
}

/* ============================================================
   MAIN WORKFLOW
============================================================ */
async function processTodayTag() {
  try {
    await sendMessage("🥦🥦🥦🥦🥦🥦🥦🥦🥦");
    console.log("🥦🥦🥦🥦🥦🥦🥦🥦🥦🥦🥦🥦");

    await sendMessage("🚀 TrackTv process started");
    console.log("🚀 TrackTv process started");

    await log();

    // QB Login
    const qbLogin = await safeExecute(() => loginQB(), "QB Login");
    if (!qbLogin) throw new Error("QB login failed");

    // Fetch torrents
    const torrents = await safeExecute(
      () => getTorrentsByCurrentDateTag(),
      "Fetch Torrents"
    );

    if (!torrents) throw new Error("Failed to fetch torrents");

    console.log(`Today's torrent count: ${torrents.length}`);

    const movies = [];
    const shows = [];

    for (const torrent of torrents) {
      const parsed = await safeExecute(
        () => parseTitle(torrent.name),
        `Parse ${torrent.name}`
      );

      if (!parsed) continue;

      const rejected = await safeExecute(
        () => isUnmatched(parsed.title, parsed.year, parsed.type),
        `Check unmatched ${parsed.title}`
      );

      if (rejected) {
        console.log("⏭ Skipping already rejected:", parsed.title);
        continue;
      }

      if (parsed.type === "movie") {
        movies.push({ title: parsed.title, year: parsed.year });
      }

      if (parsed.type === "show") {
        shows.push({ title: parsed.title, year: parsed.year });
      }
    }

    // Process batches
    await processMovies(movies);
    await processShows(shows);

    console.log("🎉 TrackTv process completed");
    await sendMessage("🎉 TrackTv process completed");
    await sendMessage("🥦🥦🥦🥦🥦🥦🥦🥦🥦");

    process.exit(0);

  } catch (error) {
    await handleError(error, "Main Process");
    process.exit(1);
  }
}

/* ============================================================
   GLOBAL CRASH PROTECTION (Important for Docker)
============================================================ */
process.on("unhandledRejection", async (reason) => {
  await handleError(reason, "Unhandled Rejection");
});

process.on("uncaughtException", async (err) => {
  await handleError(err, "Uncaught Exception");
  process.exit(1);
});

/* ============================================================
   START PROCESS
============================================================ */
processTodayTag();