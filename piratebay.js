import { getpiratebayTorrentsByCurrentDateTag } from "./qbittorrent/qb.js";
import { ensureEnglishListUnderLimit, addEnglishMoviesBatchToTrakt,ensureEnglishShowListUnderLimit,addEnglishShowsBatchToTrakt,parseTitle } from "./traklistpiratebay.js";
import logger from "./utils/logger.js";
import { isUnmatched } from "./db/checkUnmatched.js";
import { publishMessage } from "./queue/publishMessage.js";
import { triggerHomeAssistantWebhookWhenErrorOccurs } from "./homeassistant/homeAssistantWebhook.js";
import { retry } from "./homeassistant/retryWrapper.js";

async function handleError(error, context = "Unknown") {
  console.error(`🔥 [${context}]`, error);

await publishMessage({
  message: `🔥 [${context}]`
});
}

async function safeExecute(fn, context) {
  try {
    return await fn();
  } catch (error) {
    await handleError(error, context);
    return null;
  }
}


export async function piratebay(){
    try {
    
console.log('piratebay process started');

    const torrents = await safeExecute(
          () => getpiratebayTorrentsByCurrentDateTag(),
          "Fetch Torrents"
        );

        
      if (!torrents) throw new Error("Failed to fetch torrents from piratebay");
   logger.info(`Today's torrent count: ${torrents.length}`);
      const movies = [];
      const shows = [];

for (const torrent of torrents) {
  const name = torrent.name.toLowerCase();


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


  if (parsed.type === "movie") {
    movies.push(item);
  }

  if (parsed.type === "show") {
    shows.push(item);
  }
}


console.log(`👽👽👽👽👽todays details 👽👽👽👽`);

console.log('movie length:' ,movies.length);
console.log('shows length:' ,shows.length)

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

  



  if (movies.length > 0) {
  await ensureEnglishListUnderLimit(movies.length);
  await addEnglishMoviesBatchToTrakt(movies);
  }
  
  if (shows.length > 0) {
   await ensureShowListUnderLimit(shows.length);
  await addEnglishShowsBatchToTrakt(shows);
  }




  logger.info('TrackTv piratebay  process completed Completed 🎉');
  
  await publishMessage({
    message: 'TrackTv prirate bay  process completed Completed 🎉'
  });
  
  
} catch (error) {
  console.error('error in processtodattag',error)
      await retry(
  triggerHomeAssistantWebhookWhenErrorOccurs,
  { status: "error" },
  "homeassistant-error",
  5
);
  process.exit(1)
}

}