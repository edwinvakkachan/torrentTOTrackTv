  import {
  parseTitle,
  addMoviesBatchToTrakt,
  addShowsBatchToTrakt,
  ensureListUnderLimit,
  ensureShowListUnderLimit,
  ensurepredvdListUnderLimit,
  addMoviesBatchToTraktpredvd
} from "./tracklist.js";

import { getTorrentsByCurrentDateTag } from "./qbittorrent/qb.js";
import { isUnmatched } from "./db/checkUnmatched.js";
import { publishMessage } from "./queue/publishMessage.js";






async function handleError(error, context = "Unknown") {
  console.error(`🔥 [${context}]`, error);

await publishMessage({
  message: `🔥 [${context}]`
});
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

export async function tamilrockers (){

     // Fetch torrents
      const torrents = await safeExecute(
        () => getTorrentsByCurrentDateTag(),
        "Fetch Torrents"
      );
  
      if (!torrents) throw new Error("Failed to fetch torrents");
  
      logger.info(`Today's torrent count: ${torrents.length}`);
      const movies = [];
      const shows = [];
      const predvd=[];

for (const torrent of torrents) {
  const name = torrent.name.toLowerCase();



  // const isPreDVD = /\bpredvd\b/i.test(name);

  const isPreDVD = name.includes('predvd');

  const parsed = await safeExecute(
    () => parseTitle(name),
    `Parse ${name}`
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

  const item = { title: parsed.title, year: parsed.year };

  if (isPreDVD) {
    predvd.push(item);
    continue; // Don't mix with normal movies/shows
  }
  if (parsed.type === "movie") {
    movies.push(item);
  }

  if (parsed.type === "show") {
    shows.push(item);
  }
}


console.log(`👽👽👽👽👽todays details 👽👽👽👽`);

if(predvd){
  for (const x of predvd){
    console.log(`predvd: ${x.title} ${x.year}`)
  }
}

if(movies){
  for (const x of movies){
    console.log(`movies: ${x.title} ${x.year}`)
  }
}

if(shows){
  for (const x of shows){
    console.log(`shows: ${x.title} ${x.year}`)
  }
}

  

if (predvd.length > 0) {
  logger.info(`Processing PreDVD list: ${predvd.length}`);

    await ensurepredvdListUnderLimit(predvd.length)

    await addMoviesBatchToTraktpredvd(predvd)
}



  if (movies.length > 0) {
  await ensureListUnderLimit(movies.length);
  await addMoviesBatchToTrakt(movies);
  }
  
  if (shows.length > 0) {
   await ensureShowListUnderLimit(shows.length);
  await addShowsBatchToTrakt(shows);
  }
  }