
import { delay } from "./delay.js";
import { sendMessage } from "./telegram/sendTelegramMessage.js";

import { loginQB, getTorrentsByCurrentDateTag } from "./qbittorrent/qb.js";
import { addShowToTrakt,addMovieToTrakt,parseTitle } from "./tracklist.js";


async function processTodayTag() {
  await sendMessage("🥦🥦🥦🥦🥦🥦🥦🥦🥦");
  console.log('🥦🥦🥦🥦🥦🥦🥦🥦🥦🥦🥦🥦');

  await sendMessage('🚀 TrackTv process started ');
  console.log('🚀 TrackTv process started ')

  await loginQB();

  const torrents = await getTorrentsByCurrentDateTag();
  console.log(`current lenght ${torrents.length}`)


  for (const torrent of torrents) {

    const parsed = await parseTitle(torrent.name);
    console.log(parsed)
    if (!parsed) continue;

    if (parsed.type === "movie") {
      console.log(`🎬 Movie: ${parsed.title} (${parsed.year})`);
      await delay(3000,true);
     await addMovieToTrakt(parsed.title, parsed.year);
    }

    if (parsed.type === "show") {
      console.log(`📺 Show: ${parsed.title} (${parsed.year})`);
      await delay(3000,true)
      await addShowToTrakt(parsed.title, parsed.year);
    }
  }

  await sendMessage('TrackTv process completed Completed 🎉');
  await sendMessage("🥦🥦🥦🥦🥦🥦🥦🥦🥦");
  console.log('🥦🥦🥦🥦🥦🥦🥦🥦🥦🥦🥦🥦');
}

processTodayTag();