const { executeDeviceSyncTask } = require("./syncTask.service");
const schedule = require("node-schedule");
const pool = require("../config/database");

async function executeTask(settingId, deviceName, jobName) {
  console.log(`[SCHEDULER] Mulai task untuk device: ${deviceName}`);

  try {
    const result = await executeDeviceSyncTask(deviceName);

    console.log(
      `[SCHEDULER] Sync berhasil untuk device: ${deviceName}. Total Insert: ${result.inserted}`,
    );

    let nextRun = null;
    if (schedule.scheduledJobs[jobName]) {
      nextRun = schedule.scheduledJobs[jobName].nextInvocation().toDate();
    }

    await pool.query(
      `
      UPDATE tb_settings 
      SET passed = passed + 1, 
          log = 'SUCCESS: ' || $3 || ' data ditarik.', 
          last_run_time = NOW(),
          next_run_time = $2
      WHERE id = $1
    `,
      [settingId, nextRun, result.inserted],
    );
  } catch (error) {
    console.error(`[SCHEDULER ERROR] Device ${deviceName}: ${error.message}`);

    let nextRun = null;
    if (schedule.scheduledJobs[jobName]) {
      nextRun = schedule.scheduledJobs[jobName].nextInvocation().toDate();
    }

    await pool.query(
      `
      UPDATE tb_settings 
      SET log = $1, status = 'error', last_run_time = NOW(), next_run_time = $3 
      WHERE id = $2
    `,
      [`FAILED: ${error.message}`, settingId, nextRun],
    );
  }
}

async function scheduleJobInMemory(setting) {
  const jobName = `job_${setting.id}`;

  if (schedule.scheduledJobs[jobName]) {
    schedule.scheduledJobs[jobName].cancel();
  }

  if (setting.status !== "active") {
    await pool.query(
      `UPDATE tb_settings SET next_run_time = NULL WHERE id = $1`,
      [setting.id],
    );
    return;
  }

  const rule = {
    rule: setting.schedule,
    tz: "Asia/Jakarta",
  };

  const job = schedule.scheduleJob(jobName, rule, async () => {
    await executeTask(setting.id, setting.device_name, jobName);
  });

  if (job) {
    const nextRun = job.nextInvocation().toDate();
    await pool.query(
      `UPDATE tb_settings SET next_run_time = $1 WHERE id = $2`,
      [nextRun, setting.id],
    );
  }

  console.log(
    `[SCHEDULER] Job terdaftar: ${jobName} | Jadwal: ${setting.schedule} (WIB)`,
  );
}

async function initAllSchedules() {
  console.log("[SCHEDULER] Menginisialisasi jadwal dari database...");
  try {
    const result = await pool.query(
      "SELECT * FROM tb_settings WHERE status = 'active'",
    );
    result.rows.forEach((setting) => {
      scheduleJobInMemory(setting);
    });
    console.log(`[SCHEDULER] Berhasil memuat ${result.rowCount} jadwal aktif.`);
  } catch (error) {
    console.error("[SCHEDULER] Gagal memuat jadwal dari DB:", error.message);
  }
}

function cancelJobInMemory(settingId) {
  const jobName = `job_${settingId}`;
  if (schedule.scheduledJobs[jobName]) {
    schedule.scheduledJobs[jobName].cancel();
    console.log(`[SCHEDULER] Job dibatalkan: ${jobName}`);
  }
}

module.exports = {
  initAllSchedules,
  scheduleJobInMemory,
  cancelJobInMemory,
};
