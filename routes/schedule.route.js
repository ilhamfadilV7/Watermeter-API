const express = require("express");
const router = express.Router();

const {
  getAllSchedules,
  addSchedule,
  editSchedule,
  deleteSchedule,
} = require("../controllers/schedule.controller");

router.get("/schedules", getAllSchedules);
router.post("/schedules", addSchedule);
router.put("/schedules/:id", editSchedule);
router.delete("/schedules/:id", deleteSchedule);

module.exports = router;
