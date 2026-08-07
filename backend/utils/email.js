async function sendEmail({ to, subject, html }) {
  if (!process.env.RESEND_API_KEY || !to) return;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL || "bookings@courtgo.club",
        to,
        subject,
        html,
      }),
    });
    if (!res.ok) {
      console.error("sendEmail error:", res.status, await res.text());
    }
  } catch (err) {
    console.error("sendEmail error:", err.message);
  }
}

function formatCurrency(amount) {
  return `₱${Number(amount ?? 0).toFixed(2)}`;
}

async function sendReservationConfirmationEmail(reservation, charge, { clubName, recipients }) {
  const to = [...new Set((recipients ?? []).filter(Boolean))];
  if (to.length === 0) return;

  const dateLabel = new Date(reservation.date).toLocaleDateString("en-PH", {
    weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC",
  });
  const durationLabel = reservation.durationHours > 1 ? `${reservation.durationHours} hours` : "1 hour";
  const isPending = reservation.status === "pending_payment";
  const heading = isPending ? "Booking Received" : "Booking Confirmed";
  const intro = isPending
    ? "We've received your court reservation request. It's awaiting payment confirmation from the club — here are the details:"
    : "Your court reservation is confirmed. Here are the details:";

  const breakdownRows = [
    ["Court fee", charge.breakdown.withoutLightFee],
    charge.breakdown.lightFee > 0 && ["Lights", charge.breakdown.lightFee],
    charge.breakdown.ballBoyFee > 0 && ["Ball boy", charge.breakdown.ballBoyFee],
    charge.breakdown.guestFee > 0 && ["Guest fee", charge.breakdown.guestFee],
    charge.breakdown.rentalFee > 0 && ["Rentals", charge.breakdown.rentalFee],
    charge.breakdown.coachingFee > 0 && ["Coaching", charge.breakdown.coachingFee],
    ...charge.breakdown.extraFees.map((f) => [f.name, f.amount]),
    charge.breakdown.convenienceFee > 0 && ["Convenience fee", charge.breakdown.convenienceFee],
  ]
    .filter(Boolean)
    .map(([label, amount]) => `<tr><td style="padding:4px 0;">${label}</td><td style="padding:4px 0;text-align:right;">${formatCurrency(amount)}</td></tr>`)
    .join("");

  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;">
      <h2>${heading}${clubName ? ` — ${clubName}` : ""}</h2>
      <p>${intro}</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;">
        <tr><td style="padding:4px 0;">Court</td><td style="padding:4px 0;text-align:right;">${reservation.court}</td></tr>
        <tr><td style="padding:4px 0;">Date</td><td style="padding:4px 0;text-align:right;">${dateLabel}</td></tr>
        <tr><td style="padding:4px 0;">Time</td><td style="padding:4px 0;text-align:right;">${reservation.timeSlot} (${durationLabel})</td></tr>
      </table>
      <table style="width:100%;border-collapse:collapse;border-top:1px solid #ddd;padding-top:8px;">
        ${breakdownRows}
        <tr style="border-top:1px solid #ddd;font-weight:bold;">
          <td style="padding:8px 0 0;">Total</td>
          <td style="padding:8px 0 0;text-align:right;">${formatCurrency(charge.amount)}</td>
        </tr>
      </table>
    </div>
  `;

  await Promise.all(
    to.map((email) =>
      sendEmail({ to: email, subject: `${heading} — Court ${reservation.court} on ${dateLabel}`, html }),
    ),
  );
}

module.exports = { sendEmail, sendReservationConfirmationEmail };
