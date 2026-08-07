import pool from "./db/pool.js";

export async function clearOldTaggedTorrentItems() {
  try {
    const result = await pool.query(`
      DELETE FROM tagged_torrent_items
      WHERE metadata_status IN ('completed', 'not_found')
        AND media_type <> 'predvd'
        AND created_at < NOW() - INTERVAL '90 days'
    `);

    console.log(
      `Deleted ${result.rowCount} completed tagged torrent items older than 90 days.`
    );
  } catch (err) {
    console.error("Failed to clear old tagged torrent items:", err);
  }
}