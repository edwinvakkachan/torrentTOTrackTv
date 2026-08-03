import axios from "axios";
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

  return getTorrentsByTag(today);
}

export async function getTorrentsByTag(tag) {
  const res = await qb.get("/api/v2/torrents/info", {
    params: { tag }
  });

  return res.data;
}

export async function getpiratebayTorrentsByCurrentDateTag() {
  const today = new Date().toISOString().split("T")[0];
  
  console.log("Searching tag:", `piratebay.${today}`);

  const res = await qb.get("/api/v2/torrents/info", {
    params: { tag: `piratebay.${today}` }
  });

  return res.data;
}
