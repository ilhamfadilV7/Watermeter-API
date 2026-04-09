const pool = require("../config/database");

async function createSyncLog(deviceName = "ALL_DEVICES") {
  const query = `
        INSERT INTO sync_log (
        started_at,
        status,
        device_name

        )
        VALUES (NOW(), 'SYNC IS RUNNING' , $1)
        RETURNING id
        `;

  const result = await pool.query(query, [deviceName]);
  return result.rows[0].id;
}

async function finishSyncLog(
  logId,
  fetched,
  inserted,
  failed,
  errorMessage,
  status,
) {
  await pool.query(
    `
        UPDATE sync_log SET 
        finished    = NOW(),
        total_fetched   = $1,
        total_inserted  = $2,
        total_failed    = $3,
        last_sync       = NOW(),
        error_message   = $4,
        status          = $5
        WHERE id = $6
        `,
    [fetched, inserted, failed, errorMessage, status, logId],
  );
}

async function getLogsByDeviceName(deviceName, limit = 50) {
  const query = `
    SELECT id, started_at, finished, total_fetched, total_inserted, total_failed, status, error_message, device_name
    FROM sync_log 
    WHERE device_name = $1 
    ORDER BY started_at DESC
    LIMIT $2;
  `;

  const result = await pool.query(query, [deviceName, limit]);
  return result.rows;
}

module.exports = {
  createSyncLog,
  finishSyncLog,
  getLogsByDeviceName,
};
