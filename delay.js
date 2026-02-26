import logger from "./utils/logger.js";

export async function delay(ms,noLog) {
  if(noLog){
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  else{
logger.info(`Waiting...${ms} sec`);
  return new Promise(resolve => setTimeout(resolve, ms));
  }
   
}