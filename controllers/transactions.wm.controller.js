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

async function kalkulasiPajakABT(totalVolume) {
  let sisaVolume = totalVolume;
  let npa = 0;
  const rincianTier = [];

  const skemaTarif = [
    { batas: 50, harga: 2100, label: "0 - 50 m³" },
    { batas: 500, harga: 2184, label: "51 - 500 m³" },
    { batas: 1000, harga: 2268, label: "501 - 1000 m³" },
    { batas: 2500, harga: 2352, label: "1001 - 2500 m³" },
    { batas: Infinity, harga: 2436, label: "> 2500 m³" },
  ];

  for (let i = 0; i < skemaTarif.length; i++) {
    if (sisaVolume <= 0) break;
    const tier = skemaTarif[i];
    const volumeKenaTarif = Math.min(sisaVolume, tier.batas);
    const subtotal = volumeKenaTarif * tier.harga;

    npa += subtotal;

    sisaVolume -= volumeKenaTarif;

    rincianTier.push({
      tier: tier.label,
      volume: volumeKenaTarif,
      hargaDasar: tier.harga,
      subtotal: subtotal,
    });
  }

  const persenPajak = 0.2;
  const totalPajak = npa * persenPajak;
  const totalPajakRounded = Math.round(totalPajak);

  return {
    volumeTotal: totalVolume,
    rincian: rincianTier,
    JumlahNilaiPerolehanAir: npa,
    pajakPersen: 20,
    JumlahPajak: totalPajakRounded,
  };
}

function kalkulasiPajakABTSkema2(totalVolume) {
  const skemaTarif = [
    { min: 0, max: 50, harga: 2100, label: "0 - 50 m³" },
    { min: 51, max: 500, harga: 2184, label: "51 - 500 m³" },
    { min: 501, max: 1000, harga: 2268, label: "501 - 1000 m³" },
    { min: 1001, max: 2500, harga: 2352, label: "1001 - 2500 m³" },
    { min: 2501, max: Infinity, harga: 2436, label: "> 2500 m³" },
  ];

  const tierTerpilih = skemaTarif.find(
    (tier) => totalVolume >= tier.min && totalVolume <= tier.max,
  );

  if (!tierTerpilih) {
    throw new Error("Volume penggunaan tidak valid.");
  }

  const hargaSatuan = tierTerpilih.harga;
  const npa = totalVolume * hargaSatuan;

  const persenPajak = 0.2;
  const totalPajakMurni = npa * persenPajak;
  const totalPajakBulat = Math.floor(totalPajakMurni);

  return {
    volumeTotal: totalVolume,
    tierYangDigunakan: tierTerpilih.label,
    hargaDasar: hargaSatuan,
    JumlahNilaiPerolehanAir: npa,
    pajakPersen: 20,
    JumlahPajak: totalPajakBulat,
  };
}

async function getPaginatedTransactions(req, res) {
  try {
    const {
      merchant_id,
      start_date,
      end_date,
      page = 1,
      limit = 10,
    } = req.query;

    if (!merchant_id) {
      return res.status(400).json({
        success: false,
        message: "Parameter merchant_id wajib disertakan dalam query URL.",
      });
    }

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const offset = (pageNum - 1) * limitNum;

    const { data, total, totalUsage } = await getTransactionsDB(
      merchant_id,
      start_date,
      end_date,
      limitNum,
      offset,
    );

    const kalkulasiPajak = await kalkulasiPajakABT(totalUsage);
    const kalkulasiPajakSkema2 = await kalkulasiPajakABTSkema2(totalUsage);

    const mappedData = data.map((item) => {
      const volumeSebelumnya = item.value - item.increment;
      return {
        idTransaksi: item.transaction_id,
        merchant_id: item.merchant_id,
        volumeSaatIni: item.value,
        volumeSebelumnya: volumeSebelumnya,
        pemakaianAir: item.increment,
        waktuCatat: item.created_time,
        fotoMeteranUrl: item.wm_pic,
        rawdata: item.rawdata,
      };
    });

    res.status(200).json({
      success: true,
      message: `Data transaksi ditemukan untuk merchant ${merchant_id}`,
      total_penggunaan: totalUsage,
      harga_kalkulasi_v1: kalkulasiPajak,
      harga_kalkulasi_v2: kalkulasiPajakSkema2,
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

async function getAllDevicesUsageChart(req, res) {
  try {
    const { start_date, end_date } = req.query;
    if (!start_date || !end_date) {
      return res.status(400).json({
        success: false,
        message: "Parameter start_date dan end_date wajib disertakan.",
      });
    }

    const chartData = await getAllDevicesUsageChartDB(start_date, end_date);
    const grandTotal = chartData.reduce(
      (sum, item) => sum + item.total_penggunaan,
      0,
    );

    res.status(200).json({
      success: true,
      message: "Data grafik penggunaan air seluruh device berhasil diambil",
      grand_total_penggunaan: grandTotal,
      chart_data: chartData,
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
