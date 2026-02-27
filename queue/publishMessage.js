import pool from "../db/pool.js";

export async function publishMessage({
  sourceApp,
  eventType,
  payload,
  target = "telegram",
  scheduledAt = null
}) {
  await pool.query(
    `
    INSERT INTO app_message_queue
    (source_app, event_type, payload, target, scheduled_at)
    VALUES ($1,$2,$3,$4, COALESCE($5, CURRENT_TIMESTAMP))
    `,
    [sourceApp, eventType, payload, target, scheduledAt]
  );
}