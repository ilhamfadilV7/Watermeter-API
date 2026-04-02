const axios = require("axios");
const pool = require("../config/database");

function convertAPITimeToWIB(apiTime) {
  if (!apiTime) return apiTime;

  const dateObj = new Date(apiTime.replace(" ", "T"));

  dateObj.setHours(dateObj.getHours() - 1);

  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, "0");
  const day = String(dateObj.getDate()).padStart(2, "0");
  const hours = String(dateObj.getHours()).padStart(2, "0");
  const minutes = String(dateObj.getMinutes()).padStart(2, "0");
  const seconds = String(dateObj.getSeconds()).padStart(2, "0");

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

async function getHargaMap() {
  const result = await pool.query(`SELECT wilayah, harga from tb_harga `);
  const map = {};
  result.rows.forEach((row) => {
    map[row.wilayah?.toLowerCase()] = row.harga;
  });
  return map;
}

async function insertWMData(deviceId, merchantId, list, harga = 0) {
  if (!list || list.length === 0) return [];

  const client = await pool.connect();
  try {
    const values = [];
    const placeholders = [];

    list.forEach((item, index) => {
      const offset = index * 11;
      placeholders.push(
        `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9}, $${offset + 10}, $${offset + 11})`,
      );

      const increment = item.data?.cloudIncrement || 0;
      const valueNumber = item.data?.number || 0;
      const transactionId = item.requestId || "";
      const wmPic = item.path || "";

      const valueLalu = valueNumber - increment;
      const originalTime = item.createTime;
      const trxDate = originalTime
        ? convertAPITimeToWIB(originalTime)
        : convertAPITimeToWIB(
            new Date().toISOString().replace("T", " ").substring(0, 19),
          );

      const d = new Date(trxDate.replace(" ", "T"));

      const tglDicatat = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;

      const namaBulan = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "Mei",
        "Jun",
        "Jul",
        "Ags",
        "Sep",
        "Okt",
        "Nov",
        "Des",
      ];
      const bulanRekening = `${namaBulan[d.getMonth()]} ${d.getFullYear()}`;

      const grandTotal = increment * harga;

      const rawdata =
        `No. Pelanggan: ${merchantId}\n` +
        `Nomor Tagihan: ${transactionId}\n` +
        `Bulan Rekening: ${bulanRekening}\n` +
        `Tarif: ${harga}\n` +
        `Tgl. Dicatat: ${tglDicatat}\n` +
        `Cat. Meter Kini: ${valueNumber}\n` +
        `Cat. Meter Lalu: ${valueLalu}\n` +
        `Pemakaian Air: ${increment}\n` +
        `Total: ${grandTotal}`;

      values.push(
        transactionId,
        merchantId,
        deviceId,
        valueNumber,
        increment,
        harga,
        grandTotal,
        trxDate,
        trxDate,
        wmPic,
        rawdata,
      );
    });

    const query = `
      INSERT INTO tb_trx_merchant (
        transaction_id, merchant_id, device_id, value, increment, harga, grand_total, trx_date, created_time, wm_pic, rawdata
      )
      VALUES ${placeholders.join(", ")} 
      ON CONFLICT (transaction_id) DO NOTHING
      RETURNING *; 
    `;

    const result = await client.query(query, values);
    return result.rows;
  } finally {
    client.release();
  }
}

async function forwardToExternalAPI(insertedRows) {
  if (!insertedRows || insertedRows.length === 0) return;

  const TARGET_URL = process.env.TRX_URL;

  for (const row of insertedRows) {
    if (Number(row.increment) === 0 || Number(row.harga) === 0) {
      console.log(
        `[SKIP FORWARD TRX = 0] Trx ID: ${row.transaction_id} dilewati (Increment: ${row.increment}, Harga: ${row.harga})`,
      );
      continue;
    }

    const grandTotal = parseFloat(row.grand_total) || 0;
    const taxPercent = 10.0;
    const trxAmount = grandTotal / (1 + taxPercent / 100);
    const trxTax = grandTotal - trxAmount;
    const pad = (n) => String(n).padStart(2, "0");
    const d = new Date(row.trx_date);
    const localTrxDate = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

    const payload = {
      idMerchant: row.merchant_id,
      rawData: row.rawdata || "",
      trxId: row.transaction_id,
      trxAmount: trxAmount,
      trxTax: trxTax,
      trxService: 0.0,
      trxDate: typeof row.trx_date === "string" ? row.trx_date : localTrxDate,
      taxType: "AIR BAWAH TANAH",
      taxPercent: taxPercent,
      opsenPercent: 0.0,
      Opsen: 0.0,
      status: "TRANSAKSI",
      deviceId: row.device_id,
    };

    try {
      await axios.post(TARGET_URL, payload, {
        headers: { "Content-Type": "application/json" },
        timeout: 10000,
      });
      console.log(`[SEND TRX SUCCESS] Trx ID: ${row.transaction_id}`);
    } catch (err) {
      console.error(
        `[SEND TRX FAILED] Trx ID: ${row.transaction_id} | Err: ${err.message}`,
      );
    }
  }
}

//get data trx device by device name
async function getTrxByDevicename(startTs, endTs, page = 1) {
  const { deviceName } = req.body;
  let token = await getAccessToken();

  const createBody = (accessToken) => {
    const body = new URLSearchParams();
    body.append("currentPage", page);
    body.append("pageSize", 1000);
    body.append("productKey", process.env.PRODUCT_KEY);
    body.append("access_token", accessToken);
    body.append("deviceName", deviceName);
    body.append("startTimeStamp", startTs);
    body.append("endTimeStamp", endTs);
    return body.toString();
  };

  try {
    const response = await axios.request({
      method: "GET",
      url: WM_URL,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      data: createBody(token),
      timeout: 30000,
    });
    return response.data;
  } catch (err) {
    if (err.response?.status === 401) {
      console.log("⚠️ Token expired at WM Data fetch, retrying...");
      const newToken = await getAccessToken();

      const retryResponse = await axios.request({
        method: "GET",
        url: WM_URL,
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        data: createBody(newToken),
        timeout: 30000,
      });
      return retryResponse.data;
    }
    throw err;
  }
}

module.exports = {
  insertWMData,
  getHargaMap,
  forwardToExternalAPI,
  getTrxByDevicename,
};
