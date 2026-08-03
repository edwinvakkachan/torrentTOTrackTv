import pool from "../db/pool.js";
import { getErrorDetails, getPostgresConnectionHint } from "../utils/errorDetails.js";

export async function publishMessage({
  message,
  sourceApp = "unknown",
  eventType = "info",
  target = "telegram",
  scheduledAt = null,
  extra = {}
}) {
  if (!message) {
    throw new Error("Message is required");
  }

  const payload = {
    message,
    ...extra,
    time: new Date().toISOString()
  };

 try {
   await pool.query(
     `
     INSERT INTO app_message_queue
     (source_app, event_type, payload, target, scheduled_at)
     VALUES ($1,$2,$3,$4, COALESCE($5, CURRENT_TIMESTAMP))
     `,
     [sourceApp, eventType, payload, target, scheduledAt]
   );
  } catch (error) {
    console.error(
      "Queue publish failed",
      JSON.stringify(
        {
          ...getErrorDetails(error),
          ...getPostgresConnectionHint(error),
          sourceApp,
          eventType,
          target,
        },
        null,
        2
      )
    );
  }
}
