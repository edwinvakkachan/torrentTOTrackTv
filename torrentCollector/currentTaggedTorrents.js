import pool from "../db/pool.js";
import { getTorrentsByTag } from "../qbittorrent/qb.js";

const REQUIRED_TAGS = ["script"];

const LANGUAGE_PATTERNS = [
  ["Malayalam", /\b(malayalam|mal)\b/i],
  ["Tamil", /\b(tamil|tam)\b/i],
  ["Telugu", /\b(telugu|tel)\b/i],
  ["Hindi", /\b(hindi|hin)\b/i],
  ["Kannada", /\b(kannada|kan)\b/i],
  ["English", /\b(english|eng)\b/i],
  ["Korean", /\b(korean|kor)\b/i],
  ["Japanese", /\b(japanese|jpn)\b/i],
  ["Multi", /\b(multi|multi audio|dual audio|dual-audio|dual)\b/i],
];

const RELEASE_KEYWORDS = [
  "malayalam",
  "mal",
  "tamil",
  "tam",
  "telugu",
  "tel",
  "hindi",
  "hin",
  "kannada",
  "kan",
  "english",
  "eng",
  "multi",
  "dual",
  "audio",
  "hq",
  "clean",
  "true",
  "predvd",
  "pre",
  "dvd",
  "hdrip",
  "bdrip",
  "dvdrip",
  "dvdscr",
  "webrip",
  "webdl",
  "web-dl",
  "web",
  "bluray",
  "avc",
  "x264",
  "x265",
  "h264",
  "h265",
  "hevc",
  "aac",
  "ac3",
  "ddp",
  "dd",
  "esub",
  "mkv",
  "mp4",
  "avi",
];

function getCurrentDateTag() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .formatToParts(new Date())
    .reduce((dateParts, part) => {
      dateParts[part.type] = part.value;
      return dateParts;
    }, {});

  return `${parts.year}-${parts.month}-${parts.day}`;
}

function parseTags(tags) {
  if (Array.isArray(tags)) {
    return tags.map(String).map((tag) => tag.trim()).filter(Boolean);
  }

  return String(tags || "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function hasTag(tags, expectedTag) {
  return tags.some((tag) => tag.toLowerCase() === expectedTag.toLowerCase());
}

function detectMediaType(name, tags) {
  const text = `${name} ${tags.join(" ")}`;

  if (/\bpre[\s._-]*dvd\b/i.test(name)) {
    return "predvd";
  }

  if (/\b(s\d{1,2}\s*e\d{1,2}|s\d{1,2}\s*ep|season|episode|ep\s*\(?\d{1,3})\b/i.test(text)) {
    return "tvshows";
  }

  if (/\b(show|series|tv)\b/i.test(text)) {
    return "tvshows";
  }

  return "movie";
}

function detectYear(name) {
  const match = String(name).match(/\b(19\d{2}|20\d{2})\b/);
  return match ? Number(match[1]) : null;
}

function detectAudioLanguages(name) {
  const text = normalizeText(name);
  const languages = LANGUAGE_PATTERNS
    .filter(([, pattern]) => pattern.test(text))
    .map(([language]) => language);

  return [...new Set(languages)];
}

function normalizeText(value) {
  return String(value || "")
    .replace(/\u00a0/g, " ")
    .replace(/Â/g, " ")
    .normalize("NFKC");
}

function removeWebsitePrefix(name) {
  return name
    .replace(/^www\.[^-]+-\s*/i, "")
    .replace(/^[^-]+\.com\s*-\s*/i, "")
    .trim();
}

function removeAfterYear(name) {
  const match = name.match(/^(.*?)\s*[\[(]?(19\d{2}|20\d{2})[\])]?\b/i);
  return match ? match[1].trim() : name;
}

function removeAfterTvMarker(name) {
  return name
    .replace(/\bS\d{1,2}\s*E\d{1,2}\b.*$/i, "")
    .replace(/\bS\d{1,2}\s*EP\b.*$/i, "")
    .replace(/\bSeason\s*\d+\b.*$/i, "")
    .replace(/\bEpisode\s*\d+\b.*$/i, "")
    .trim();
}

function removeReleaseWords(name) {
  const keywordPattern = new RegExp(`\\b(${RELEASE_KEYWORDS.join("|")})\\b`, "gi");

  return name
    .replace(keywordPattern, " ")
    .replace(/\b\d+(\.\d+)?\s*(gb|mb|kb)\b/gi, " ")
    .replace(/\b(2160p|1080p|720p|576p|480p)\b/gi, " ")
    .replace(/\b\d+(\.\d+)?\b/g, " ");
}

function cleanTitle(name) {
  const originalName = normalizeText(name);
  let title = removeWebsitePrefix(originalName);

  title = removeAfterYear(title);
  title = removeAfterTvMarker(title);

  title = title
    .replace(/\.[a-z0-9]{2,4}$/i, " ")
    .replace(/\[[^\]]*]/g, " ")
    .replace(/\([^)]*\)/g, " ")
    .replace(/[._+|-]+/g, " ");

  title = removeReleaseWords(title)
    .replace(/\s+/g, " ")
    .trim();

  return title || removeWebsitePrefix(originalName);
}

export function parseTorrentMetadata(torrent) {
  const tags = parseTags(torrent.tags);
  const name = torrent.name || "";

  return {
    torrentHash: torrent.hash,
    torrentName: name,
    movieOrShowName: cleanTitle(name),
    year: detectYear(name),
    mediaType: detectMediaType(name, tags),
    audioLanguages: detectAudioLanguages(name),
    tags,
    size: torrent.size || null,
  };
}

export async function saveCurrentTaggedTorrents({
  dateTag = getCurrentDateTag(),
  requiredTags = REQUIRED_TAGS,
} = {}) {
  const torrents = await getTorrentsByTag(dateTag);
  const selectedTorrents = torrents.filter((torrent) => {
    const tags = parseTags(torrent.tags);
    return requiredTags.every((tag) => hasTag(tags, tag));
  });

  for (const torrent of selectedTorrents) {
    const metadata = parseTorrentMetadata(torrent);


    await pool.query(
      `
      INSERT INTO tagged_torrent_items (
        torrent_hash,
        torrent_name,
        movie_or_show_name,
        year,
        audio_languages,
        tags,
        media_type,
        date_tag,
        size_bytes,
        updated_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())
      ON CONFLICT (torrent_hash, date_tag)
      DO UPDATE SET
        torrent_name = EXCLUDED.torrent_name,
        movie_or_show_name = EXCLUDED.movie_or_show_name,
        year = EXCLUDED.year,
        audio_languages = EXCLUDED.audio_languages,
        tags = EXCLUDED.tags,
        media_type = EXCLUDED.media_type,
        size_bytes = EXCLUDED.size_bytes,
        updated_at = NOW()
      `,
      [
        metadata.torrentHash,
        metadata.torrentName,
        metadata.movieOrShowName,
        metadata.year,
        metadata.audioLanguages,
        metadata.tags,
        metadata.mediaType,
        dateTag,
        metadata.size,
      ]
    );
  }

  console.log(
    `Saved ${selectedTorrents.length} torrents with tags: ${[dateTag, ...requiredTags].join(", ")}`
  );

  return selectedTorrents.map(parseTorrentMetadata);
}
