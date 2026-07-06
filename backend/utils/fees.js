// Per-player fee breakdown: base fee + convenience fee.
// Queue management fee is billed to the club at session creation, not per player.
function computePlayerFees(club, feePerPlayer) {
  const baseFee = Math.max(0, Number(feePerPlayer) || 0);
  const feeRate = typeof club?.convenienceFeeRate === "number" ? club.convenienceFeeRate : 0.10;
  const feeMode = club?.convenienceFeeMode ?? "per_hour";
  // Always calculate the fee for display/record-keeping; monthly_flat = 0
  const convenienceFee = feeMode === "monthly_flat" ? 0 : parseFloat((baseFee * feeRate).toFixed(2));
  // club_absorbs: player total excludes the fee (club pays it)
  const total = feeMode === "club_absorbs"
    ? parseFloat(baseFee.toFixed(2))
    : parseFloat((baseFee + convenienceFee).toFixed(2));
  return { baseFee, convenienceFee, total, feeMode };
}

module.exports = { computePlayerFees };
