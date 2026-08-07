const mongoose = require("mongoose");

const DEFAULT_ADMIN_TERMS = `## 1. Acceptance of Terms
By accepting these Terms & Conditions, you ("Club Administrator") agree to be bound by this agreement with CourtGo ("Platform"). If you do not agree, you may not use the Platform.

## 2. Club Administrator Responsibilities
You are responsible for:
- Ensuring accurate club information, court availability, and pricing are maintained on the Platform
- Managing member registrations, approvals, and access within your club
- Complying with all applicable local laws regarding sports facility operation
- Keeping your account credentials secure and confidential

## 3. Reservations & Bookings
You agree to honor all reservations made through the Platform by members and guests. Cancellation policies you set must be applied fairly and consistently.

## 4. Convenience Fee
As a Club Administrator, you acknowledge that CourtGo charges a convenience fee for the use of the Platform and its services. This fee covers platform maintenance, booking management, and ongoing support. The applicable fee rate will be communicated to you separately and may be updated by CourtGo with reasonable notice. Continued use of the Platform after notice of a fee change constitutes acceptance of the updated fee.

## 5. Member Data
You will only use member information collected through the Platform for the purpose of managing club activities. You may not sell, share, or misuse member personal data.

## 6. Prohibited Conduct
You may not use the Platform to post false information, discriminate against members, or conduct any activity that violates applicable law.

## 7. Account Suspension
CourtGo reserves the right to suspend or terminate your club account for violation of these terms, fraudulent activity, or conduct harmful to members.

## 8. Limitation of Liability
CourtGo is not liable for disputes between club administrators and members, or for losses arising from your use of the Platform.

## 9. Changes to Terms
CourtGo may update these terms. Continued use of the Platform constitutes acceptance of updated terms.`;

const DEFAULT_GUEST_TERMS = `By proceeding with your booking, you confirm that you have read, understood, and agreed to follow the rules outlined below. Any violation may result in actions such as removal from the premises, penalties, or suspension of access, as determined by management.

## 1. Respect the Court
Please treat the court, equipment, and other players with courtesy and care at all times. Unsportsmanlike conduct will not be tolerated.

## 2. No Smoking 🚫
Smoking is strictly prohibited within the court premises.

## 3. Clean As You Go (CLAYGO) 🗑️
Dispose of all trash properly and help maintain cleanliness. Kindly leave the court in better condition than you found it.

## 4. Court Time ⏰
Please be ready to play at your scheduled time. Delays or late arrivals will still be counted within your reserved slot.

## 5. Proper Footwear 👟
Players are encouraged to wear non-marking sports shoes to ensure safety and protect the court surface.

## 6. Play with Respect & Enjoyment 🤝
Play responsibly, keep the competition friendly, and avoid unnecessary conflicts. Let's keep the atmosphere fun and welcoming for everyone.

## 7. Share the Court ❤️
Support fellow players, keep disagreements respectful, and remember that everyone is here to enjoy the game.

By continuing with your booking, you acknowledge and accept these terms. Management reserves the right to enforce rules and apply appropriate consequences for any violations.`;

const appSettingsSchema = new mongoose.Schema(
  {
    _id: { type: String, default: "global" },
    reviewFormUrl: { type: String, default: "", trim: true },
    adminTermsText: { type: String, default: DEFAULT_ADMIN_TERMS },
    guestTermsText: { type: String, default: DEFAULT_GUEST_TERMS },
    // Default monthly price of the Finance Report add-on (per-club override on Club).
    financeReportMonthlyFee: { type: Number, default: 199, min: 0 },
    // Default monthly price of the Email Confirmations add-on (per-club override on Club).
    emailConfirmationsMonthlyFee: { type: Number, default: 199, min: 0 },
    // One-time fee charged for each approved club member beyond memberFreeTierCount.
    memberActivationFee: { type: Number, default: 50, min: 0 },
    memberFreeTierCount: { type: Number, default: 50, min: 0 },
    termsVersion: { type: Number, default: 1 },
    termsUpdatedAt: { type: Date, default: null },
    termsUpdatedBy: { type: String, default: "" },
    announcementEnabled: { type: Boolean, default: false },
    announcementTitle: { type: String, default: "", trim: true },
    announcementText: { type: String, default: "" },
    announcementVersion: { type: Number, default: 0 },
    announcementUpdatedAt: { type: Date, default: null },
    announcementUpdatedBy: { type: String, default: "" },
  },
  { timestamps: true },
);

module.exports = mongoose.model("AppSettings", appSettingsSchema);
