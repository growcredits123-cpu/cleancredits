-- RUN THIS ENTIRE SCRIPT IN SUPABASE SQL EDITOR TO UPDATE THE SCHEMA FOR FRUITMAP
-- It is safe to run multiple times (uses IF NOT EXISTS / ON CONFLICT guards)

-- 1. Add new categories to item_category ENUM (safe if already exists)
ALTER TYPE item_category ADD VALUE IF NOT EXISTS 'fruit';
ALTER TYPE item_category ADD VALUE IF NOT EXISTS 'vegetable';
ALTER TYPE item_category ADD VALUE IF NOT EXISTS 'tree';
ALTER TYPE item_category ADD VALUE IF NOT EXISTS 'seed';

-- 2. Add additional photo and video URLs to items table
ALTER TABLE items ADD COLUMN IF NOT EXISTS photo_url_2 text;
ALTER TABLE items ADD COLUMN IF NOT EXISTS video_url text;
ALTER TABLE items ADD COLUMN IF NOT EXISTS is_appraised boolean DEFAULT false;
ALTER TABLE items ADD COLUMN IF NOT EXISTS appraised_value bigint;

-- 3. Add admin/verification fields to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS id_verified boolean DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS reviews_count integer DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS rating_avg numeric(3,2) DEFAULT 0;

-- 4. Create table for Land Ownership Proofs
CREATE TABLE IF NOT EXISTS land_ownership_proofs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  document_url text NOT NULL,
  status text NOT NULL DEFAULT 'pending', -- pending, approved, rejected
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE land_ownership_proofs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "land_proofs_select_all" ON land_ownership_proofs FOR SELECT TO authenticated USING (true);
CREATE POLICY "land_proofs_insert_own" ON land_ownership_proofs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- 5. Create table for ID Verification
CREATE TABLE IF NOT EXISTS id_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  id_photo_url text NOT NULL,
  status text NOT NULL DEFAULT 'pending', -- pending, approved, rejected
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE id_verifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "id_verifications_select_own" ON id_verifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "id_verifications_insert_own" ON id_verifications FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
-- Admin can see all
CREATE POLICY "id_verifications_admin_all" ON id_verifications FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = true)
);

-- 6. Create table for Access Requests (pick permission)
CREATE TABLE IF NOT EXISTS access_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  requester_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_amount integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending', -- pending, approved, rejected
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(item_id, requester_id)
);
ALTER TABLE access_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "access_req_select" ON access_requests FOR SELECT TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = owner_id);
CREATE POLICY "access_req_insert" ON access_requests FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = requester_id);
CREATE POLICY "access_req_update_owner" ON access_requests FOR UPDATE TO authenticated
  USING (auth.uid() = owner_id);

-- 7. Create reviews table
CREATE TABLE IF NOT EXISTS reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid REFERENCES items(id) ON DELETE CASCADE,
  reviewer_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reviewed_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(item_id, reviewer_id)
);
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reviews_select_all" ON reviews FOR SELECT TO authenticated USING (true);
CREATE POLICY "reviews_insert_own" ON reviews FOR INSERT TO authenticated WITH CHECK (auth.uid() = reviewer_id);

-- 8. Function: update user rating_avg and reviews_count automatically on new review
CREATE OR REPLACE FUNCTION update_user_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE users
  SET
    rating_avg = (SELECT AVG(rating) FROM reviews WHERE reviewed_user_id = NEW.reviewed_user_id),
    reviews_count = (SELECT COUNT(*) FROM reviews WHERE reviewed_user_id = NEW.reviewed_user_id)
  WHERE id = NEW.reviewed_user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_user_rating ON reviews;
CREATE TRIGGER trg_update_user_rating
  AFTER INSERT OR UPDATE ON reviews
  FOR EACH ROW EXECUTE FUNCTION update_user_rating();

-- 9. Storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('verification-docs', 'verification-docs', false) ON CONFLICT (id) DO NOTHING;
CREATE POLICY "verifications_insert_own" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'verification-docs');
CREATE POLICY "verifications_read_own" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'verification-docs' AND (auth.uid() = owner));

-- 10. App events table (for appraisal requests)
CREATE TABLE IF NOT EXISTS app_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  payload jsonb,
  resolved boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE app_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "app_events_insert_own" ON app_events FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "app_events_select_own" ON app_events FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "app_events_admin" ON app_events FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = true)
);
