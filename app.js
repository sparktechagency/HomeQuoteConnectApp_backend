const express = require("express");
const cors = require("cors");
const errorMiddleware = require("./middlewares/errorMiddlewares");
const router = require("./routes");
const app = express();

app.use(cors());
app.use(express.json());

app.use(router);

app.use(errorMiddleware);

module.exports = app;
