const {
  getDevicesFromDB,
  getDeviceByName,
} = require("../services/device.service");
const { fetchWMData } = require("../services/wmApi.service");
const {
  insertWMData,
  getHargaMap,
  forwardToExternalAPI,
  getWmPic,
  getTransactionsDB,
  getAllDevicesUsageChartDB,
  getDeviceUsageChartDB,
} = require("../services/trx.service");
const {
  createSyncLog,
  finishSyncLog,
  getLogsByDeviceName,
} = require("../services/syncLog.service");

async function syncWMAllDevices(req, res) {
  let logId;
  let totalFetched = 0;
  let totalSyncInserted = 0;
  let totalFailed = 0;
  let startTS, endTS;

  const { start_date, end_date } = req.body || {};

  if (start_date && end_date) {
    //POST METHOD WITH BODY
    startTS = Math.floor(
      new Date(`${start_date}T00:00:00+07:00`).getTime() / 1000,
    );
    endTS = Math.floor(new Date(`${end_date}T23:59:59+07:00`).getTime() / 1000);

    console.log(`[SYNC INIT] Mode Custom Range: ${start_date} s/d ${end_date}`);
  } else {
    const dateYesterday = new Date();
    dateYesterday.setDate(dateYesterday.getDate() - 1);
    const pad = (n) => String(n).padStart(2, "0");
    const ymdYesterday = `${dateYesterday.getFullYear()}-${pad(dateYesterday.getMonth() + 1)}-${pad(dateYesterday.getDate())}`;
    startTS = Math.floor(
      new Date(`${ymdYesterday}T00:00:00+07:00`).getTime() / 1000,
    );
    endTS = Math.floor(
      new Date(`${ymdYesterday}T23:59:59+07:00`).getTime() / 1000,
    );
    console.log(
      `[SYNC INIT] Mode Default: Khusus Kemarin (${ymdYesterday} 00:00:00 s/d 23:59:59)`,
    );
  }

  try {
    logId = await createSyncLog("ALL_DEVICES");
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

async function getTrxByDeviceName(req, res) {
  const { deviceName } = req.body;

  if (!deviceName) {
    return res
      .status(400)
      .json({ success: false, message: "deviceName is required" });
  }

  let logId;
  let totalFetched = 0;
  let totalSyncInserted = 0;
  let totalFailed = 0;

  const endTS = Math.floor(Date.now() / 1000);
  const startTS = endTS - 24 * 60 * 60;

  try {
    logId = await createSyncLog(deviceName);

    const device = await getDeviceByName(deviceName);

    if (!device) {
      return res.status(404).json({
        success: false,
        message: `Device with name ${deviceName} not found`,
      });
    }
    const hargaMap = await getHargaMap();
    const deviceWilayah = device.wilayah
      ? device.wilayah.toLowerCase().trim()
      : "tidak_ada_wilayah";
    const hargaDevice = hargaMap[deviceWilayah] || 0;

    console.log(
      `[SYNC 1 DEVICE] Memproses: ${deviceName} | Wilayah: ${deviceWilayah} | Harga: ${hargaDevice}`,
    );
    let page = 1;
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

        if (page >= (data?.pages || 1)) break;
        page++;
      } catch (err) {
        console.error(`[Device: ${device.device_name}] Error:`, err.message);
        totalFailed += 1;
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

    res.json({
      success: true,
      device: device.device_name,
      inserted: totalSyncInserted,
      message:
        totalSyncInserted === 0
          ? "Tidak ada transaksi baru di 24 jam terakhir"
          : "Transaksi berhasil ditarik dan di-forward",
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

async function fetchDeviceSyncLogs(req, res) {
  try {
    const { deviceName } = req.params;

    if (!deviceName) {
      return res.status(400).json({
        success: false,
        message: "Parameter deviceName wajib disertakan pada URL.",
      });
    }

    const logs = await getLogsByDeviceName(deviceName);

    res.json({
      success: true,
      message: "Berhasil mengambil histori log",
      data: logs,
    });
  } catch (error) {
    console.error("Error fetching sync logs:", error.message);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan sistem saat mengambil histori log.",
      error: error.message,
    });
  }
}

async function getPic(req, res) {
  const { trxid } = req.params;
  try {
    const pic = await getWmPic(trxid);
    if (!pic) {
      return res.status(404).json({
        success: false,
        message: `data tidak ditemukan`,
      });
    }

    return res.status(200).json({
      success: true,
      data: pic,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan sistem saat mengambil data",
      error: error.message,
    });
  }
}

async function getPaginatedTransactions(req, res) {
  try {
    // Ambil semua parameter dari query URL
    const {
      merchant_id,
      start_date,
      end_date,
      page = 1,
      limit = 10,
    } = req.query;

    // Validasi: merchant_id wajib diisi
    if (!merchant_id) {
      return res.status(400).json({
        success: false,
        message: "Parameter merchant_id wajib disertakan dalam query URL.",
      });
    }

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const offset = (pageNum - 1) * limitNum;

    // Panggil service dengan parameter merchant_id
    const { data, total, totalUsage } = await getTransactionsDB(
      merchant_id,
      start_date,
      end_date,
      limitNum,
      offset,
    );

    const mappedData = data.map((item) => {
      const volumeSebelumnya = item.value - item.increment;
      return {
        idTransaksi: item.transaction_id, // Mengubah transaction_id -> idTransaksi
        merchant_id: item.merchant_id, // Mengubah merchant_id -> idMerchant
        volumeSaatIni: item.value, // Mengubah value -> volumeSaatIni
        volumeSebelumnya: volumeSebelumnya, // Menggunakan nilai sebelumnya
        pemakaianAir: item.increment, // Mengubah increment -> kubikasiPakai
        waktuCatat: item.created_time, // Mengubah created_time -> waktuCatat
        fotoMeteranUrl: item.wm_pic, // Mengubah wm_pic -> fotoMeteranUrl
        rawdata: item.rawdata, // Mengubah rawdata -> teksStrukMentah
      };
    });

    res.status(200).json({
      success: true,
      message: `Data transaksi ditemukan untuk merchant ${merchant_id}`,
      total_penggunaan: totalUsage,
      data: mappedData,
      pagination: {
        total_data: total,
        total_pages: Math.ceil(total / limitNum),
        current_page: pageNum,
        limit: limitNum,
      },
    });
  } catch (error) {
    console.error(
      "[TRX CONTROLLER] Error fetching merchant transactions:",
      error.message,
    );
    res.status(500).json({
      success: false,
      message: "Gagal mengambil data transaksi merchant",
      error: error.message,
    });
  }
}

//chart
// [CONTROLLER] 1. Ambil data grafik semua device
async function getAllDevicesUsageChart(req, res) {
  try {
    const { start_date, end_date } = req.query;

    // Validasi range date wajib diisi untuk kebutuhan grafik yang optimal
    if (!start_date || !end_date) {
      return res.status(400).json({
        success: false,
        message: "Parameter start_date dan end_date wajib disertakan.",
      });
    }

    const chartData = await getAllDevicesUsageChartDB(start_date, end_date);

    // Hitung akumulasi total dalam rentang tersebut sebagai ringkasan tambahan
    const grandTotal = chartData.reduce(
      (sum, item) => sum + item.total_penggunaan,
      0,
    );

    res.status(200).json({
      success: true,
      message: "Data grafik penggunaan air seluruh device berhasil diambil",
      grand_total_penggunaan: grandTotal,
      chart_data: chartData, // Berisi array [{ tanggal: "2026-05-01", total_penggunaan: 120 }, ...]
    });
  } catch (error) {
    console.error("[ANALYTICS CONTROLLER] Error all devices:", error.message);
    res.status(500).json({
      success: false,
      message: "Gagal mengambil data statistik grafik",
      error: error.message,
    });
  }
}

// [CONTROLLER] 2. Ambil data grafik berdasarkan device name
async function getDeviceUsageChart(req, res) {
  try {
    const { merchant_id } = req.params;
    const { start_date, end_date } = req.query;

    if (!merchant_id) {
      return res.status(400).json({
        success: false,
        message: "Parameter merchant_id pada URL wajib diisi.",
      });
    }

    if (!start_date || !end_date) {
      return res.status(400).json({
        success: false,
        message: "Parameter start_date dan end_date wajib disertakan.",
      });
    }

    const chartData = await getDeviceUsageChartDB(
      merchant_id,
      start_date,
      end_date,
    );
    const grandTotal = chartData.reduce(
      (sum, item) => sum + item.total_penggunaan,
      0,
    );

    res.status(200).json({
      success: true,
      message: `Data grafik penggunaan air untuk merchant ${merchant_id} berhasil diambil`,
      merchant_id: merchant_id,
      total_penggunaan: grandTotal,
      chart_data: chartData,
    });
  } catch (error) {
    console.error("[ANALYTICS CONTROLLER] Error by merchant:", error.message);
    res.status(500).json({
      success: false,
      message: "Gagal mengambil data statistik grafik merchant",
      error: error.message,
    });
  }
}

module.exports = {
  syncWMAllDevices,
  getTrxByDeviceName,
  forwardToExternalAPI,
  fetchDeviceSyncLogs,
  getPic,
  getPaginatedTransactions,
  getAllDevicesUsageChart,
  getDeviceUsageChart,
};
