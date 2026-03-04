import pool from "./db/pool.js";
import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();
import logger from "./utils/logger.js";
import { getValidAccessToken } from './authfortrakt/traktAuth.js';
import { publishMessage } from './queue/publishMessage.js';



async function getListItems(listName) {

  const token = await getValidAccessToken();

  const res = await axios.get(
    `https://api.trakt.tv/users/wreath1553/lists/${listName}/items`,
    {
      headers: {
        "Content-Type": "application/json",
        "trakt-api-version": "2",
        "trakt-api-key": process.env.TRAKT_CLIENT_ID,
        Authorization: `Bearer ${token}`
      }
    }
  );

  return res.data;
}

async function findPredvdUpgrades( ) {

  const predvdList = await getListItems("predvd");
  const normalList = await getListItems("movie-malayalam");

  const upgrades = [];

  for (const p of predvdList) {

    const match = normalList.find(
      n =>
        n.movie.title.toLowerCase() === p.movie.title.toLowerCase() &&
        n.movie.year === p.movie.year
    );

    if (match) {
      upgrades.push({
        title: p.movie.title,
        year: p.movie.year,
        trakt_id: p.movie.ids.trakt
      });
    }
  }

  return upgrades;
}

 async function enqueueRadarrCleanup(movies) {

  for (const m of movies) {

    await pool.query(
      `
      INSERT INTO radarr_cleanup_queue (title, year, trakt_id)
      VALUES ($1,$2,$3)
      ON CONFLICT DO NOTHING
      `,
      [m.title, m.year, m.trakt_id]
    );
  }
}

async function removeFromPreDVD(ids) {

  const token = await getValidAccessToken();

  await axios.post(
    "https://api.trakt.tv/users/wreath1553/lists/predvd/items/remove",
    {
      movies: ids.map(id => ({
        ids: { trakt: id }
      }))
    },
    {
      headers: {
        "Content-Type": "application/json",
        "trakt-api-version": "2",
        "trakt-api-key": process.env.TRAKT_CLIENT_ID,
        Authorization: `Bearer ${token}`
      }
    }
  );
}


export async function processUpgrades() {

 const upgrades = await findPredvdUpgrades();
 
 if (!upgrades.length){
    logger.info('Nothing to upgrade');
    return;
 } 

  console.log("Upgraded movies:", upgrades);

if (upgrades.length) {

  await removeFromPreDVD(upgrades.map(m => m.trakt_id));

  await enqueueRadarrCleanup(upgrades);

  logger.info(`Queued ${upgrades.length} movies for Radarr cleanup`);
}
}
