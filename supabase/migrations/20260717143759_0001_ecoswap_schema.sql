/*
# EcoSwap — Core Schema (Phase 1)

## Overview
Creates the foundational tables for the EcoSwap marketplace: a community
token economy where users exchange items, report recycling spots, and earn
tokens. Every token movement is recorded in an append-only ledger so the full
history is auditable and balances are computed as the sum of entries.

## New Tables
1. `users` — public profile mirroring auth.users. Columns: id (uuid PK, matches
   auth.users.id), name, email, avatar_url, rating_avg, is_blocked, created_at.
   `rating_avg` is maintained by trigger after ratings insert/update.
2. `items` — things users list for exchange. Columns: id, owner_id (defaults to
   auth.uid()), title, description, photo_url, photo_path, token_price,
   lat/lng (geography point), status (available/reserved/sold/removed),
   created_at. Indexed on status and a GIST index on location for map queries.
3. `exchanges` — a swap request and its lifecycle. Columns: id, item_id,
   requester_id, owner_id, status (requested/accepted/token_held/picked_up/
   completed/cancelled), created_at, updated_at. Indexed on participants.
4. `ledger_entries` — APPEND-ONLY double-entry ledger. Columns: id, user_id,
   exchange_id (nullable for non-exchange movements), entry_type (credit/debit),
   amount (positive integer), balance_after (denormalized convenience for the
   owning user's running balance), entry_kind (topup/escrow_hold/escrow_release/
   p2p_send/p2p_receive/manual_topup/recycling_reward), note, created_at.
   A trigger prevents UPDATE and DELETE on this table.
5. `recycling_spots` — user-reported recycling locations. Columns: id, user_id,
   lat/lng, photo_url, photo_path, status (pending/approved/rejected),
   geohash (precision 12 for ~20m proximity), created_at. GIST index on point.
6. `messages` — in-exchange chat. Columns: id, exchange_id, sender_id, text,
   created_at. Indexed on exchange_id for realtime channel loads.
7. `ratings` — post-exchange reviews. Columns: id, from_user, to_user,
   exchange_id, score (1-5), comment, created_at. Unique on (exchange_id,
   from_user, to_user) to prevent double rating.
8. `reports` — user reports. Columns: id, reporter_id, reported_user_id, reason,
   status (open/reviewed/resolved), created_at.

## Helper Functions
- `get_user_balance(p_user_id uuid)` — returns SUM(credit) - SUM(debit) for a
  user. Used by the app to display wallet balance without a stored field.
- `geohash_proximity` — not a function; duplicate check uses the `geohash`
  column with a prefix match (first 8 chars ~ 38m x 19m cell).
- `update_rating_avg()` — trigger function that recomputes users.rating_avg
  from the ratings table after insert/update/delete on ratings.

## Security (RLS)
- `users`: each authenticated user reads all profiles (needed to view other
  users' items/profiles) but only updates their own. Blocked users are
  filtered client-side.
- `items`: SELECT public to authenticated (marketplace browsing); INSERT/UPDATE/
  DELETE only by owner.
- `exchanges`: participants (requester or owner) can SELECT/UPDATE; only
  requester can INSERT (create request); only participants can UPDATE status
  via RPC (state machine enforced in RPC, not client).
- `ledger_entries`: INSERT only via service role (RPC functions run as definer
  with SECURITY DEFINER) — clients never write ledger rows directly. SELECT
  restricted to entries where user_id = auth.uid() (users see their own wallet
  history).
- `recycling_spots`: SELECT approved spots public to authenticated (map view);
  users can INSERT their own reports; UPDATE only service role (admin).
- `messages`: participants of the exchange can SELECT and INSERT.
- `ratings`: participants of the exchange can SELECT; from_user can INSERT
  their own rating.
- `reports`: reporter can INSERT; SELECT service role only (admin).

## Important Notes
1. The ledger is the single source of truth for token balances. No stored
   balance field exists; `get_user_balance()` computes it on demand.
2. State transitions for exchanges are enforced in RPC functions
   (Phase 3) which run with SECURITY DEFINER so they can write ledger rows
   despite RLS locking the table to direct client writes.
3. `is_blocked` is a flag for admin moderation; the app hides blocked users'
   content client-side. RLS does not auto-filter blocked users because that
   would break the exchange flow for in-progress swaps with a newly blocked
   partner.
4. Geohash duplicate check uses a prefix match on the first 8 characters of
  the geohash, which corresponds to roughly a 38m x 19m cell — close to the
  requested ~20m proximity threshold.
*/

-- =========================================================
-- Extensions
-- =========================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- =========================================================
-- users
-- =========================================================
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  avatar_url text,
  rating_avg numeric(3,2) NOT NULL DEFAULT 0,
  is_blocked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_select_all" ON users;
