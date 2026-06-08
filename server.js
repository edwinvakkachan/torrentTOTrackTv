
import logger from "./utils/logger.js";
import { loginQB} from "./qbittorrent/qb.js";

import { cleanupOldLogs } from "./utils/logCleanup.js";
import { log } from "./timelog.js";

import { callTrakt } from "./authfortrakt/trakt.js";
import { publishMessage } from "./queue/publishMessage.js";
import { processUpgrades } from "./predvdCleanup.js";
import{initDB} from "./db/db.js"
import { triggerHomeAssistantWebhookWhenErrorOccurs } from "./homeassistant/homeAssistantWebhook.js";
import { retry } from "./homeassistant/retryWrapper.js";
import { piratebay } from "./piratebay.js";
import { traktv } from "./traktv.js";
import { tamilrockers } from "./tamilrockers.js";
/* ============================================================
   CENTRALIZED ERROR HANDLER
============================================================ */




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
  
  logger.info('🚀 TrackTv process started');
  await initDB()
  await log();
  await cleanupOldLogs();
  // await loginQB();
  await callTrakt();
  // await tamilrockers();
  // await processUpgrades();
  // await piratebay();
  await traktv();

  logger.info('TrackTv process completed Completed 🎉');
  
  await publishMessage({
    message: 'TrackTv process completed Completed 🎉'
  });
  

    await publishMessage({
    message: '🥦🥦🥦🥦🥦🥦🥦🥦🥦'
  });



console.log('🥦🥦🥦🥦🥦🥦🥦🥦🥦');
  
    process.exit(0)
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

processTodayTag();