const axios = require("axios");
const { getAccessToken } = require("./token.service");

const DEVICE_URL = process.env.DEVICE_URL;

async function fetchDeviceList(page = 1, pageSize = 200) {
  const token = await getAccessToken();

  const body = new URLSearchParams();

  body.append("currentPage", page);
  body.append("pageSize", pageSize);
  body.append("productKey", process.env.PRODUCT_KEY);
  body.append("access_token", token);

  try {
    const response = await axios.request({
      method: "GET",
      url: DEVICE_URL,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      data: body.toString(),
      timeout: 30000,
    });

    return response.data;
  } catch (err) {
    if (err.response?.status === 401) {
      console.log("⚠️ Token expired, retrying...");

      const newToken = await getAccessToken();

      const retryBody = new URLSearchParams();

      retryBody.append("currentPage", page);
      retryBody.append("pageSize", pageSize);
      retryBody.append("productKey", process.env.PRODUCT_KEY);
      retryBody.append("access_token", newToken);

      const retry = await axios.request({
        method: "GET",
        url: DEVICE_URL,
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        data: retryBody.toString(),
      });

      return retry.data;
    }

    throw err;
  }
}

module.exports = { fetchDeviceList };
