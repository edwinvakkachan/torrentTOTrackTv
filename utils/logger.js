import winston from "winston";
import DailyRotateFile from "winston-daily-rotate-file";
import pkg from "pg";
import { sendMessage } from "../telegram/sendTelegramMessage.js";

const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const { combine, timestamp, printf, errors, json } = winston.format;

// Indian Time
const timeFormat = timestamp({
  format: () =>
    new Date().toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
    }),
});

const logFormat = printf(({ level, message, timestamp, stack }) => {
  return `${timestamp} [${level.toUpperCase()}] ${stack || message}`;
});

/*
  CUSTOM SUPABASE TRANSPORT
*/
class SupabaseTransport extends winston.Transport {
  async log(info, callback) {
    try {
      await pool.query(
        `INSERT INTO app_logs (level, message, meta)
         VALUES ($1, $2, $3)`,
        [
          info.level,
          info.message,
          JSON.stringify(info.meta || {}),
        ]
      );

      // 🚨 Send Telegram only for errors
      if (info.level === "error") {
        await sendMessage(
          `🚨 ERROR ALERT\n\n${info.message}\n\n${info.stack || ""}`
        );
      }
    } catch (err) {
      console.error("Supabase log insert failed:", err);
    }
    callback();
  }
}

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: combine(errors({ stack: true }), timeFormat),
  transports: [
    /*
      1️⃣ Daily rotated file logs
    */
    new DailyRotateFile({
      filename: "logs/app-%DATE%.log",
      datePattern: "YYYY-MM-DD",
      maxFiles: "14d",
      zippedArchive: true,
    }),

    /*
      2️⃣ Error only file
    */
    new DailyRotateFile({
      filename: "logs/error-%DATE%.log",
      level: "error",
      datePattern: "YYYY-MM-DD",
      maxFiles: "30d",
    }),

    /*
      3️⃣ Console
    */
    new winston.transports.Console({
      format: combine(logFormat),
    }),

    /*
      4️⃣ Supabase Cloud Storage
    */
    new SupabaseTransport(),
  ],
});

export default logger;