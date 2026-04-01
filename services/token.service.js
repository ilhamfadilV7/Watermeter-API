const axios = require("axios");
require("dotenv").config();

let accessToken = null;
let refreshToken = null;
let expiryTime = 0;

const TOKEN_URL = process.env.TOKEN_URL;

async function requestNewToken() {
  console.log("🔑 Request new token...");

  const params = new URLSearchParams();
  params.append("username", process.env.API_USER);
  params.append("password", process.env.API_PASSWORD);
  params.append("grant_type", "password");

  const response = await axios.post(TOKEN_URL, params.toString(), {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });

  const data = response.data;

  if (!data.access_token) {
    throw new Error("Token response invalid");
  }

  accessToken = data.access_token;
  refreshToken = data.refresh_token;

  expiryTime = Date.now() + data.expires_in * 1000 - 60000;

  return accessToken;
}

async function refreshAccessToken() {
  if (!refreshToken) return requestNewToken();

  console.log("🔄 Refresh token...");

  const params = new URLSearchParams();
  params.append("refresh_token", refreshToken);
  params.append("grant_type", "refresh_token");

  try {
    const res = await axios.post(TOKEN_URL, params, {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });

    accessToken = res.data.access_token;
    expiryTime = Date.now() + res.data.expires_in * 1000 - 60000;

    return accessToken;
  } catch (err) {
    console.log("⚠️ Refresh failed, requesting new token...");
    return requestNewToken();
  }
}

async function getAccessToken() {
  if (accessToken && Date.now() < expiryTime) {
    return accessToken;
  }

  return refreshAccessToken();
}

module.exports = {
  getAccessToken,
};
