const express = require("express");
const router = express.Router();

const {
  syncWMAllDevices,
  forwardToExternalAPI,
  getTrxByDeviceName,
  fetchDeviceSyncLogs,
  getPic,
  getPaginatedTransactions,
  getAllDevicesUsageChart,
  getDeviceUsageChart,
  getRekapTransaksiDevice,
} = require("../controllers/transactions.wm.controller");

const { getDevicesLocal } = require("../controllers/device.controller");

router.get("/wm/sync", syncWMAllDevices);
router.post("/wm/sync/bydate", syncWMAllDevices);
router.post("/wm/sync/device", getTrxByDeviceName);
router.get("/wm/sync-logs/:deviceName", fetchDeviceSyncLogs);
router.get("/wm/getwmPic/:trxid", getPic);
router.get("/wm/device/all", getDevicesLocal);
router.get("/wm/transactions", getPaginatedTransactions);
router.get("/wm/analytics/all-devices", getAllDevicesUsageChart);
router.get("/wm/analytics/device/:merchant_id", getDeviceUsageChart);
router.get("/wm/rekap/device/:deviceName/", getRekapTransaksiDevice);

module.exports = router;
