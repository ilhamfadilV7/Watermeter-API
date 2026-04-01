const { fetchDeviceList } = require("../services/deviceApi.service");
const { upsertDevices, insertDevice } = require("../services/device.service");

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
      !deviceData.serialNumber
    ) {
      return res.status(400).json({
        success: false,
        message:
          "deviceId, deviceName, merchantId, and serialNumber are required",
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

module.exports = {
  syncDevices,
  registerDevice,
};
