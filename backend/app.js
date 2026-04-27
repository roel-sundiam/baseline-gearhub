const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");

const authRoutes = require("./routes/auth.routes");
const usersRoutes = require("./routes/users.routes");
const ratesRoutes = require("./routes/rates.routes");
const sessionsRoutes = require("./routes/sessions.routes");
const analyticsRoutes = require("./routes/analytics.routes");
const reservationsRoutes = require("./routes/reservations.routes");
const chargesRoutes = require("./routes/charges.routes");
const appServicePaymentsRoutes = require("./routes/app-service-payments.routes");
const tournamentsRoutes = require("./routes/tournaments.routes");
const clubsRoutes = require("./routes/clubs.routes");
const { router: coinsRoutes } = require("./routes/coins.routes");

const app = express();

// Middleware
app.use(
  cors({
    origin: ["http://localhost:4200", "http://localhost:4201"],
    credentials: true,
  }),
);
app.use(express.json());

// DB connection (cached; one concurrent attempt at a time)
let isConnected = false;
let connectingPromise = null;

async function connectDB() {
  if (isConnected) return;
  if (connectingPromise) return connectingPromise;
  connectingPromise = mongoose
    .connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 10000,
      socketTimeoutMS: 20000,
    })
    .then(() => {
      isConnected = true;
      connectingPromise = null;
    })
    .catch((err) => {
      connectingPromise = null;
      throw err;
    });
  return connectingPromise;
}

mongoose.connection.on('disconnected', () => { isConnected = false; });

app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    console.error("DB connection error:", err);
    res.status(503).json({ error: "Database unavailable" });
  }
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/rates", ratesRoutes);
app.use("/api/sessions", sessionsRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/reservations", reservationsRoutes);
app.use("/api/charges", chargesRoutes);
app.use("/api/app-service-payments", appServicePaymentsRoutes);
app.use("/api/tournaments", tournamentsRoutes);
app.use("/api/clubs", clubsRoutes);
app.use("/api/coins", coinsRoutes);

// Health check
app.get("/api/health", (req, res) => res.json({ status: "ok" }));

module.exports = app;
