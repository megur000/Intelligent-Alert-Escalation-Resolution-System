const express = require('express');
const { Kafka } = require('kafkajs');
const alertRoutes = require('./routes/alerts');

const { randomUUID } = require('crypto');
const db = require('./db');
const { evaluateAlert } = require('./rule-engine');

const app = express();
app.use(express.json());
app.use('/alerts', alertRoutes);

const PORT = process.env.PORT || 4000;
const KAFKA_BROKER = process.env.KAFKA_BROKER || 'kafka:9092';
const TOPIC = process.env.KAFKA_TOPIC || 'alert-events';

const kafka = new Kafka({
  clientId: 'alert-processor',
  brokers: [KAFKA_BROKER]
});

const producer = kafka.producer();

async function initKafka() {
  await producer.connect();
  console.log('Alert Processor connected to Kafka');
}

initKafka().catch(err => {
  console.error('Failed to init Kafka producer', err);
});

// --- CRITICAL FIX: Shift Time to UTC (-5.5 hours) ---
// This ensures that when we write '12:30 IST', the DB receives '07:00 UTC'
// matching what the Worker expects.
function getDbTime(dateObj = new Date()) {
  return new Date(dateObj.getTime() - (330 * 60 * 1000));
}

async function insertAlert(conn, alert) {
  // Convert the alert timestamp to DB Time (UTC)
  const dbTimestamp = getDbTime(new Date(alert.timestamp));

  const [result] = await conn.execute(
    `INSERT INTO alerts 
      (alert_id, driver_id, source_type, severity, status, timestamp, metadata)
     VALUES 
      (?, ?, ?, ?, ?, ?, ?)`, 
    [
      alert.alertId,
      alert.driverId || null,
      alert.sourceType,
      alert.severity || null,
      alert.status,
      dbTimestamp, // <--- Use Corrected UTC Time
      JSON.stringify(alert.metadata || {})
    ]
  );
  return result;
}

async function insertEvent(conn, alertId, ev) {
  // Convert event timestamp to DB Time (UTC)
  const evtTime = ev.timestamp ? new Date(ev.timestamp) : new Date();
  const dbTimestamp = getDbTime(evtTime);
  
  await conn.execute(
    `INSERT INTO alert_events 
      (alert_id, event_type, old_status, new_status, timestamp, metadata)
     VALUES (?, ?, ?, ?, ?, ?)`, 
    [
      alertId,
      ev.eventType,
      ev.oldStatus,
      ev.newStatus,
      dbTimestamp, // <--- Use Corrected UTC Time
      JSON.stringify(ev.metadata || {})
    ]
  );
}

app.post('/process-alert', async (req, res) => {
  const payload = req.body;

  if (!payload || !payload.sourceType) {
    return res.status(400).json({ error: 'Invalid alert payload. Required: sourceType.' });
  }

  // Use Server Time (IST) for Logic, but we will convert to UTC for DB later
  const serverTime = new Date();

  const alert = {
    alertId: randomUUID(),
    sourceType: payload.sourceType,
    severity: payload.severity || 'info',
    timestamp: serverTime,       
    driverId: payload.driverId || null,
    metadata: payload.metadata || {}
  };

  try {
    const { alert: evaluatedAlert, events } = await evaluateAlert(alert);

    // IMPORTANT: Ensure the evaluated alert keeps the server timestamp
    evaluatedAlert.timestamp = serverTime;

    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      await insertAlert(conn, evaluatedAlert);

      for (const ev of events) {
        ev.timestamp = serverTime; 
        await insertEvent(conn, evaluatedAlert.alertId, ev);
      }

      await conn.commit();
    } catch (dbErr) {
      await conn.rollback();
      console.error('DB error:', dbErr);
      return res.status(500).json({ error: 'Database error storing alert' });
    } finally {
      conn.release();
    }

    await producer.send({
      topic: TOPIC,
      messages: [
        {
          key: evaluatedAlert.alertId,
          value: JSON.stringify({
            type: 'ALERT_UPDATED',
            alert: evaluatedAlert,
            events
          })
        }
      ]
    });

    res.status(201).json({
      alertId: evaluatedAlert.alertId,
      status: evaluatedAlert.status
    });

  } catch (err) {
    console.error('Error processing alert:', err);
    res.status(500).json({ error: 'Failed to process alert' });
  }
});

app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'alert-processor' });
});

app.listen(PORT, () => {
  console.log(`Alert Processor listening on port ${PORT}`);
});