const pool = require("../config/database");

async function createSyncLog() {
  const result = await pool.query(`
        INSERT INTO sync_log (
        started_at,
        status
        
        )
        VALUES (NOW(), 'SYNC IS RUNNING')
        RETURNING id
        `);

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

module.exports = {
  createSyncLog,
  finishSyncLog,
};