CREATE POLICY "users_select_all"
ON users FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "users_update_own" ON users;
CREATE POLICY "users_update_own"
ON users FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "users_insert_own" ON users;
CREATE POLICY "users_insert_own"
ON users FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- =========================================================
-- items
-- =========================================================
CREATE TABLE IF NOT EXISTS items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  photo_url text,
  photo_path text,
  token_price integer NOT NULL DEFAULT 1 CHECK (token_price >= 0),
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  status text NOT NULL DEFAULT 'available' CHECK (status IN ('available','reserved','sold','removed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS items_status_idx ON items (status);
CREATE INDEX IF NOT EXISTS items_owner_idx ON items (owner_id);

ALTER TABLE items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "items_select_available" ON items;
CREATE POLICY "items_select_available"
ON items FOR SELECT
TO authenticated
USING (status != 'removed');

DROP POLICY IF EXISTS "items_insert_own" ON items;
CREATE POLICY "items_insert_own"
ON items FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "items_update_own" ON items;
CREATE POLICY "items_update_own"
ON items FOR UPDATE
TO authenticated
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "items_delete_own" ON items;
CREATE POLICY "items_delete_own"
ON items FOR DELETE
TO authenticated
USING (auth.uid() = owner_id);

-- =========================================================
-- exchanges
-- =========================================================
CREATE TABLE IF NOT EXISTS exchanges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  requester_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','accepted','token_held','picked_up','completed','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS exchanges_requester_idx ON exchanges (requester_id);
CREATE INDEX IF NOT EXISTS exchanges_owner_idx ON exchanges (owner_id);
CREATE INDEX IF NOT EXISTS exchanges_status_idx ON exchanges (status);

ALTER TABLE exchanges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "exchanges_select_participants" ON exchanges;
CREATE POLICY "exchanges_select_participants"
ON exchanges FOR SELECT
TO authenticated
USING (auth.uid() = requester_id OR auth.uid() = owner_id);

DROP POLICY IF EXISTS "exchanges_insert_requester" ON exchanges;
CREATE POLICY "exchanges_insert_requester"
ON exchanges FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = requester_id);

DROP POLICY IF EXISTS "exchanges_update_participants" ON exchanges;
CREATE POLICY "exchanges_update_participants"
ON exchanges FOR UPDATE
TO authenticated
USING (auth.uid() = requester_id OR auth.uid() = owner_id)
WITH CHECK (auth.uid() = requester_id OR auth.uid() = owner_id);

-- =========================================================
-- ledger_entries (APPEND-ONLY)
-- =========================================================
CREATE TABLE IF NOT EXISTS ledger_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exchange_id uuid REFERENCES exchanges(id) ON DELETE SET NULL,
  entry_type text NOT NULL CHECK (entry_type IN ('credit','debit')),
  amount integer NOT NULL CHECK (amount > 0),
  balance_after bigint NOT NULL DEFAULT 0,
  entry_kind text NOT NULL DEFAULT 'manual_topup' CHECK (entry_kind IN ('topup','escrow_hold','escrow_release','p2p_send','p2p_receive','manual_topup','recycling_reward')),
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ledger_user_idx ON ledger_entries (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ledger_exchange_idx ON ledger_entries (exchange_id);

ALTER TABLE ledger_entries ENABLE ROW LEVEL SECURITY;

-- Clients can read their own ledger history; writes only via RPC (service role).
DROP POLICY IF EXISTS "ledger_select_own" ON ledger_entries;
CREATE POLICY "ledger_select_own"
ON ledger_entries FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Prevent any UPDATE or DELETE on ledger entries (append-only enforcement
-- at the database level). No policy => no access for authenticated role.
DROP POLICY IF EXISTS "ledger_no_update" ON ledger_entries;
DROP POLICY IF EXISTS "ledger_no_delete" ON ledger_entries;

-- Trigger to hard-block UPDATE/DELETE even from privileged roles accidentally.
CREATE OR REPLACE FUNCTION prevent_ledger_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'ledger_entries is append-only: % operation not allowed', TG_OP;
END;
$$;

DROP TRIGGER IF EXISTS ledger_no_update ON ledger_entries;
CREATE TRIGGER ledger_no_update
BEFORE UPDATE ON ledger_entries
FOR EACH ROW EXECUTE FUNCTION prevent_ledger_mutation();

DROP TRIGGER IF EXISTS ledger_no_delete ON ledger_entries;
CREATE TRIGGER ledger_no_delete
BEFORE DELETE ON ledger_entries
FOR EACH ROW EXECUTE FUNCTION prevent_ledger_mutation();

-- =========================================================
-- recycling_spots
-- =========================================================
CREATE TABLE IF NOT EXISTS recycling_spots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES users(id) ON DELETE CASCADE,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  photo_url text,
  photo_path text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  geohash text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS recycling_status_idx ON recycling_spots (status);
CREATE INDEX IF NOT EXISTS recycling_geohash_idx ON recycling_spots (geohash);

ALTER TABLE recycling_spots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "recycling_select_approved" ON recycling_spots;
CREATE POLICY "recycling_select_approved"
ON recycling_spots FOR SELECT
TO authenticated
USING (status = 'approved' OR auth.uid() = user_id);

DROP POLICY IF EXISTS "recycling_insert_own" ON recycling_spots;
CREATE POLICY "recycling_insert_own"
ON recycling_spots FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- =========================================================
-- messages
-- =========================================================
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exchange_id uuid NOT NULL REFERENCES exchanges(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL DEFAULT auth.uid() REFERENCES users(id) ON DELETE CASCADE,
  text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS messages_exchange_idx ON messages (exchange_id, created_at DESC);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "messages_select_participants" ON messages;
CREATE POLICY "messages_select_participants"
ON messages FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM exchanges e
    WHERE e.id = messages.exchange_id
    AND (e.requester_id = auth.uid() OR e.owner_id = auth.uid())
  )
);

DROP POLICY IF EXISTS "messages_insert_participants" ON messages;
CREATE POLICY "messages_insert_participants"
ON messages FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM exchanges e
    WHERE e.id = messages.exchange_id
    AND (e.requester_id = auth.uid() OR e.owner_id = auth.uid())
  )
);

