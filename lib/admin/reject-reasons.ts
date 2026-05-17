// Shared rejection-reason presets for the admin moderation queues
// (place-requests now; ownership-claims + flagged-reviews to follow — #167).
// The chosen string is persisted verbatim to the row's `rejection_reason`
// and eventually surfaced to the submitter when decision emails ship (#22).
export const REJECT_REASON_PRESETS = [
  'Duplicate of existing place',
  'Insufficient info',
  'Spam / not a real place',
  'Inappropriate content',
] as const;

export type RejectReasonPreset = (typeof REJECT_REASON_PRESETS)[number];
