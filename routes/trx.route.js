const express = require("express");
const router = express.Router();

const {
  syncWMAllDevices,
  forwardToExternalAPI,
  getTrxByDeviceName,
  fetchDeviceSyncLogs,
} = require("../controllers/transactions.wm.controller");

router.get("/wm/sync", syncWMAllDevices);
router.post("/wm/sync/bydate", syncWMAllDevices);
router.post("/wm/sync/device", getTrxByDeviceName);
router.get("/wm/sync-logs/:deviceName", fetchDeviceSyncLogs);

module.exports = router;
