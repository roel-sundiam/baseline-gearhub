const mongoose = require("mongoose");

const clubSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, sparse: true, unique: true },
    location: { type: String, trim: true },
    mobile: { type: String, trim: true },
    email: { type: String, trim: true },
    logo: { type: String, default: null },
    status: { type: String, enum: ['active', 'suspended'], default: 'active' },
    courtCount: { type: Number, default: 2, min: 1, max: 20 },
    courts: [{
      name: { type: String, required: true, trim: true },
      address: { type: String, trim: true },
      logo: { type: String },
    }],
    openingHour: { type: Number, default: 5, min: 0, max: 23 },
    closingHour: { type: Number, default: 22, min: 0, max: 23 },
    paymentMethods: { type: [String], default: [] },
    paymentAccounts: { type: Map, of: String, default: {} },
    paymentQrCodes: { type: Map, of: String, default: {} },
    convenienceFeeRate: { type: Number, default: 0.05, min: 0, max: 1 },
    convenienceFeeMode: { type: String, enum: ['per_transaction', 'per_hour', 'monthly_flat', 'club_absorbs'], default: 'per_hour' },
    convenienceFeeMonthlyAmount: { type: Number, default: 0, min: 0 },
    bookingProcess: { type: String, enum: ['reservation', 'per_game', 'hosted_play'], default: 'reservation' },
    hostedPlayEnabled: { type: Boolean, default: false },
    hostedPlayQueueEnabled: { type: Boolean, default: false },
    // Whether Hosted Play join payments/cancellation refunds can use the app credit
    // ledger for this club. Defaults true to preserve existing behavior.
    hostedPlayCreditsEnabled: { type: Boolean, default: true },
    queueManagementFeePerPlayer: { type: Number, default: 0, min: 0 },
    // When a Hosted Play session is full, let players join a waitlist and get
    // auto-promoted (free) / offered the spot to claim (paid) when one frees up.
    hostedPlayWaitlistEnabled: { type: Boolean, default: true },
    // Billing model for new Hosted Play sessions: per_player charges each joiner
    // a flat feePerPlayer at join time; split_total divides a session's total fee
    // among however many members are still joined when the session is completed.
    hostedPlayFeeSplitMode: { type: String, enum: ['per_player', 'split_total'], default: 'per_player' },
    // App convenience fee for Hosted Play specifically, independent of the club-wide
    // convenienceFeeRate/convenienceFeeMode above. per_join charges each joiner a
    // rate-based fee at join time; per_session is a flat amount split evenly among
    // member participants and billed once the session is completed.
    hostedPlayConvenienceFeeMode: { type: String, enum: ['per_join', 'per_session', 'club_absorbs'], default: 'per_join' },
    hostedPlayConvenienceFeeRate: { type: Number, default: 0.05, min: 0, max: 1 },
    hostedPlayConvenienceFeeAmount: { type: Number, default: 0, min: 0 },
    // Finance Report premium add-on: club admin self-subscribes; the monthly fee
    // accrues as AppServicePayment billing entries while enabled. subscribedAt is
    // kept on cancel (for display); ledger data is always preserved.
    financeReportEnabled: { type: Boolean, default: false },
    financeReportSubscribedAt: { type: Date, default: null },
    financeReportFeeOverride: { type: Number, default: null, min: 0 }, // null => global default

    // This club's own DUPR Club ID, entered manually by a superadmin. Reserved
    // for a future phase once a real DUPR API partnership/credentials exist -
    // not validated against DUPR today.
    duprClubId: { type: String, trim: true, default: null },
    additionalFees: [{
      name: { type: String, required: true },
      amount: { type: Number, required: true, min: 0 },
      type: { type: String, enum: ['fixed', 'per_person'], default: 'fixed' },
      isEnabled: { type: Boolean, default: true },
      isOptional: { type: Boolean, default: true },
    }],
    requirePaymentScreenshot: { type: Boolean, default: false },
    balanceAlertEnabled: { type: Boolean, default: false },
    description: { type: String, trim: true },
    guestTermsText: { type: String, default: null },
    guestTermsNotification: { type: String, default: null },
    bookingQrCode: { type: String, default: null },
    photos: { type: [String], default: [] },
    socialLinks: {
      facebook:  { type: String, trim: true },
      instagram: { type: String, trim: true },
      reclub:    { type: String, trim: true },
    },
    rating:       { type: Number, default: 0, min: 0, max: 5 },
    reviewCount:  { type: Number, default: 0, min: 0 },
    totalBookings:{ type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Club", clubSchema);
