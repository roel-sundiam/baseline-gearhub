const AppSettings = require("../models/AppSettings");
const AppServicePayment = require("../models/AppServicePayment");

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// Effective monthly price for a club: per-club override wins over the global default.
async function getEffectiveAdvancedAnalyticsFee(club) {
  if (typeof club?.advancedAnalyticsFeeOverride === "number") {
    return club.advancedAnalyticsFeeOverride;
  }
  const settings = await AppSettings.findOneAndUpdate(
    { _id: "global" },
    {},
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).lean();
  return settings.advancedAnalyticsMonthlyFee ?? 0;
}

// Lazily accrue the Advanced Analytics add-on fee: one AppServicePayment billing doc
// per UTC calendar month from advancedAnalyticsSubscribedAt through the current month,
// deduped by billingKey ("advanced_analytics:YYYY-MM"). No cron — called from the
// subscribe endpoint, fee-info/summary, and the analytics endpoints.
async function ensureAdvancedAnalyticsBilling(club, actorUserId) {
  if (!club?.advancedAnalyticsEnabled || !club.advancedAnalyticsSubscribedAt) return;

  const fee = await getEffectiveAdvancedAnalyticsFee(club);
  if (!(fee > 0)) return;

  const start = new Date(club.advancedAnalyticsSubscribedAt);
  const now = new Date();
  let year = start.getUTCFullYear();
  let month = start.getUTCMonth();
  const endYear = now.getUTCFullYear();
  const endMonth = now.getUTCMonth();

  while (year < endYear || (year === endYear && month <= endMonth)) {
    const monthKey = `${year}-${String(month + 1).padStart(2, "0")}`;
    const billingKey = `advanced_analytics:${monthKey}`;
    const exists = await AppServicePayment.exists({ clubId: club._id, type: "billing", billingKey });
    if (!exists) {
      try {
        await AppServicePayment.create({
          clubId: club._id,
          amount: parseFloat(fee.toFixed(2)),
          type: "billing",
          note: `Advanced Analytics add-on — ${MONTH_NAMES[month]} ${year}`,
          billingKey,
          paidBy: actorUserId,
        });
      } catch (err) {
        // Concurrent accrual can race; the partial unique index makes it safe.
        if (err?.code !== 11000) throw err;
      }
    }
    month += 1;
    if (month > 11) { month = 0; year += 1; }
  }
}

module.exports = { getEffectiveAdvancedAnalyticsFee, ensureAdvancedAnalyticsBilling };
