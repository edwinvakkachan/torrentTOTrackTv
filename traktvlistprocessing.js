import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();
import logger from "./utils/logger.js";
import { saveUnmatched } from './db/saveUnmatched.js';
import { getValidAccessToken } from './authfortrakt/traktAuth.js';
import { publishMessage } from './queue/publishMessage.js';










export async function findMovieOnTrakt(title, year) {

  const token = await getValidAccessToken();

  const response = await axios.get(
    "https://api.trakt.tv/search/movie",
    {
      params: {
        query: title,
        years: year
      },
      headers: {
        "trakt-api-version": "2",
        "trakt-api-key": process.env.TRAKT_CLIENT_ID,
        Authorization: `Bearer ${token}`
      }
    }
  );

  if (!response.data.length) {
    return null;
  }

  return response.data[0].movie;
}

export async function addMovieByTraktId(traktId) {

  const token = await getValidAccessToken();

  const response = await axios.post(
    "https://api.trakt.tv/users/wreath1553/lists/movie-english/items",
    {
      movies: [{
        ids: {
          trakt: traktId
        }
      }]
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

  return response.data;
}

export async function addShowByTraktId(traktId) {

  const token = await getValidAccessToken();

  const response = await axios.post(
    "https://api.trakt.tv/users/wreath1553/lists/showsenglish/items",
    {
      shows: [{
        ids: {
          trakt: traktId
        }
      }]
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

  return response.data;
}
export async function findShowOnTrakt(title, year) {

  const token = await getValidAccessToken();

  const response = await axios.get(
    "https://api.trakt.tv/search/show",
    {
      params: {
        query: title,
        years: year
      },
      headers: {
        "trakt-api-version": "2",
        "trakt-api-key": process.env.TRAKT_CLIENT_ID,
        Authorization: `Bearer ${token}`
      }
    }
  );

  if (!response.data.length) {
    return null;
  }

  return response.data[0].show;
}