const express = require("express");
const router = express.Router();

const {
  syncWMAllDevices,
  forwardToExternalAPI,
  getTrxByDeviceName,
} = require("../controllers/transactions.wm.controller");

router.get("/wm/sync", syncWMAllDevices);
router.post("/wm/sync/bydate", syncWMAllDevices);
router.post("/wm/sync/device", getTrxByDeviceName);

module.exports = router;
