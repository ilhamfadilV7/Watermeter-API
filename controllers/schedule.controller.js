const pool = require("../config/database");
const {
  scheduleJobInMemory,
  cancelJobInMemory,
} = require("../services/scheduler.service");

async function getAllSchedules(req, res) {
  try {
    const result = await pool.query(
      "SELECT * FROM tb_settings ORDER BY id DESC",
    );

    if (result.rowCount === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Tidak ada jadwal ditemukan" });
    }

    res.status(200).json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

async function addSchedule(req, res) {
  const { device_name, schedule, description } = req.body;

  try {
    const check = await pool.query(
      "SELECT * FROM tb_settings WHERE device_name = $1",
      [device_name],
    );

    if (check.rowCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Jadwal untuk device '${device_name}' sudah ada. Gunakan nama device lain atau edit jadwal yang sudah ada.`,
      });
    }

    const result = await pool.query(
      `
      INSERT INTO tb_settings (device_name, schedule, description, status) 
      VALUES ($1, $2, $3, 'active') 
      RETURNING *
    `,
      [device_name, schedule, description],
    );

    const newSetting = result.rows[0];

    scheduleJobInMemory(newSetting);

    res.json({
      success: true,
      message: "Jadwal berhasil ditambahkan!",
      data: newSetting,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

async function editSchedule(req, res) {
  const { id } = req.params;
  const { schedule, status, description } = req.body;

  try {
    const result = await pool.query(
      `
      UPDATE tb_settings 
      SET schedule = $1, status = $2, description = $3, updated_at = NOW() 
      WHERE id = $4 
      RETURNING *
    `,
      [schedule, status, description, id],
    );

    if (result.rowCount === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Jadwal tidak ditemukan" });
    }

    const updatedSetting = result.rows[0];

    if (updatedSetting.status === "active") {
      scheduleJobInMemory(updatedSetting);
    } else {
      cancelJobInMemory(updatedSetting.id);
    }

    res.json({
      success: true,
      message: "Jadwal berhasil diupdate!",
      data: updatedSetting,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

async function deleteSchedule(req, res) {
  const { id } = req.params;

  try {
    const result = await pool.query(
      "DELETE FROM tb_settings WHERE id = $1 RETURNING *",
      [id],
    );

    if (result.rowCount === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Jadwal tidak ditemukan" });
    }

    cancelJobInMemory(id);

    res.json({ success: true, message: "Jadwal berhasil dihapus!" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

module.exports = {
  getAllSchedules,
  addSchedule,
  editSchedule,
  deleteSchedule,
};
