const db = require('../../db');

module.exports = async function handleFeedbackNegative(alert, ruleConfig) {
  let status = 'OPEN';
  const events = [];

  events.push({
    eventType: 'CREATED',
    oldStatus: null,
    newStatus: 'OPEN',
    metadata: {}
  });

  if (!alert.driverId) {
    alert.status = status;
    return { alert, events };
  }

  const windowMins = ruleConfig.window_mins;
  const threshold = ruleConfig.escalate_if_count;

  const conn = await db.getConnection();

  try {
    const [rows] = await conn.execute(
      `SELECT COUNT(*) AS cnt
       FROM alerts
       WHERE driver_id = ?
         AND source_type = 'feedback_negative'
         AND timestamp >= DATE_SUB(NOW(), INTERVAL ? MINUTE)`,
      [alert.driverId, windowMins]
    );

    const total = rows[0].cnt + 1;

    if (total >= threshold) {
      const old = status;
      status = 'ESCALATED';
      alert.severity = 'high';

      events.push({
        eventType: 'ESCALATED',
        oldStatus: old,
        newStatus: status,
        metadata: { total }
      });
    }
  } finally {
    conn.release();
  }

  alert.status = status;
  return { alert, events };
};
