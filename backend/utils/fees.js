// Per-player fee breakdown: base fee + Hosted Play's own app convenience fee
// (independent of the club-wide convenienceFeeRate/convenienceFeeMode, which
// still governs Per Game/Reservations elsewhere).
// Queue management fee is billed to the club at session creation, not per player.
function computePlayerFees(club, feePerPlayer) {
  const baseFee = Math.max(0, Number(feePerPlayer) || 0);
  const feeMode = club?.hostedPlayConvenienceFeeMode ?? "per_join";
  if (feeMode === "per_session") {
    // Settled once at session completion (see settleHostedPlayConvenienceFee), not charged at join.
    return { baseFee, convenienceFee: 0, total: baseFee, feeMode };
  }
  const feeRate = typeof club?.hostedPlayConvenienceFeeRate === "number" ? club.hostedPlayConvenienceFeeRate : 0.05;
  const convenienceFee = parseFloat((baseFee * feeRate).toFixed(2));
  // club_absorbs: still computed for record-keeping, but excluded from what the player pays.
  const total = feeMode === "club_absorbs" ? baseFee : parseFloat((baseFee + convenienceFee).toFixed(2));
  return { baseFee, convenienceFee, total, feeMode };
}

module.exports = { computePlayerFees };
