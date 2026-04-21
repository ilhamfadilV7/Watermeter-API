const {
  getAllHargaDB,
  getHargaByIdDB,
  checkWilayahExistsDB,
  createHargaDB,
  updateHargaDB,
  deleteHargaDB,
} = require("../services/harga.service");

async function getAllHarga(req, res) {
  try {
    const data = await getAllHargaDB();
    res.json({ success: true, message: "Data harga berhasil diambil", data });
  } catch (error) {
    console.error("[CRUD HARGA] Error Get All:", error.message);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan server",
      error: error.message,
    });
  }
}

async function getHargaById(req, res) {
  try {
    const { id } = req.params;
    const data = await getHargaByIdDB(id);

    if (!data) {
      return res
        .status(404)
        .json({ success: false, message: "Data harga tidak ditemukan" });
    }

    res.json({ success: true, message: "Data ditemukan", data });
  } catch (error) {
    console.error("[CRUD HARGA] Error Get By ID:", error.message);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan server",
      error: error.message,
    });
  }
}

async function createHarga(req, res) {
  try {
    let { wilayah, harga } = req.body;

    if (!wilayah || harga === undefined) {
      return res.status(400).json({
        success: false,
        message: "Kolom wilayah dan harga wajib diisi!",
      });
    }

    wilayah = wilayah.toLowerCase().trim();
    harga = parseFloat(harga);

    if (isNaN(harga) || harga < 0) {
      return res
        .status(400)
        .json({ success: false, message: "Nominal harga tidak valid!" });
    }

    const isExists = await checkWilayahExistsDB(wilayah);
    if (isExists) {
      return res.status(409).json({
        success: false,
        message: `Wilayah '${wilayah}' sudah memiliki tarif terdaftar.`,
      });
    }

    const newData = await createHargaDB(wilayah, harga);
    res.status(201).json({
      success: true,
      message: "Data harga berhasil ditambahkan",
      data: newData,
    });
  } catch (error) {
    console.error("[CRUD HARGA] Error Create:", error.message);
    res.status(500).json({
      success: false,
      message: "Gagal menyimpan data",
      error: error.message,
    });
  }
}

async function updateHarga(req, res) {
  try {
    const { id } = req.params;
    let { wilayah, harga } = req.body;

    if (!wilayah || harga === undefined) {
      return res.status(400).json({
        success: false,
        message: "Kolom wilayah dan harga wajib diisi!",
      });
    }

    wilayah = wilayah.toLowerCase().trim();
    harga = parseFloat(harga);

    if (isNaN(harga) || harga < 0) {
      return res
        .status(400)
        .json({ success: false, message: "Nominal harga tidak valid!" });
    }

    const existingData = await getHargaByIdDB(id);
    if (!existingData) {
      return res.status(404).json({
        success: false,
        message: "Data yang ingin diubah tidak ditemukan",
      });
    }

    const isExists = await checkWilayahExistsDB(wilayah, id);
    if (isExists) {
      return res.status(409).json({
        success: false,
        message: `Wilayah '${wilayah}' sudah dipakai oleh ID lain.`,
      });
    }

    const updatedData = await updateHargaDB(id, wilayah, harga);
    res.json({
      success: true,
      message: "Data harga berhasil diperbarui",
      data: updatedData,
    });
  } catch (error) {
    console.error("[CRUD HARGA] Error Update:", error.message);
    res.status(500).json({
      success: false,
      message: "Gagal memperbarui data",
      error: error.message,
    });
  }
}

async function deleteHarga(req, res) {
  try {
    const { id } = req.params;

    const deletedData = await deleteHargaDB(id);
    if (!deletedData) {
      return res.status(404).json({
        success: false,
        message: "Data yang ingin dihapus tidak ditemukan",
      });
    }

    res.json({
      success: true,
      message: "Data harga berhasil dihapus",
      data: deletedData,
    });
  } catch (error) {
    console.error("[CRUD HARGA] Error Delete:", error.message);
    res.status(500).json({
      success: false,
      message: "Gagal menghapus data",
      error: error.message,
    });
  }
}

module.exports = {
  getAllHarga,
  getHargaById,
  createHarga,
  updateHarga,
  deleteHarga,
};
