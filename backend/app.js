const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");

mongoose.set('strictQuery', true);

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
    origin: [
      "http://localhost:4200",
      "http://localhost:4201",
      "https://baseline-gearhub.vercel.app",
      /\.vercel\.app$/,
      "https://baseline-gearhub.pages.dev",
      /\.baseline-gearhub\.pages\.dev$/,
    ],
    credentials: true,
  }),
);
app.use(express.json());

// In Vercel deployments, `/` can be routed to the API function.
// Redirect to the SPA entry so the app still loads.
app.get('/', (_req, res) => res.redirect(302, '/index.html'));

// Health check should respond even when DB is unavailable.
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

// DB connection (cached; one concurrent attempt at a time)
let isConnected = false;
let connectingPromise = null;

async function connectDB() {
  if (isConnected) {
    console.log('=> using existing database connection');
    return;
  }

  if (connectingPromise) {
    console.log('=> waiting for existing connection promise');
    return connectingPromise;
  }

  console.log('=> using new database connection');
  connectingPromise = mongoose
    .connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 3000,
      connectTimeoutMS: 5000,
      socketTimeoutMS: 10000,
    })
    .then(() => {
      isConnected = true;
      connectingPromise = null;
      console.log('=> database connected');
    })
    .catch((err) => {
      connectingPromise = null;
      console.error('=> database connection error:', err);
      throw err;
    });
  return connectingPromise;
}

mongoose.connection.on('disconnected', () => { 
  console.log('=> database disconnected');
  isConnected = false; 
});

app.use(async (req, res, next) => {
  if (req.path === '/api/health') return next();
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

module.exports = app;
