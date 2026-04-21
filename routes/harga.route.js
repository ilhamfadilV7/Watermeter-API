const express = require("express");
const router = express.Router();

const {
  getAllHarga,
  getHargaById,
  createHarga,
  updateHarga,
  deleteHarga,
} = require("../controllers/harga.controller");

router.get("/harga", getAllHarga);
router.get("/harga/:id", getHargaById);
router.post("/harga", createHarga);
router.put("/harga/:id", updateHarga);
router.delete("/harga/:id", deleteHarga);

module.exports = router;
