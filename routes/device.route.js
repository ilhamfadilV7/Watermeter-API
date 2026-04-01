const express = require("express");
const router = express.Router();

const {
  syncDevices,
  registerDevice,
} = require("../controllers/device.controller");

router.get("/devices/sync", syncDevices);
router.post("/device/register", registerDevice);

module.exports = router;
