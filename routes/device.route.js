const express = require("express");
const router = express.Router();

const {
  syncDevices,
  registerDevice,
  getDeviceInfo,
} = require("../controllers/device.controller");

router.get("/devices/sync", syncDevices);
router.post("/device/register", registerDevice);
router.get("/device/info/:deviceName", getDeviceInfo);

module.exports = router;
