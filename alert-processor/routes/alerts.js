const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/:id', async (req, res) => {
  const alertId = req.params.id;

  try {
    const conn = await db.getConnection();

    const [alertRows] = await conn.execute(
      `SELECT alert_id, driver_id, source_type, severity, status,
              timestamp, metadata
       FROM alerts WHERE alert_id = ?`,
      [alertId]
    );

    if (alertRows.length === 0) {
      conn.release();
      return res.status(404).json({ error: "Alert not found" });
    }

    const alert = alertRows[0];

    const [events] = await conn.execute(
      `SELECT event_type, old_status, new_status, timestamp, metadata
       FROM alert_events
       WHERE alert_id = ?
       ORDER BY timestamp ASC`,
      [alertId]
    );

    conn.release();

    return res.json({
      alert,
      history: events
    });

  } catch (err) {
    console.error("Error fetching alert:", err);
    return res.status(500).json({ error: "Server error fetching alert details" });
  }
});

module.exports = router;
