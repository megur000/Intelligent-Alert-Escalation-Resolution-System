const db = require('../db');
const rules = require('../config/rules.json');

// Configuration
const POLL_MS = Number(process.env.AUTO_CLOSE_POLL_MS || 5000); 
const DELETE_AFTER_MINUTES = 5; 

function getShiftedTime(dateObj = new Date()) {
  // 330 minutes = 5 hours 30 minutes
  return new Date(dateObj.getTime() - (330 * 60 * 1000));
}

// -------------------------------------------------------
// AUTO CLOSE WORKER
// -------------------------------------------------------
async function autoClose() {
  const conn = await db.getConnection();

  try {
    for (const [src, cfg] of Object.entries(rules)) {
      if (!cfg.auto_close_after_mins) continue;

      const mins = cfg.auto_close_after_mins;
      
      // 1. Calculate Real Cutoff: Now - 2 mins
      const realCutoff = new Date(Date.now() - (mins * 60 * 1000));
      
      // 2. Shift it (-5.5h) so we compare "Apples to Apples" with DB
      const shiftedCutoff = getShiftedTime(realCutoff);

      const [rows] = await conn.execute(
        `SELECT alert_id, status
         FROM alerts
         WHERE source_type = ?
           AND status IN ('OPEN', 'ESCALATED')
           AND \`timestamp\` <= ?`, 
        [src, shiftedCutoff] 
      );

      if (rows.length > 0) {
        console.log(`[AutoClose] Found ${rows.length} candidates for ${src}`);
      }

      for (const r of rows) {
        await conn.beginTransaction();

        try {
          // 3. CAPTURE SHIFTED TIME (-5.5 HOURS) FOR UPDATES
          // We write 06:30 so the DB/Grafana displays 12:00
          const shiftedNow = getShiftedTime(new Date()); 

          // Update status
          await conn.execute(
            `UPDATE alerts SET status='AUTO_CLOSED', \`timestamp\` = ? WHERE alert_id=?`,
            [shiftedNow, r.alert_id]
          );

          // Log event
          await conn.execute(
            `INSERT INTO alert_events
             (alert_id, event_type, old_status, new_status, timestamp, metadata)
             VALUES (?, 'AUTO_CLOSED', ?, 'AUTO_CLOSED', ?, ?)`,
            [r.alert_id, r.status, shiftedNow, JSON.stringify({ reason: 'timeout', src })]
          );

          await conn.commit();
          console.log(`[AutoClose] Closed alert: ${r.alert_id}`);

        } catch (err) {
          await conn.rollback();
          console.error(`[AutoClose] Failed to close ${r.alert_id}:`, err.message);
        }
      }
    }
  } catch (err) {
    console.error("[AutoClose] Critical Error:", err);
  } finally {
    conn.release();
  }
}

// -------------------------------------------------------
// AUTO DELETE WORKER
// -------------------------------------------------------
async function autoDelete() {
  const conn = await db.getConnection();

  try {
    // --- THE FIX ---
    // 1. Get Real Cutoff: Now (12:00) - 5 mins = 11:55
    const realCutoff = new Date(Date.now() - (DELETE_AFTER_MINUTES * 60 * 1000));
    
    // 2. Shift it (-5.5h): 11:55 -> 06:25
    // We must compare against the "Shifted" time stored in the DB
    const shiftedCutoff = getShiftedTime(realCutoff);

    const [rows] = await conn.execute(
      `SELECT alert_id 
       FROM alerts
       WHERE status = 'AUTO_CLOSED'
         AND \`timestamp\` <= ?`,
      [shiftedCutoff]
    );

    if (rows.length > 0) {
      console.log(`[AutoDelete] Found ${rows.length} candidates to delete`);
    }

    for (const r of rows) {
      await conn.beginTransaction();

      try {
        await conn.execute(`DELETE FROM alert_events WHERE alert_id = ?`, [r.alert_id]);
        await conn.execute(`DELETE FROM alerts WHERE alert_id = ?`, [r.alert_id]);

        await conn.commit();
        console.log(`[AutoDelete] Deleted alert: ${r.alert_id}`);

      } catch (err) {
        await conn.rollback();
        console.error(`[AutoDelete] Failed to delete ${r.alert_id}:`, err.message);
      }
    }
  } catch (err) {
    console.error("[AutoDelete] Critical Error:", err);
  } finally {
    conn.release();
  }
}

(async () => {
  console.log("Worker started with Synchronized Time Shifts...");
  setInterval(async () => {
    try {
        await autoClose();
        await autoDelete();
    } catch (e) { console.error("Loop Iteration Failed", e); }
  }, POLL_MS);
})();