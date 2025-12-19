import mqtt from "mqtt";
import dotenv from "dotenv";
import pkg from "pg";

dotenv.config();
const { Pool } = pkg;


//MQTT config
const host = process.env.MQTT_HOST;
const port = process.env.MQTT_PORT;
const username = process.env.MQTT_USERNAME;
const password = process.env.MQTT_PASSWORD;
const topic = process.env.MQTT_TOPIC;

//default device name if not specified
const DEFAULT_DEVICE_NAME = process.env.DEVICE_NAME || "motor-driver-01";

const pool = new Pool({
  host: process.env.PG_HOST,
  port: process.env.PG_PORT ? Number(process.env.PG_PORT) : 5432,
  user: process.env.PG_USER,
  password: process.env.PG_PASSWORD,
  database: process.env.PG_DATABASE,
  ssl: process.env.PG_SSL === "true" ? { rejectUnauthorized: false } : false,
});

//devices cache 
const deviceCache = new Map(); 


async function getOrCreateDeviceId(deviceName) {
  if (deviceCache.has(deviceName)) {
    return deviceCache.get(deviceName);
  }

  const client = await pool.connect();
  try {
    const res = await client.query(
      "SELECT device_id FROM devices WHERE name = $1",
      [deviceName]
    );

    if (res.rowCount > 0) {
      const id = res.rows[0].device_id;
      deviceCache.set(deviceName, id);
      console.log(`Found device '${deviceName}' with id=${id}`);
      return id;
    }

    const insertRes = await client.query(
      "INSERT INTO devices (name, description) VALUES ($1, $2) RETURNING device_id",
      [deviceName, "Telemetry device"]
    );
    const newId = insertRes.rows[0].device_id;
    deviceCache.set(deviceName, newId);
    console.log(`Created device '${deviceName}' with id=${newId}`);
    return newId;
  } finally {
    client.release();
  }
}

/**
 * Uploads telemetry into following tables:
 *  - telemetry_metrics
 *  - telemetry_events
 *  - anomaly_events if needed
 */
async function handleTelemetryMessage(rawPayload) {
  let data;
  try {
    data = JSON.parse(rawPayload);
  } catch (err) {
    console.error("Failed to parse JSON payload:", err);
    console.error("Payload was:", rawPayload);
    return;
  }

  //determines device name from payload 
  //expecting data.device_name, but fall back to default if missing
  const deviceName = data.device_name || DEFAULT_DEVICE_NAME;

  let deviceId;
  try {
    deviceId = await getOrCreateDeviceId(deviceName);
  } catch (err) {
    console.error(
      `Failed to resolve deviceId for device_name='${deviceName}':`,
      err
    );
    return;
  }

  const time_s        = data.time_s ?? null;
  const target_rpm    = data.target_rpm ?? null;
  const rpm           = data.rpm ?? null;
  const deviation_rpm = data.deviation_rpm ?? null;
  const deviation_pct = data.deviation_pct ?? null;
  const pwm           = data.pwm ?? null;
  const duty_pct      = data.duty_pct ?? null;
  const delta_counts  = data.delta_counts ?? null;

  const flags         = data.flags || {};
  const sudden_drop   = !!flags.sudden_drop;
  const stall         = !!flags.stall;
  const overshoot     = !!flags.overshoot;
  const encoder_fault = !!flags.encoder_fault;

  const status =
    flags.status ||
    (stall || encoder_fault || sudden_drop || overshoot ? "ALERT" : "OK");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    //telemetry_metrics
    await client.query(
      `
      INSERT INTO telemetry_metrics (
        device_id,
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
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      `,
      [
        deviceId,
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
        encoder_fault,
      ]
    );

    await client.query(
      `
      INSERT INTO telemetry_events (
        device_id,
        time_s,
        raw
      )
      VALUES ($1, $2, $3::jsonb)
      `,
      [deviceId, time_s, JSON.stringify(data)]
    );

    const anomaliesToInsert = [];

    if (sudden_drop) {
      anomaliesToInsert.push({
        type: "DROP",
        msg: `Sudden RPM drop detected (rpm=${rpm}, target=${target_rpm})`,
      });
    }
    if (stall) {
      anomaliesToInsert.push({
        type: "STALL",
        msg: `Possible stall / high load (rpm=${rpm}, pwm=${pwm})`,
      });
    }
    if (overshoot) {
      anomaliesToInsert.push({
        type: "OVERSHOOT",
        msg: `RPM overshoot (rpm=${rpm}, target=${target_rpm})`,
      });
    }
    if (encoder_fault) {
      anomaliesToInsert.push({
        type: "ENCODER_FAULT",
        msg: `Encoder not updating while PWM=${pwm}, delta_counts=${delta_counts}`,
      });
    }

    for (const a of anomaliesToInsert) {
      await client.query(
        `
        INSERT INTO anomaly_events (
          device_id,
          event_type,
          message
        )
        VALUES ($1, $2, $3)
        `,
        [deviceId, a.type, a.msg]
      );
    }

    await client.query("COMMIT");

    console.log(
      `[${deviceName}] Stored telemetry: rpm=${rpm}, target=${target_rpm}, pwm=${pwm}, status=${status}`
    );
    if (anomaliesToInsert.length > 0) {
      console.log(
        `[${deviceName}] Anomalies recorded: ${anomaliesToInsert
          .map((a) => a.type)
          .join(", ")}`
      );
    }
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Database error while handling telemetry:", err);
  } finally {
    client.release();
  }
}

//MQTT setup
const clientId = "motor-telemetry-ingester";
const connectUrl = `mqtts://${host}:${port}`;

console.log("MQTT config:", {
  host,
  port,
  username,
  topic,
});

async function main() {
  //made sure getOrCreateDeviceId is called per message

  const client = mqtt.connect(connectUrl, {
    clientId,
    clean: true,
    username,
    password,
    reconnectPeriod: 2000,
  });

  client.on("connect", () => {
    console.log("MQTT Connected");
    client.subscribe(topic, () => {
      console.log(`Subscribed to topic: ${topic}`);
    });
  });

  client.on("message", async (topic, message) => {
    const payloadStr = message.toString();
    console.log("---- -----------------------Incoming MQTT Message ------------------------------------");
    console.log("Topic:", topic);
    console.log("msg:", payloadStr);
    console.log("----------------------------------------------------------------");

    await handleTelemetryMessage(payloadStr);
  });

  client.on("error", (err) => {
    console.error("MQTT Error:", err);
  });
}

main().catch((err) => {
  console.error("Startup error, quitting:", err);
  process.exit(1);
});