const { getDeviceByName } = require("./device.service");
const { fetchWMData } = require("./wmApi.service");
const {
  insertWMData,
  getHargaMap,
  forwardToExternalAPI,
} = require("./trx.service");
const { createSyncLog, finishSyncLog } = require("./syncLog.service");

async function executeDeviceSyncTask(deviceName) {
  let logId;
  let totalFetched = 0;
  let totalSyncInserted = 0;
  let totalFailed = 0;

  const dateNow = new Date();
  const dateYesterday = new Date();
  dateYesterday.setDate(dateNow.getDate() - 1);

  const pad = (n) => String(n).padStart(2, "0");
  const ymdYesterday = `${dateYesterday.getFullYear()}-${pad(dateYesterday.getMonth() + 1)}-${pad(dateYesterday.getDate())}`;
  const ymdToday = `${dateNow.getFullYear()}-${pad(dateNow.getMonth() + 1)}-${pad(dateNow.getDate())}`;

  const startTS = Math.floor(
    new Date(`${ymdYesterday}T00:00:00+07:00`).getTime() / 1000,
  );
  const endTS = Math.floor(
    new Date(`${ymdToday}T23:59:59+07:00`).getTime() / 1000,
  );

  try {
    logId = await createSyncLog(deviceName);

    const device = await getDeviceByName(deviceName);
    if (!device) {
      throw new Error(
        `Device '${deviceName}' tidak ditemukan di database lokal.`,
      );
    }

    const hargaMap = await getHargaMap();
    const deviceWilayah = device.wilayah
      ? device.wilayah.toLowerCase().trim()
      : "tidak_ada_wilayah";
    const hargaDevice = hargaMap[deviceWilayah] || 0;

    let page = 1;
    while (true) {
      try {
        const apiResult = await fetchWMData(
          device.device_name,
          startTS,
          endTS,
          page,
        );
        const list = apiResult.data?.list || [];

        if (list.length === 0) break;
        totalFetched += list.length;

        const newlyInsertedRows = await insertWMData(
          device.device_id,
          device.merchant_id,
          list,
          hargaDevice,
        );
        totalSyncInserted += newlyInsertedRows.length;

        if (newlyInsertedRows.length > 0) {
          await forwardToExternalAPI(newlyInsertedRows);
        }

        if (page >= (apiResult.data?.pages || 1)) break;
        page++;
      } catch (err) {
        totalFailed += 1;
        console.error(
          `[SYNC API ERROR] Device ${deviceName} (Page ${page}):`,
          err.message,
        );
        break;
      }
    }

    await finishSyncLog(
      logId,
      totalFetched,
      totalSyncInserted,
      totalFailed,
      "no error",
      "SUCCESS",
    );

    return {
      success: true,
      inserted: totalSyncInserted,
    };
  } catch (error) {
    if (logId) {
      await finishSyncLog(
        logId,
        totalFetched,
        totalSyncInserted,
        totalFailed,
        error.message,
        "FAILED",
      );
    }
    throw error;
  }
}

module.exports = {
  executeDeviceSyncTask,
};
