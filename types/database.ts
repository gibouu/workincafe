/**
 * Hand-rolled type stub matching supabase/migrations/001_init.sql + 002_views.sql.
 * Regenerate with `npx supabase gen types typescript --linked > types/database.ts`
 * once the Supabase project is linked.
 */

export type PlaceCategoryDb =
  | 'cafe'
  | 'bakery'
  | 'library'
  | 'coworking'
  | 'hotel'
  | 'restaurant'
  | 'fast_food'
  | 'fast_food_burger'
  | 'other';

export type NoiseLevel = 'quiet' | 'moderate' | 'loud';
export type SeatingAvailability = 'plenty' | 'some' | 'full';
export type TemperatureLevel = 'cold' | 'comfortable' | 'warm' | 'hot';
export type OutletsLevel = 'many' | 'some' | 'none';
export type PlaceSource = 'apple' | 'google' | 'osm' | 'curated' | 'foursquare' | 'user_submitted';
export type RequestStatus = 'pending' | 'approved' | 'rejected';
export type FlagReason = 'spam' | 'offensive' | 'untrue' | 'irrelevant' | 'other';

export type Json = string | number | boolean | null | { [k: string]: Json } | Json[];

type Table<Row, Insert = Partial<Row>, Update = Partial<Row>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

type View<Row> = {
  Row: Row;
  Relationships: [];
};

type UserRow = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  trust_score: number;
  home_city: string | null;
  is_admin: boolean;
  is_banned: boolean;
  is_demo: boolean;
  created_at: string;
  updated_at: string;
};

type PlaceRow = {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  country: string | null;
  neighborhood: string | null;
  lat: number;
  lng: number;
  category: PlaceCategoryDb;
  brand: string | null;
  phone: string | null;
  website: string | null;
  hours_json: Json | null;
  osm_tags: Json | null;
  featured: boolean;
  normalized_name_hash: string | null;
  is_demo: boolean;
  created_at: string;
  updated_at: string;
};

type PlaceSourceRefRow = {
  id: string;
  place_id: string | null;
  normalized_name_hash: string | null;
  source: PlaceSource;
  external_id: string;
  is_demo: boolean;
  synced_at: string;
};

type PlaceRequestRow = {
  id: string;
  submitted_by: string;
  name: string;
  lat: number;
  lng: number;
  address: string | null;
  category_suggestion: PlaceCategoryDb | null;
  notes: string | null;
  status: RequestStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  is_demo: boolean;
  created_at: string;
};

type ReviewRow = {
  id: string;
  place_id: string;
  user_id: string;
  // 1–10 site-wide. Pre-2026 rows live in the lower half (1–5) of the new range.
  overall_rating: number | null;
  overall_suggested: number | null;
  overall_user_set: boolean | null;
  wifi_rating: number | null;
  noise_rating: number | null;
  seating_rating: number | null;
  comfort_rating: number | null;
  outlets_rating: number | null;
  price_rating: number | null;
  atmosphere_rating: number | null;
  food_rating: number | null;
  food_value_rating: number | null;
  temperature_rating: number | null;
  temperature_feel: number | null;
  current_busyness: number | null;
  drink_price_range: string | null;
  food_price_range: string | null;
  ate_food: boolean | null;
  environment_facts: string[] | null;
  work_facts: string[] | null;
  place_type: string | null;
  current_seating: string | null;
  outside_temp_c: number | null;
  outside_condition: string | null;
  comment: string | null;
  geo_verified: boolean;
  verified_lat: number | null;
  verified_lng: number | null;
  hour_of_day: number | null;
  day_of_week: number | null;
  upvotes_count: number;
  is_hidden: boolean;
  is_demo: boolean;
  created_at: string;
  updated_at: string;
};

type ReviewPhotoRow = {
  id: string;
  review_id: string;
  slot: 'menu' | 'inside' | 'outside' | 'special' | 'coffee';
  path: string;
  cloudinary_public_id: string | null;
  cloudinary_version: string | null;
  width: number | null;
  height: number | null;
  bytes: number | null;
  is_demo: boolean;
  created_at: string;
};

