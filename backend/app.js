const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const Club = require("./models/Club");

function _slugify(name) {
  return name.toLowerCase().trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

async function backfillClubSlugs() {
  try {
    const clubs = await Club.find({ slug: { $exists: false } }).lean();
    for (const club of clubs) {
      let slug = _slugify(club.name);
      const conflict = await Club.findOne({ slug, _id: { $ne: club._id } }).lean();
      if (conflict) slug = slug + '-' + club._id.toString().slice(-4);
      await Club.updateOne({ _id: club._id }, { $set: { slug } });
    }
    if (clubs.length) console.log(`=> backfilled slugs for ${clubs.length} club(s)`);
  } catch (err) {
    console.error('=> slug backfill error:', err);
  }
}

mongoose.set('strictQuery', true);

const authRoutes = require("./routes/auth.routes");
const usersRoutes = require("./routes/users.routes");
const ratesRoutes = require("./routes/rates.routes");
const sessionsRoutes = require("./routes/sessions.routes");
const analyticsRoutes = require("./routes/analytics.routes");
const reservationsRoutes = require("./routes/reservations.routes");
const chargesRoutes = require("./routes/charges.routes");
const creditsRoutes = require("./routes/credits.routes");
const appServicePaymentsRoutes = require("./routes/app-service-payments.routes");
const tournamentsRoutes = require("./routes/tournaments.routes");
const clubsRoutes = require("./routes/clubs.routes");
const newsRoutes = require("./routes/news.routes");
const publicRoutes = require("./routes/public.routes");
const inquiriesRoutes = require("./routes/inquiries.routes");
const pushRoutes = require("./routes/push.routes");
const openPlayRoutes = require("./routes/open-play.routes");
const notificationsRoutes = require("./routes/notifications.routes");
const adminMessagesRoutes = require("./routes/admin-messages.routes");
const ledgerRoutes = require("./routes/ledger.routes");
const reviewsRoutes = require("./routes/reviews.routes");
const perGameRoutes = require("./routes/game-join.routes");
const hostedPlayRoutes = require("./routes/hosted-play.routes");
const configRoutes = require("./routes/config.routes");
const clubLedgerRoutes = require("./routes/club-ledger.routes");
const membershipsRoutes = require("./routes/memberships.routes");

const app = express();

// Middleware
app.use(
  cors({
    origin: [
      "http://localhost:4200",
      "http://localhost:4201",
      "https://courtgo.club",
      "https://www.courtgo.club",
      "https://baseline-gearhub.netlify.app",
      /\.baseline-gearhub\.netlify\.app$/,
    ],
    credentials: true,
  }),
);
app.use(express.json());

// Health check should respond even when DB is unavailable.
app.get(['/health', '/api/health'], (_req, res) => {
  const uri = process.env.MONGODB_URI || '';
  const isLocal = uri.includes('localhost') || uri.includes('127.0.0.1');
  const runtime = process.env.RENDER ? 'render' : (process.env.CONTEXT || process.env.SITE_ID) ? 'netlify' : 'local';
  res.json({
    status: 'ok',
    db: isLocal ? 'local' : 'atlas',
    dbHost: isLocal ? 'localhost:27017' : 'MongoDB Atlas',
    runtime,
  });
});


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
  const isLongRunningServer = !!process.env.RENDER;
  const maxPoolSize = Number(process.env.MONGO_MAX_POOL_SIZE) || (isLongRunningServer ? 10 : 3);
  connectingPromise = mongoose
    .connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 12000,
      socketTimeoutMS: 20000,
      maxPoolSize,
    })
    .then(() => {
      isConnected = true;
      connectingPromise = null;
      console.log('=> database connected');
      backfillClubSlugs();
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
app.use("/api/credits", creditsRoutes);
app.use("/api/app-service-payments", appServicePaymentsRoutes);
app.use("/api/tournaments", tournamentsRoutes);
app.use("/api/clubs", clubsRoutes);
app.use("/api/news", newsRoutes);
app.use("/api/public", publicRoutes);
app.use("/api/inquiries", inquiriesRoutes);
app.use("/api/push", pushRoutes);
app.use("/api/open-play", openPlayRoutes);
app.use("/api/notifications", notificationsRoutes);
app.use("/api/admin-messages", adminMessagesRoutes);
app.use("/api/ledger", ledgerRoutes);
app.use("/api/reviews", reviewsRoutes);
app.use("/api/per-game", perGameRoutes);
app.use("/api/hosted-play", hostedPlayRoutes);
app.use("/api/config", configRoutes);
app.use("/api/club-ledger", clubLedgerRoutes);
app.use("/api/memberships", membershipsRoutes);

module.exports = app;
