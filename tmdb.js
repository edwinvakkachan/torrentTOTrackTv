import dotenv from "dotenv";
dotenv.config();

const TMDB_TOKEN = process.env.TMDB_READ_ACCESS_TOKEN;
const TMDB_BASE_URL = "https://api.themoviedb.org/3";

export async function searchTMDB({ title, year, mediaType }) {
  const endpoint =
    mediaType === "tvshows"
      ? "search/tv"
      : "search/movie";

  let url = `${TMDB_BASE_URL}/${endpoint}?query=${encodeURIComponent(title)}`;

  if (year) {
    if (mediaType === "tvshows") {
      url += `&first_air_date_year=${year}`;
    } else {
      url += `&year=${year}`;
    }
  }


  const options = {
    method: "GET",
    headers: {
      accept: "application/json",
      Authorization: `Bearer ${TMDB_TOKEN}`
    }
  };

  try {
    const response = await fetch(url, options);


    const data = await response.json();

    if (!response.ok) {
      console.error(data);
      return null;
    }

    if (!data.results || data.results.length === 0) {
      console.log("No TMDb results found.");
      return null;
    }

    const best = data.results[0];

    return {
      tmdbId: best.id,
      title: best.title || best.name,
      originalTitle: best.original_title || best.original_name,
      overview: best.overview,
      poster: best.poster_path
        ? `https://image.tmdb.org/t/p/original${best.poster_path}`
        : null,
      releaseDate: best.release_date || best.first_air_date,
      originalLanguage: best.original_language,
      popularity: best.popularity,
      voteAverage: best.vote_average,
      voteCount: best.vote_count,
      genreIds: best.genre_ids
    };

  } catch (err) {
    console.error("TMDb request failed:");
    console.error(err);
    return null;
  }
}