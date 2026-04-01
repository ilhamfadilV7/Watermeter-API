const { getDevicesFromDB } = require("../services/device.service");
const { fetchWMData } = require("../services/wmApi.service");
const {
  insertWMData,
  getHargaMap,
  forwardToExternalAPI,
} = require("../services/trx.service");
const { createSyncLog, finishSyncLog } = require("../services/syncLog.service");

async function syncWMAllDevices(req, res) {
  let logId;
  let totalFetched = 0;
  let totalSyncInserted = 0;
  let totalFailed = 0;
  let startTS, endTS;

  const { start_date, end_date } = req.body || {};

  if (start_date && end_date) {
    startTS = Math.floor(
      new Date(`${start_date}T00:00:00+07:00`).getTime() / 1000,
    );
    endTS = Math.floor(new Date(`${end_date}T23:59:59+07:00`).getTime() / 1000);

    console.log(`[SYNC INIT] Mode Custom Range: ${start_date} s/d ${end_date}`);
  } else {
    endTS = Math.floor(Date.now() / 1000);
    startTS = endTS - 24 * 60 * 60;

    console.log(`[SYNC INIT] Mode Default: 24 Jam Terakhir`);
  }

  try {
    logId = await createSyncLog();
    const devices = await getDevicesFromDB();

    const hargaMap = await getHargaMap();

    const chunkSize = 10;

    for (let i = 0; i < devices.length; i += chunkSize) {
      const chunk = devices.slice(i, i + chunkSize);

      const promises = chunk.map(async (device) => {
        let page = 1;
        let deviceFetched = 0;
        let deviceInserted = 0;

        const deviceWilayah = device.wilayah?.toLowerCase();
        const hargaDevice = hargaMap[deviceWilayah] || 0;

        while (true) {
          try {
            const apiResult = await fetchWMData(
              device.device_name,
              startTS,
              endTS,
              page,
            );
            const data = apiResult.data;
            const list = data?.list || [];

            if (list.length === 0) break;
            deviceFetched += list.length;

            const newlyInsertedRows = await insertWMData(
              device.device_id,
              device.merchant_id,
              list,
              hargaDevice,
            );

            deviceInserted += newlyInsertedRows.length;

            if (newlyInsertedRows.length > 0) {
              await forwardToExternalAPI(newlyInsertedRows);
            }

            if (page >= (data?.pages || 1)) break;
            page++;
          } catch (err) {
            console.error(
              `[Device: ${device.device_name}] Error:`,
              err.message,
            );
            totalFailed += 1;
            break;
          }
        }

        totalFetched += deviceFetched;
        totalSyncInserted += deviceInserted;
      });

      await Promise.all(promises);
    }

    await finishSyncLog(
      logId,
      totalFetched,
      totalSyncInserted,
      totalFailed,
      "no error",
      "SUCCESS",
    );

    res.json({
      success: true,
      devices: devices.length,
      inserted: totalSyncInserted,
      message:
        totalSyncInserted === 0
          ? "No new data synced"
          : "All data successfully synced",
    });
  } catch (err) {
    console.error(err);
    if (logId) {
      await finishSyncLog(
        logId,
        totalFetched,
        totalSyncInserted,
        totalFailed,
        err.message,
        "FAILED",
      );
    }
    res
      .status(500)
      .json({ success: false, message: "WM sync failed", error: err.message });
  }
}

module.exports = { syncWMAllDevices };