type PlaceClaimRow = {
  id: string;
  place_id: string;
  claimant_user_id: string;
  claimant_email: string;
  claimant_name: string | null;
  proof_type: 'storefront_photo' | 'business_doc' | 'website_email' | 'other';
  proof_path: string | null;
  proof_notes: string | null;
  status: RequestStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  is_demo: boolean;
  created_at: string;
};

type PlaceOwnerRow = {
  id: string;
  place_id: string;
  user_id: string;
  granted_at: string;
  revoked_at: string | null;
  granted_by: string | null;
  is_demo: boolean;
};

type DealRow = {
  id: string;
  place_id: string;
  created_by: string;
  title: string;
  description: string | null;
  kind: 'single_use' | 'pack';
  pack_size: number;
  price_cents: number;
  currency: string;
  starts_at: string;
  ends_at: string | null;
  purchase_limit_per_user: number | null;
  active: boolean;
  is_demo: boolean;
  created_at: string;
  updated_at: string;
};

type DealPurchaseRow = {
  id: string;
  deal_id: string | null;
  place_id: string;
  user_id: string;
  qr_code: string;
  uses_total: number;
  uses_remaining: number;
  amount_paid_cents: number;
  currency: string;
  payment_method: string;
  payment_intent_id: string | null;
  payment_status: 'pending' | 'paid' | 'refunded' | 'failed' | 'disputed';
  refunded_at: string | null;
  refund_amount_cents: number | null;
  application_fee_cents: number | null;
  is_demo: boolean;
  purchased_at: string;
  expires_at: string | null;
};

type StripeAccountRow = {
  user_id: string;
  stripe_account_id: string;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  details_submitted: boolean;
  country: string | null;
  default_currency: string | null;
  created_at: string;
  updated_at: string;
};

type StripeEventRow = {
  event_id: string;
  event_type: string;
  livemode: boolean;
  payload_summary: Json | null;
  processed_at: string;
  error: string | null;
};

type DealUseRow = {
  id: string;
  purchase_id: string;
  scanned_by: string;
  scanned_at: string;
  notes: string | null;
  is_demo: boolean;
};

type PointEventRow = {
  id: string;
  user_id: string;
  kind: 'earned_use' | 'spent_freebie' | 'adjusted' | 'expired';
  delta: number;
  related_use_id: string | null;
  related_purchase_id: string | null;
  related_place_id: string | null;
  related_deal_id: string | null;
  notes: string | null;
  is_demo: boolean;
  created_at: string;
};

type FriendProfileRow = {
  user_id: string;
  occupation: string | null;
  work_style: 'quiet_focus' | 'brainstormer' | 'idea_bouncer' | 'company_only' | null;
  looking_for: string[];
  industry: string[];
  gender: 'woman' | 'man' | 'non_binary' | 'prefer_not_to_say' | null;
  open_to: string[];
  bio: string | null;
  active: boolean;
  is_demo: boolean;
  created_at: string;
  updated_at: string;
};

type CheckinRow = {
  id: string;
  place_id: string;
  user_id: string;
  lat: number;
  lng: number;
  verified: boolean;
  studying_until: string | null;
  hour_of_day: number | null;
  day_of_week: number | null;
  is_demo: boolean;
  created_at: string;
};

type WifiTestRow = {
  id: string;
  place_id: string;
  user_id: string;
  download_mbps: number | null;
  upload_mbps: number | null;
  ping_ms: number | null;
  connection_type: string | null;
  geo_verified: boolean;
  is_demo: boolean;
  created_at: string;
};

type DecibelSampleRow = {
  id: string;
  place_id: string;
  user_id: string;
  avg_db: number | null;
  peak_db: number | null;
  duration_seconds: number | null;
  device_model: string | null;
  hour_of_day: number | null;
  day_of_week: number | null;
  is_demo: boolean;
  created_at: string;
};

