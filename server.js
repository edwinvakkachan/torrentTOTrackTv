import { loginQB} from "./qbittorrent/qb.js";
import { log } from "./timelog.js";
import { publishMessage } from "./queue/publishMessage.js";
import{initDB} from "./db/db.js"
import { triggerHomeAssistantWebhookWhenErrorOccurs } from "./homeassistant/homeAssistantWebhook.js";
import { retry } from "./homeassistant/retryWrapper.js";
import { saveCurrentTaggedTorrents } from "./torrentCollector/currentTaggedTorrents.js";
import { getPendingMovieOrShowNames } from "./getPendingMovieOrShowNames/getPendingMovieOrShowNames.js";
import { addMalayalamMoviesToRadarr } from "./addMalayalamMoviesToRadarr.js";
import { clearOldTaggedTorrentItems } from "./clearOldTaggedTorrentItems.js";
import { addTVSHowsToSonarr } from "./addTVSHowsToSonarr.js";
import { delay } from "./delay.js";
/* ============================================================
   MAIN WORKFLOW
============================================================ */
async function processTodayTag() {

try {
  console.log('🥦🥦🥦🥦🥦🥦🥦🥦🥦');
    await publishMessage({
    message: '🥦🥦🥦🥦🥦🥦🥦🥦🥦'
  });
  
  await publishMessage({
    message: '🚀 TrackTv process started'
  });
  
await initDB()
await log();
await loginQB();
await delay(2000,true);
await saveCurrentTaggedTorrents();
await delay(1000,true);
await getPendingMovieOrShowNames();
await delay(1000,true);
await addMalayalamMoviesToRadarr();
await delay(1000,true);
await addTVSHowsToSonarr();
await delay(1000,true);
await clearOldTaggedTorrentItems();
  
  await publishMessage({
    message: 'TrackTv process completed Completed 🎉'
  });
  

    await publishMessage({
    message: '🥦🥦🥦🥦🥦🥦🥦🥦🥦'
  });



console.log('🥦🥦🥦🥦🥦🥦🥦🥦🥦');
  
    process.exit(0)
} catch (error) {
  console.error('error in processtodattag',error);
  await delay(1000,true);
    await publishMessage({
    message:'error in torrent List TO traktv convertion'
  });
      await retry(
  triggerHomeAssistantWebhookWhenErrorOccurs,
  { status: "error" },
  "homeassistant-error",
  5
);
  process.exit(1)
}
}

processTodayTag();
