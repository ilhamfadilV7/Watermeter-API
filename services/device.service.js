const pool = require("../config/database");

async function insertDevice(device) {
  const client = await pool.connect();

  try {
    const query = `
      INSERT INTO tb_merchant_device (
        merchant_id,
        device_id,
        device_name,
        status,
        wilayah,        
        type,
        serial_number
      )
      VALUES ($1, $2, $3, $4 , $5, $6 , $7)
      ON CONFLICT (merchant_id, device_id, serial_number) DO NOTHING
    `;

    const result = await client.query(query, [
      device.merchantId,
      device.deviceId,
      device.deviceName,
      device.status,
      device.wilayah,
      device.type,
      device.serialNumber,
    ]);
    return result.rowCount;
  } finally {
    client.release();
  }
}

async function getDevicesFromDB() {
  const result = await pool.query(`
    SELECT device_id, device_name, merchant_id , wilayah FROM tb_merchant_device
  `);
  return result.rows;
}

async function upsertDevices(deviceList, defaultMerchantId = 1010101) {
  if (!deviceList || deviceList.length === 0) return 0;

  const client = await pool.connect();

  try {
    const values = [];
    const placeholders = [];

    deviceList.forEach((d, index) => {
      const offset = index * 4;
      placeholders.push(
        `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4})`,
      );

      values.push(
        d.merchantId || defaultMerchantId,
        d.deviceName,
        d.houseNumber || d.deviceName,
        d.networkType || "UNKNOWN",
      );
    });

    const query = `
      INSERT INTO tb_merchant_device (
        merchant_id,
        device_id,
        device_name,
        type
      )
      VALUES ${placeholders.join(", ")}
      ON CONFLICT (device_id) DO UPDATE SET
        device_name = EXCLUDED.device_name,
        type = EXCLUDED.type
    `;

    const result = await client.query(query, values);
    return result.rowCount;
  } finally {
    client.release();
  }
}

async function getDeviceByName(deviceName) {
  const result = await pool.query(
    `SELECT device_id, device_name, merchant_id , wilayah FROM tb_merchant_device WHERE device_name = $1`,
    [deviceName],
  );
  return result.rows[0];
}

async function getAllLocalDevices() {
  const result = await pool.query(`
    SELECT device_name, type, created_time, wilayah FROM tb_merchant_device
  `);

  if (result.rowCount === 0) {
    return [];
  }

  return result.rows;
}

module.exports = {
  upsertDevices,
  getDevicesFromDB,
  insertDevice,
  getDeviceByName,
  getAllLocalDevices,
};
