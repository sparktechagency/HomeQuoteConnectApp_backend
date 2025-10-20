const app = require("./app");
const connectDB = require("./config/db");
const { port } = require("./config/env");

connectDB();

app.listen(port, () => {
  console.log(` Server running at http://localhost:${port}`);
});
