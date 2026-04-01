const express = require("express");
const router = express.Router();

const {
  syncWMAllDevices,
} = require("../controllers/transactions.wm.controller");

router.get("/wm/sync", syncWMAllDevices);
router.post("/wm/sync/bydate", syncWMAllDevices);

module.exports = router;
