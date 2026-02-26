import { sendMessage } from "./telegram/sendTelegramMessage.js";
import logger from "./utils/logger.js";


export async function log(message='⌚') {
  const time = new Date().toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour12: false
  });

await sendMessage(`[${time}] ${message}`)
  logger.info(`[${time}] ${message}`);
}
