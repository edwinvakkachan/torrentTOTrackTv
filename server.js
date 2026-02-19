
import { delay } from "./delay.js";
import { sendMessage } from "./telegram/sendTelegramMessage.js";

import { loginQB, getTorrentsByCurrentDateTag } from "./qbittorrent/qb.js";
import { addShowToTrakt,addMovieToTrakt,parseTitle } from "./tracklist.js";


async function processTodayTag() {

  await loginQB();

  const torrents = await getTorrentsByCurrentDateTag();


  for (const torrent of torrents) {

    const parsed = await parseTitle(torrent.name);
    console.log(parsed)
    if (!parsed) continue;

    if (parsed.type === "movie") {
      console.log(`🎬 Movie: ${parsed.title} (${parsed.year})`);
      // addMovieToTrakt(parsed.title, parsed.year);
    }

    if (parsed.type === "show") {
      console.log(`📺 Show: ${parsed.title} (${parsed.year})`);
      // addShowToTrakt(parsed.title, parsed.year);
    }
  }
}

processTodayTag();