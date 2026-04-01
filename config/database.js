require("dotenv").config();
const { Pool } = require("pg");

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PW,
  database: process.env.DB_NAME,
  max: 10,
});

pool.connect((err, client, release) => {
  if (err) {
    console.error("DB Connection ERROR:", err.stack);
  } else {
    console.log("Connected to PostgreSQL !");
    release();
  }
});

module.exports = pool;
