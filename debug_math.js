const db = require('./db');

// Helper to simulate the worker's time shift
function getShiftedTime(dateObj = new Date()) {
  return new Date(dateObj.getTime() - (330 * 60 * 1000));
}

async function debug() {
  const conn = await db.getConnection();
  try {
    console.log("\n--- DEBUGGING TIME MATH ---");
    
    // 1. Get System Time
    const now = new Date();
    console.log(`💻 System Time (Node.js):   ${now.toLocaleString()}`);
    console.log(`📉 Shifted Time (-5.5h):    ${getShiftedTime(now).toLocaleString()}`);
    
    // 2. Get Database Time
    const [dbRows] = await conn.execute("SELECT NOW() as db_now");
    console.log(`🗄️  Database Time (SQL):     ${new Date(dbRows[0].db_now).toLocaleString()}`);

    // 3. Get the most recent Open Alert
    const [rows] = await conn.execute(
      `SELECT alert_id, timestamp, status 
       FROM alerts 
       WHERE status IN ('OPEN', 'ESCALATED') 
       ORDER BY timestamp DESC LIMIT 1`
    );

    if (rows.length === 0) {
      console.log("\n❌ No OPEN alerts found to test.");
      return;
    }

    const alert = rows[0];
    const alertTime = new Date(alert.timestamp);

    console.log(`\n🔍 Analyzing Alert: ${alert.alert_id}`);
    console.log(`   - Status: ${alert.status}`);
    console.log(`   - Created At (DB): ${alertTime.toLocaleString()}`);

    // 4. Run the "2 Minute" Logic Check
    const diffMs = now - alertTime;
    const diffMins = diffMs / 1000 / 60;

    console.log(`\n🧮 THE MATH:`);
    console.log(`   Now (${now.toLocaleTimeString()}) - Created (${alertTime.toLocaleTimeString()})`);
    console.log(`   = Difference of ${diffMins.toFixed(2)} minutes`);

    if (diffMins >= 2) {
      console.log(`\n✅ RESULT: It IS older than 2 minutes.`);
      console.log(`   If it's not closing, the worker is failing to SELECT it.`);
    } else {
      console.log(`\n⏳ RESULT: It is NOT older than 2 minutes yet.`);
      console.log(`   It needs ${ (2 - diffMins).toFixed(2) } more minutes.`);
    }

  } catch (err) {
    console.error("Debug Error:", err);
  } finally {
    conn.release();
    process.exit();
  }
}

debug();