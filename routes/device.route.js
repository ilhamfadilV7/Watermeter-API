const express = require("express");
const router = express.Router();

const {
  syncDevices,
  registerDevice,
  getDeviceInfo,
  getAllDevices,
} = require("../controllers/device.controller");

router.get("/devices/sync", syncDevices);
router.post("/device/register", registerDevice);
router.get("/device/info/:deviceName", getDeviceInfo);
router.get("/devices", getAllDevices);

module.exports = router;