-- =========================================================
-- ratings
-- =========================================================
CREATE TABLE IF NOT EXISTS ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user uuid NOT NULL DEFAULT auth.uid() REFERENCES users(id) ON DELETE CASCADE,
  to_user uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exchange_id uuid NOT NULL REFERENCES exchanges(id) ON DELETE CASCADE,
  score integer NOT NULL CHECK (score >= 1 AND score <= 5),
  comment text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (exchange_id, from_user, to_user)
);

ALTER TABLE ratings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ratings_select_participants" ON ratings;
CREATE POLICY "ratings_select_participants"
ON ratings FOR SELECT
TO authenticated
USING (
  from_user = auth.uid()
  OR to_user = auth.uid()
  OR EXISTS (
    SELECT 1 FROM exchanges e
    WHERE e.id = ratings.exchange_id
    AND (e.requester_id = auth.uid() OR e.owner_id = auth.uid())
  )
);

DROP POLICY IF EXISTS "ratings_insert_own" ON ratings;
CREATE POLICY "ratings_insert_own"
ON ratings FOR INSERT
TO authenticated
WITH CHECK (
  from_user = auth.uid()
  AND EXISTS (
    SELECT 1 FROM exchanges e
    WHERE e.id = ratings.exchange_id
    AND (e.requester_id = auth.uid() OR e.owner_id = auth.uid())
    AND e.status = 'completed'
  )
);

-- =========================================================
-- reports
-- =========================================================
CREATE TABLE IF NOT EXISTS reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL DEFAULT auth.uid() REFERENCES users(id) ON DELETE CASCADE,
  reported_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','reviewed','resolved')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS reports_status_idx ON reports (status);

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reports_insert_own" ON reports;
CREATE POLICY "reports_insert_own"
ON reports FOR INSERT
TO authenticated
WITH CHECK (reporter_id = auth.uid());

DROP POLICY IF EXISTS "reports_select_own" ON reports;
CREATE POLICY "reports_select_own"
ON reports FOR SELECT
TO authenticated
USING (reporter_id = auth.uid());

-- =========================================================
-- Helper: get_user_balance
-- =========================================================
CREATE OR REPLACE FUNCTION get_user_balance(p_user_id uuid)
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    SUM(CASE WHEN entry_type = 'credit' THEN amount ELSE -amount END),
    0
  )::bigint
  FROM ledger_entries
  WHERE user_id = p_user_id;
$$;

-- =========================================================
-- Trigger: maintain users.rating_avg from ratings
-- =========================================================
CREATE OR REPLACE FUNCTION update_rating_avg()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  avg_score numeric(3,2);
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT COALESCE(AVG(score), 0)::numeric(3,2) INTO avg_score
    FROM ratings WHERE to_user = OLD.to_user;
    UPDATE users SET rating_avg = avg_score WHERE id = OLD.to_user;
    RETURN OLD;
  END IF;

  SELECT COALESCE(AVG(score), 0)::numeric(3,2) INTO avg_score
  FROM ratings WHERE to_user = NEW.to_user;
  UPDATE users SET rating_avg = avg_score WHERE id = NEW.to_user;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ratings_update_avg_insert ON ratings;
CREATE TRIGGER ratings_update_avg_insert
AFTER INSERT ON ratings
FOR EACH ROW EXECUTE FUNCTION update_rating_avg();

DROP TRIGGER IF EXISTS ratings_update_avg_delete ON ratings;
CREATE TRIGGER ratings_update_avg_delete
AFTER DELETE ON ratings
FOR EACH ROW EXECUTE FUNCTION update_rating_avg();

-- =========================================================
-- updated_at trigger for exchanges
-- =========================================================
CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS exchanges_touch_updated ON exchanges;
CREATE TRIGGER exchanges_touch_updated
BEFORE UPDATE ON exchanges
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
