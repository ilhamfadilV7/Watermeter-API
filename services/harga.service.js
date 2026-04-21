const pool = require("../config/database");

async function getAllHargaDB() {
  const result = await pool.query("SELECT * FROM tb_harga ORDER BY id DESC");
  return result.rows;
}

async function getHargaByIdDB(id) {
  const result = await pool.query("SELECT * FROM tb_harga WHERE id = $1", [id]);
  return result.rows[0];
}

async function checkWilayahExistsDB(wilayah, excludeId = null) {
  let query = "SELECT id FROM tb_harga WHERE wilayah = $1";
  const params = [wilayah];

  if (excludeId) {
    query += " AND id != $2";
    params.push(excludeId);
  }

  const result = await pool.query(query, params);
  return result.rowCount > 0;
}

async function createHargaDB(wilayah, harga) {
  const result = await pool.query(
    `INSERT INTO tb_harga (wilayah, harga, created_time, updated_time) 
     VALUES ($1, $2, NOW(), NOW()) RETURNING *`,
    [wilayah, harga],
  );
  return result.rows[0];
}

async function updateHargaDB(id, wilayah, harga) {
  const result = await pool.query(
    `UPDATE tb_harga 
     SET wilayah = $1, harga = $2, updated_time = NOW() 
     WHERE id = $3 RETURNING *`,
    [wilayah, harga, id],
  );
  return result.rows[0];
}

async function deleteHargaDB(id) {
  const result = await pool.query(
    "DELETE FROM tb_harga WHERE id = $1 RETURNING *",
    [id],
  );
  return result.rows[0];
}

module.exports = {
  getAllHargaDB,
  getHargaByIdDB,
  checkWilayahExistsDB,
  createHargaDB,
  updateHargaDB,
  deleteHargaDB,
};
