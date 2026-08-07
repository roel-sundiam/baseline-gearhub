const AppSettings = require("../models/AppSettings");
const AppServicePayment = require("../models/AppServicePayment");

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// Effective monthly price for a club: per-club override wins over the global default.
async function getEffectiveEmailConfirmationsFee(club) {
  if (typeof club?.emailConfirmationsFeeOverride === "number") {
    return club.emailConfirmationsFeeOverride;
  }
  const settings = await AppSettings.findOneAndUpdate(
    { _id: "global" },
    {},
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).lean();
  return settings.emailConfirmationsMonthlyFee ?? 0;
}

// Lazily accrue the Email Confirmations add-on fee: one AppServicePayment billing doc
// per UTC calendar month from emailConfirmationsSubscribedAt through the current month,
// deduped by billingKey ("email_confirmations:YYYY-MM"). No cron — called from the
// subscribe endpoint and the same places that trigger Finance Report billing.
async function ensureEmailConfirmationsBilling(club, actorUserId) {
  if (!club?.emailConfirmationsEnabled || !club.emailConfirmationsSubscribedAt) return;

  const fee = await getEffectiveEmailConfirmationsFee(club);
  if (!(fee > 0)) return;

  const start = new Date(club.emailConfirmationsSubscribedAt);
  const now = new Date();
  let year = start.getUTCFullYear();
  let month = start.getUTCMonth();
  const endYear = now.getUTCFullYear();
  const endMonth = now.getUTCMonth();

  while (year < endYear || (year === endYear && month <= endMonth)) {
    const monthKey = `${year}-${String(month + 1).padStart(2, "0")}`;
    const billingKey = `email_confirmations:${monthKey}`;
    const exists = await AppServicePayment.exists({ clubId: club._id, type: "billing", billingKey });
    if (!exists) {
      try {
        await AppServicePayment.create({
          clubId: club._id,
          amount: parseFloat(fee.toFixed(2)),
          type: "billing",
          note: `Email Confirmations add-on — ${MONTH_NAMES[month]} ${year}`,
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

module.exports = { getEffectiveEmailConfirmationsFee, ensureEmailConfirmationsBilling };
