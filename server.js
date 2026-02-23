
import { delay } from "./delay.js";
import { sendMessage } from "./telegram/sendTelegramMessage.js";

import { loginQB, getTorrentsByCurrentDateTag } from "./qbittorrent/qb.js";
import { parseTitle,addMoviesBatchToTrakt,addShowsBatchToTrakt,ensureListUnderLimit,ensureShowListUnderLimit } from "./tracklist.js";
import { log } from "./timelog.js";
import { isUnmatched } from "./db/checkUnmatched.js";


async function processTodayTag() {
  await sendMessage("🥦🥦🥦🥦🥦🥦🥦🥦🥦");
  console.log('🥦🥦🥦🥦🥦🥦🥦🥦🥦🥦🥦🥦');

  await sendMessage('🚀 TrackTv process started ');
  console.log('🚀 TrackTv process started ')
  await log();

  await loginQB();

  const torrents = await getTorrentsByCurrentDateTag();
  console.log(`todays torrent count  ${torrents.length}`)


 const movies = [];
const shows = [];

for (const torrent of torrents) {
  
  const parsed = await parseTitle(torrent.name);
  if (!parsed) continue;

  if (await isUnmatched(parsed.title, parsed.year, parsed.type)) {
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

if (movies.length > 0) {
await ensureListUnderLimit(movies.length);
await addMoviesBatchToTrakt(movies);
}

if (shows.length > 0) {
 await ensureShowListUnderLimit(shows.length);
await addShowsBatchToTrakt(shows);
}
console.log('TrackTv process completed Completed 🎉')
  await sendMessage('TrackTv process completed Completed 🎉');
  await sendMessage("🥦🥦🥦🥦🥦🥦🥦🥦🥦");
  console.log('🥦🥦🥦🥦🥦🥦🥦🥦🥦🥦🥦🥦');
}

processTodayTag();