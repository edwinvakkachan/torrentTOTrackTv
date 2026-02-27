import { delay } from "./delay.js";
import { sendMessage } from "./telegram/sendTelegramMessage.js";
import logger from "./utils/logger.js";
import { loginQB, getTorrentsByCurrentDateTag } from "./qbittorrent/qb.js";
import {
  parseTitle,
  addMoviesBatchToTrakt,
  addShowsBatchToTrakt,
  ensureListUnderLimit,
  ensureShowListUnderLimit
} from "./tracklist.js";
import { cleanupOldLogs } from "./utils/logCleanup.js";
import { log } from "./timelog.js";
import { isUnmatched } from "./db/checkUnmatched.js";
import { callTrakt } from "./authfortrakt/trakt.js";
import { publishMessage } from "./queue/publishMessage.js";

/* ============================================================
   CENTRALIZED ERROR HANDLER
============================================================ */
async function handleError(error, context = "Unknown") {
  console.error(`🔥 [${context}]`, error);

  try {
    await sendMessage(`🔥 TrackTv Error (${context})`);
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
  
await publishMessage({
  sourceApp: "torrentToTrakt",
  eventType: "success",
  payload: {
    message: "TrackTv process completed 🎉",
    time: new Date().toISOString()
  }
});

logger.info('🚀 TrackTv process started');

await log();
await cleanupOldLogs();
    await loginQB();
    await callTrakt();

    // Fetch torrents
    const torrents = await safeExecute(
      () => getTorrentsByCurrentDateTag(),
      "Fetch Torrents"
    );

    if (!torrents) throw new Error("Failed to fetch torrents");

    logger.info(`Today's torrent count: ${torrents.length}`);
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
        logger.info(`⏭ Skipping already rejected: ${parsed.title}`);
        continue;
      }

      if (parsed.type === "movie") {
        movies.push({ title: parsed.title, year: parsed.year });
      }

      if (parsed.type === "show") {
        shows.push({ title: parsed.title, year: parsed.year });
      }
    }

if (movies.length > 0) {
await ensureListUnderLimit(movies.length);
await addMoviesBatchToTrakt(movies);
}

if (shows.length > 0) {
 await ensureShowListUnderLimit(shows.length);
await addShowsBatchToTrakt(shows);
}
logger.info('TrackTv process completed Completed 🎉');
await sendMessage('traktv completed');

  process.exit(0)
}

processTodayTag();