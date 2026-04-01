const axios = require("axios");
const { getAccessToken } = require("./token.service");

const WM_URL = process.env.WM_URL;

async function fetchWMData(deviceName, startTS, endTS, page = 1) {
  let token = await getAccessToken();

  const createBody = (accessToken) => {
    const body = new URLSearchParams();
    body.append("currentPage", page);
    body.append("pageSize", 1000);
    body.append("productKey", process.env.PRODUCT_KEY);
    body.append("access_token", accessToken);
    body.append("deviceName", deviceName);
    body.append("startTimeStamp", startTS);
    body.append("endTimeStamp", endTS);
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

module.exports = { fetchWMData };
