const {
  fetchDeviceList,
  fetchDeviceInfo,
  fetchAllDeviceInfo,
} = require("../services/deviceApi.service");
const {
  upsertDevices,
  insertDevice,
  getAllLocalDevices,
} = require("../services/device.service");

const pool = require("../config/database");

async function syncDevices(req, res) {
  try {
    let page = 1;

    const AllDevices = [];

    while (true) {
      const apiResult = await fetchDeviceList(page);

      const data = apiResult.data;
      const list = data.list || [];

      if (list.length === 0) break;

      AllDevices.push(...list);

      if (page >= data.pages) break;

      page++;
    }
    const inserted = await upsertDevices(AllDevices);

    res.json({
      success: true,
      inserted: inserted,
      message:
        inserted === 0
          ? "No new device inserted"
          : "Device inserted succesfully",
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      success: false,
      message: "Device sync failed",
    });
  }
}

async function registerDevice(req, res) {
  try {
    const deviceData = req.body;

    if (
      !deviceData ||
      !deviceData.deviceId ||
      !deviceData.deviceName ||
      !deviceData.merchantId ||
      !deviceData.serialNumber ||
      !deviceData.nama_wp
    ) {
      return res.status(400).json({
        success: false,
        message:
          "deviceId, deviceName, merchantId, serialNumber, and nama_wp are required",
      });
    }

    const inserted = await insertDevice(deviceData);

    if (inserted === 0) {
      return res.status(409).json({
        success: false,
        message: "Device with the same deviceId already exists",
      });
    }

    res.json({
      success: true,
      inserted: inserted,
      message: "Device registered successfully",
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      success: false,
      message: "Device registration failed",
    });
  }
}

//get all device
async function getAllDevices(req, res) {
  try {
    const apiResult = await fetchDeviceList();
    const { SiteDestination } = req.query;

    if (!SiteDestination) {
      return res.status(400).json({
        success: false,
        message: "Parameter SiteDestination wajib disertakan",
      });
    }

    const query = `SELECT merchant_id, wilayah FROM tb_merchant_device WHERE wilayah = $1 LIMIT 1`;
    const result = await pool.query(query, [SiteDestination]);
    const device = result.rows[0];

    if (!device) {
      return res.status(404).json({
        success: false,
        message: `Device dengan SiteDestination: ${SiteDestination} tersebut tidak ditemukan di database`,
      });
    }

    if (apiResult.code !== 200 || !apiResult.data) {
      return res.status(404).json({
        success: false,
        message: "Data perangkat tidak ditemukan dari provider Lydar",
        error: apiResult.msg,
      });
    }

    const deviceList = apiResult.data.list || [];

    const totalDevice = deviceList.length;
    const totalAktif = deviceList.filter(
      (device) => device.deviceStatus === 2,
    ).length;
    const totalOffline = totalDevice - totalAktif;

    const simplifiedDevices = deviceList.map((device) => {
      return {
        deviceName: device.deviceName,
        status: device.deviceStatus === 2 ? "Online" : "Offline",
        batteryPercentage: device.electricity,
        sinyal: device.signal,
        lastUpdated: device.lastTime,
        Alamat: device.address,
        namaWp: device.houseNumber,
      };
    });

    res.json({
      success: true,
      info: {
        total_aktif: totalAktif,
        total_offline: totalOffline,
        total_device: totalDevice,
      },
      devices: simplifiedDevices,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch devices",
    });
  }
}

//get device info by device name
async function getDeviceInfo(req, res) {
  try {
    const { deviceName } = req.params;
    const { SiteDestination } = req.query;

    if (!deviceName) {
      return res.status(400).json({
        success: false,
        message: "Parameter deviceName wajib disertakan",
      });
    }

    if (!SiteDestination) {
      return res.status(400).json({
        success: false,
        message: "Parameter SiteDestination wajib disertakan",
      });
    }

    const query = `SELECT merchant_id, wilayah FROM tb_merchant_device WHERE wilayah = $1 LIMIT 1`;
    const result = await pool.query(query, [SiteDestination]);
    const device = result.rows[0];
    if (!device) {
      return res.status(404).json({
        success: false,
        message: `Device dengan SiteDestination: ${SiteDestination} tersebut tidak ditemukan di database`,
      });
    }

    const apiResult = await fetchDeviceInfo(deviceName);

    if (apiResult.code !== 200 || !apiResult.data) {
      return res.status(404).json({
        success: false,
        message: "Data perangkat tidak ditemukan dari provider Lydar",
        error: apiResult.msg,
      });
    }

    const rawData = apiResult.data;

    const simplifiedData = {
      SerialNumber: rawData.deviceName,
      status: rawData.deviceStatus === 2 ? "Online" : "Offline",
      batteryPercentage: rawData.electricity,
      signalStrength: rawData.signal,
      lastUpdated: rawData.lastTime,
      Alamat: rawData.address,
      NamaWp: rawData.houseNumber,
      TotalPenggunaan: rawData.cValue,
    };

    res.status(200).json({
      success: true,
      message: "Data perangkat berhasil diambil",
      data: simplifiedData,
    });
  } catch (err) {
    console.error("[DEVICE INFO] Error fetching data:", err.message);

    res.status(500).json({
      success: false,
      message: "Gagal mengambil data perangkat info",
      error: err.message,
    });
  }
}

module.exports = {
  syncDevices,
  registerDevice,
  getAllDevices,
  getDeviceInfo,
};
