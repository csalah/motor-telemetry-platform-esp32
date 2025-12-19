import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import pkg from "pg";

dotenv.config();
const { Pool } = pkg;

const API_PORT = process.env.API_PORT ? Number(process.env.API_PORT) : 4000;

const pool = new Pool({
  host: process.env.PG_HOST,
  port: process.env.PG_PORT ? Number(process.env.PG_PORT) : 5432,
  user: process.env.PG_USER,
  password: process.env.PG_PASSWORD,
  database: process.env.PG_DATABASE,
  ssl: process.env.PG_SSL === "true" ? { rejectUnauthorized: false } : false,
});

async function queryDb(text, params = []) {
  const client = await pool.connect();
  try {
    const res = await client.query(text, params);
    return res;
  } finally {
    client.release();
  }
}

// ---------- EXPRESS APP ----------
const app = express();

app.use(express.json());

const allowedOrigins = ["http://localhost:5173"];

app.use(
  cors({
    origin: function (origin, callback) {
      //to allow requests with no origin like mobile apps or curl
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      } else {
        return callback(
          new Error("Not allowed by CORS: " + origin)
        );
      }
    },
    credentials: true, 
  })
);



//Health check
app.get("/health", async (req, res) => {
  try {
    const result = await queryDb("SELECT NOW() as now");
    res.json({
      status: "ok",
      dbTime: result.rows[0].now,
    });
  } catch (err) {
    console.error("Health check failed:", err);
    res.status(500).json({ status: "error", error: "DB unreachable" });
  }
});

//List devices
app.get("/devices", async (req, res) => {
  try {
    const result = await queryDb(
      `SELECT device_id, name, description, created_at
       FROM devices
       ORDER BY device_id ASC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching devices:", err);
    res.status(500).json({ error: "Failed to fetch devices" });
  }
});

//Latest metrics for device
app.get("/devices/:deviceId/metrics/latest", async (req, res) => {
  const deviceId = Number(req.params.deviceId);
  if (Number.isNaN(deviceId)) {
    return res.status(400).json({ error: "Invalid deviceId" });
  }

  try {
    const result = await queryDb(
      `
      SELECT
        id,
        device_id,
        timestamp,
        target_rpm,
        rpm,
        deviation_rpm,
        deviation_pct,
        pwm,
        duty_pct,
        delta_counts,
        sudden_drop,
        stall,
        overshoot,
        encoder_fault
      FROM telemetry_metrics
      WHERE device_id = $1
      ORDER BY timestamp DESC
      LIMIT 1
      `,
      [deviceId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "No metrics for this device" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error fetching latest metrics:", err);
    res.status(500).json({ error: "Failed to fetch latest metrics" });
  }
});

//metrics for a device
app.get("/devices/:deviceId/metrics", async (req, res) => {
  const deviceId = Number(req.params.deviceId);
  if (Number.isNaN(deviceId)) {
    return res.status(400).json({ error: "Invalid deviceId" });
  }

  const limit = req.query.limit ? Number(req.query.limit) : 200;
  const since = req.query.since; // ISO timestamp string or undefined

  if (limit <= 0 || limit > 10000) {
    return res.status(400).json({ error: "limit must be between 1 and 10000" });
  }

  try {
    let result;
    if (since) {
      result = await queryDb(
        `
        SELECT
          id,
          device_id,
          timestamp,
          target_rpm,
          rpm,
          deviation_rpm,
          deviation_pct,
          pwm,
          duty_pct,
          delta_counts,
          sudden_drop,
          stall,
          overshoot,
          encoder_fault
        FROM telemetry_metrics
        WHERE device_id = $1
          AND timestamp >= $2
        ORDER BY timestamp ASC
        LIMIT $3
        `,
        [deviceId, since, limit]
      );
    } else {
      result = await queryDb(
        `
        SELECT *
        FROM (
          SELECT
            id,
            device_id,
            timestamp,
            target_rpm,
            rpm,
            deviation_rpm,
            deviation_pct,
            pwm,
            duty_pct,
            delta_counts,
            sudden_drop,
            stall,
            overshoot,
            encoder_fault
          FROM telemetry_metrics
          WHERE device_id = $1
          ORDER BY timestamp DESC
          LIMIT $2
        ) AS sub
        ORDER BY timestamp ASC
        `,
        [deviceId, limit]
      );
    }

    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching metrics:", err);
    res.status(500).json({ error: "Failed to fetch metrics" });
  }
});

//Anomaly events for a device
app.get("/devices/:deviceId/anomalies", async (req, res) => {
  const deviceId = Number(req.params.deviceId);
  if (Number.isNaN(deviceId)) {
    return res.status(400).json({ error: "Invalid deviceId" });
  }

  const limit = req.query.limit ? Number(req.query.limit) : 100;
  if (limit <= 0 || limit > 5000) {
    return res.status(400).json({ error: "limit must be between 1 and 5000" });
  }

  try {
    const result = await queryDb(
      `
      SELECT
        anomaly_id,
        device_id,
        timestamp,
        event_type,
        message
      FROM anomaly_events
      WHERE device_id = $1
      ORDER BY timestamp DESC
      LIMIT $2
      `,
      [deviceId, limit]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching anomalies:", err);
    res.status(500).json({ error: "Failed to fetch anomalies" });
  }
});

//Raw telemetry events JSON
app.get("/devices/:deviceId/events", async (req, res) => {
  const deviceId = Number(req.params.deviceId);
  if (Number.isNaN(deviceId)) {
    return res.status(400).json({ error: "Invalid deviceId" });
  }

  const limit = req.query.limit ? Number(req.query.limit) : 200;
  if (limit <= 0 || limit > 5000) {
    return res.status(400).json({ error: "limit must be between 1 and 5000" });
  }

  try {
    const result = await queryDb(
      `
      SELECT
        event_id,
        device_id,
        time_s,
        raw,
        created_at
      FROM telemetry_events
      WHERE device_id = $1
      ORDER BY created_at DESC
      LIMIT $2
      `,
      [deviceId, limit]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching telemetry events:", err);
    res.status(500).json({ error: "Failed to fetch telemetry events" });
  }
});

app.listen(API_PORT, () => {
  console.log(`Motor Telemetry API listening on http://localhost:${API_PORT}`);
});