type FavoriteRow = {
  user_id: string;
  place_id: string;
  is_demo: boolean;
  created_at: string;
};

type LiveUpdateRow = {
  id: string;
  place_id: string;
  user_id: string;
  noise_level: NoiseLevel | null;
  seating_availability: SeatingAvailability | null;
  temperature: TemperatureLevel | null;
  outlets: OutletsLevel | null;
  rotating_question: string | null;
  rotating_answer: string | null;
  hour_of_day: number | null;
  day_of_week: number | null;
  is_demo: boolean;
  created_at: string;
};

type FlaggedReviewRow = {
  id: string;
  review_id: string;
  reporter_id: string;
  reason: FlagReason;
  notes: string | null;
  status: RequestStatus;
  resolved_by: string | null;
  resolved_at: string | null;
  resolution: string | null;
  is_demo: boolean;
  created_at: string;
};

type AppleFillLogRow = {
  id: string;
  user_id: string;
  tile_hash: string;
  created_at: string;
};

type WaitlistPartnersRow = { id: string; email: string; created_at: string };
type WaitlistBusinessRow = {
  id: string;
  email: string;
  place_id: string | null;
  created_at: string;
};

type MvPlaceRatingsRow = {
  place_id: string;
  study_spot_rating: number | null;
  rating_count: number;
  confidence: number;
  wifi_mean: number | null;
  noise_mean: number | null;
  seating_mean: number | null;
  outlets_mean: number | null;
  price_mean: number | null;
  atmosphere_mean: number | null;
  temperature_mean: number | null;
  food_mean: number | null;
};

type MvNoiseHeatmapRow = {
  place_id: string;
  day_of_week: number;
  hour_of_day: number;
  noise_score: number | null;
  sample_count: number;
};

type MvCurrentLiveStatusRow = {
  place_id: string;
  current_noise: NoiseLevel | null;
  current_seating: SeatingAvailability | null;
  current_temp: TemperatureLevel | null;
  last_updated_at: string;
};

export interface Database {
  public: {
    Tables: {
      users: Table<UserRow>;
      places: Table<PlaceRow>;
      place_source_refs: Table<PlaceSourceRefRow>;
      place_requests: Table<PlaceRequestRow>;
      reviews: Table<ReviewRow>;
      review_photos: Table<ReviewPhotoRow>;
      place_claims: Table<PlaceClaimRow>;
      place_owners: Table<PlaceOwnerRow>;
      deals: Table<DealRow>;
      deal_purchases: Table<DealPurchaseRow>;
      deal_uses: Table<DealUseRow>;
      point_events: Table<PointEventRow>;
      friend_profiles: Table<FriendProfileRow>;
      stripe_accounts: Table<StripeAccountRow>;
      stripe_events: Table<StripeEventRow>;
      checkins: Table<CheckinRow>;
      wifi_tests: Table<WifiTestRow>;
      decibel_samples: Table<DecibelSampleRow>;
      favorites: Table<FavoriteRow, FavoriteRow, Partial<FavoriteRow>>;
      live_updates: Table<LiveUpdateRow>;
      flagged_reviews: Table<FlaggedReviewRow>;
      apple_fill_log: Table<AppleFillLogRow>;
      waitlist_partners: Table<WaitlistPartnersRow>;
      waitlist_business: Table<WaitlistBusinessRow>;
    };
    Views: {
      mv_place_ratings: View<MvPlaceRatingsRow>;
      mv_noise_heatmap: View<MvNoiseHeatmapRow>;
      mv_current_live_status: View<MvCurrentLiveStatusRow>;
    };
    Functions: Record<string, never>;
    Enums: {
      place_category: PlaceCategoryDb;
      noise_level: NoiseLevel;
      seating_availability: SeatingAvailability;
      temperature_level: TemperatureLevel;
      place_source: PlaceSource;
      request_status: RequestStatus;
      flag_reason: FlagReason;
    };
    CompositeTypes: Record<string, never>;
  };
}
