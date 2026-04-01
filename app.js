const express = require("express");
const cors = require("cors");
const createError = require("http-errors");
const morgan = require("morgan");
require("dotenv").config();
const pool = require("./config/database");
const deviceRoute = require("./routes/device.route");
const trxRoute = require("./routes/trx.route");

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(morgan("dev"));
app.use(cors());

app.get("/", async (req, res, next) => {
  res.send({ message: "Awesome it works 🐻" });
});

app.use("/api", require("./routes/api.route"));
app.use("/api", deviceRoute);
app.use("/api", trxRoute);

app.use((req, res, next) => {
  next(createError.NotFound());
});

app.use((err, req, res, next) => {
  res.status(err.status || 500);
  res.send({
    status: err.status || 500,
    message: err.message,
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 @ http://localhost:${PORT}`));
