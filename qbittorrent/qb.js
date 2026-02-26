import axios from "axios";
import logger from "../utils/logger.js";
import { wrapper } from "axios-cookiejar-support";
import { CookieJar } from "tough-cookie";
import dotenv from "dotenv";
dotenv.config();

const jar = new CookieJar();

export const qb = wrapper(axios.create({
  baseURL: process.env.QBITIP,
  jar,
  withCredentials: true
}));

export async function loginQB() {
  await qb.post("/api/v2/auth/login", 
    new URLSearchParams({
      username: process.env.QBITUSER,
      password: process.env.QBITPASS
    })
  );
}


export async function getTorrentsByCurrentDateTag() {
  const today = new Date().toISOString().split("T")[0];

  const res = await qb.get("/api/v2/torrents/info", {
    params: { tag: today }
  });

  logger.info(`Scanning tag: ${today}`);
  return res.data;
}

