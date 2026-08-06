-- =========================================================
-- COMPLETE SUPABASE SCHEMA & DATABASE SETUP FOR GROWCREDITS (ORGALDAM)
-- Run this entire script in the Supabase SQL Editor for new project: tsnwlvyaqiilvhoimhkp
-- =========================================================

-- Enable pgcrypto extension for UUID generation if not enabled
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =========================================================
-- 1. ENUMS
-- =========================================================

DO $$ BEGIN
    CREATE TYPE item_category AS ENUM ('clothing', 'books', 'electronics', 'home', 'toys', 'sports', 'other');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE item_condition AS ENUM ('new', 'like_new', 'good', 'fair');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE item_status AS ENUM ('available', 'reserved', 'sold', 'removed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE exchange_status AS ENUM ('requested', 'accepted', 'token_held', 'picked_up', 'completed', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE ledger_entry_kind AS ENUM (
      'signup_bonus',
      'item_listed_bonus',
      'escrow_hold',
      'escrow_release',
      'p2p_send',
      'p2p_receive',
      'recycling_reward',
      'manual_topup'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE recycling_material AS ENUM ('plastic', 'glass', 'paper', 'metal', 'electronics', 'textiles', 'other');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE recycling_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- =========================================================
-- 2. TABLES
-- =========================================================

-- users
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  avatar_url text,
  rating_avg numeric(3,2) NOT NULL DEFAULT 0,
  is_blocked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- items
CREATE TABLE IF NOT EXISTS items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  category item_category NOT NULL DEFAULT 'other',
  condition item_condition NOT NULL DEFAULT 'good',
  token_price integer NOT NULL CHECK (token_price >= 0),
  photo_url text,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  geohash text NOT NULL,
  status item_status NOT NULL DEFAULT 'available',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- exchanges
CREATE TABLE IF NOT EXISTS exchanges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  requester_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status exchange_status NOT NULL DEFAULT 'requested',
  requester_confirmed boolean NOT NULL DEFAULT false,
  owner_confirmed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- messages
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exchange_id uuid NOT NULL REFERENCES exchanges(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ratings
CREATE TABLE IF NOT EXISTS ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exchange_id uuid NOT NULL REFERENCES exchanges(id) ON DELETE CASCADE,
  score integer NOT NULL CHECK (score >= 1 AND score <= 5),
  comment text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ratings_unique_per_user_exchange UNIQUE (exchange_id, from_user)
);

-- ledger_entries
CREATE TABLE IF NOT EXISTS ledger_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exchange_id uuid REFERENCES exchanges(id) ON DELETE SET NULL,
  entry_type text NOT NULL CHECK (entry_type IN ('credit', 'debit')),
  amount integer NOT NULL CHECK (amount > 0),
  balance_after bigint NOT NULL,
  entry_kind ledger_entry_kind NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- recycling_spots
CREATE TABLE IF NOT EXISTS recycling_spots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  materials recycling_material[] NOT NULL DEFAULT '{}',
  photo_url text,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  geohash text NOT NULL,
  status recycling_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- app_events
CREATE TABLE IF NOT EXISTS app_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- =========================================================
-- 3. INDEXES
-- =========================================================

CREATE INDEX IF NOT EXISTS idx_items_geohash ON items(geohash);
CREATE INDEX IF NOT EXISTS idx_items_status ON items(status);
CREATE INDEX IF NOT EXISTS idx_items_owner ON items(owner_id);
CREATE INDEX IF NOT EXISTS idx_exchanges_requester ON exchanges(requester_id);
CREATE INDEX IF NOT EXISTS idx_exchanges_owner ON exchanges(owner_id);
CREATE INDEX IF NOT EXISTS idx_exchanges_status ON exchanges(status);
CREATE INDEX IF NOT EXISTS idx_messages_exchange ON messages(exchange_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ledger_user ON ledger_entries(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_recycling_geohash ON recycling_spots(geohash);

-- =========================================================
-- 4. ROW LEVEL SECURITY (RLS) POLICIES
-- =========================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE exchanges ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE recycling_spots ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_events ENABLE ROW LEVEL SECURITY;

-- users policies
DROP POLICY IF EXISTS "users_select_all" ON users;
CREATE POLICY "users_select_all" ON users FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "users_update_own" ON users;
CREATE POLICY "users_update_own" ON users FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "users_insert_own" ON users;
CREATE POLICY "users_insert_own" ON users FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- items policies
DROP POLICY IF EXISTS "items_select_all" ON items;
CREATE POLICY "items_select_all" ON items FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "items_insert_own" ON items;
CREATE POLICY "items_insert_own" ON items FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "items_update_own" ON items;
CREATE POLICY "items_update_own" ON items FOR UPDATE TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

-- exchanges policies
DROP POLICY IF EXISTS "exchanges_select_participant" ON exchanges;
CREATE POLICY "exchanges_select_participant" ON exchanges FOR SELECT TO authenticated USING (auth.uid() = requester_id OR auth.uid() = owner_id);

-- messages policies
DROP POLICY IF EXISTS "messages_select_participant" ON messages;
CREATE POLICY "messages_select_participant" ON messages FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM exchanges e
    WHERE e.id = exchange_id AND (e.requester_id = auth.uid() OR e.owner_id = auth.uid())
  )
);

DROP POLICY IF EXISTS "messages_insert_participant" ON messages;
CREATE POLICY "messages_insert_participant" ON messages FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = sender_id AND
  EXISTS (
    SELECT 1 FROM exchanges e
    WHERE e.id = exchange_id AND (e.requester_id = auth.uid() OR e.owner_id = auth.uid())
  )
);

-- ratings policies
DROP POLICY IF EXISTS "ratings_select_all" ON ratings;
CREATE POLICY "ratings_select_all" ON ratings FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "ratings_insert_own" ON ratings;
CREATE POLICY "ratings_insert_own" ON ratings FOR INSERT TO authenticated WITH CHECK (auth.uid() = from_user);

-- ledger_entries policies
DROP POLICY IF EXISTS "ledger_select_own" ON ledger_entries;
CREATE POLICY "ledger_select_own" ON ledger_entries FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- recycling_spots policies
DROP POLICY IF EXISTS "recycling_select_all" ON recycling_spots;
CREATE POLICY "recycling_select_all" ON recycling_spots FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "recycling_insert_own" ON recycling_spots;
CREATE POLICY "recycling_insert_own" ON recycling_spots FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- app_events policies
DROP POLICY IF EXISTS "app_events_insert_own" ON app_events;
CREATE POLICY "app_events_insert_own" ON app_events FOR INSERT TO authenticated WITH CHECK (user_id IS NULL OR user_id = auth.uid());

-- =========================================================
-- 5. STORAGE BUCKETS & STORAGE POLICIES
-- =========================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('item-photos', 'item-photos', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('recycling-photos', 'recycling-photos', true)
ON CONFLICT (id) DO NOTHING;

-- item-photos policies
DROP POLICY IF EXISTS "item_photos_read_all" ON storage.objects;
CREATE POLICY "item_photos_read_all" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'item-photos');

DROP POLICY IF EXISTS "item_photos_insert_own" ON storage.objects;
CREATE POLICY "item_photos_insert_own" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'item-photos');

DROP POLICY IF EXISTS "item_photos_delete_own" ON storage.objects;
CREATE POLICY "item_photos_delete_own" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'item-photos');

-- recycling-photos policies
DROP POLICY IF EXISTS "recycling_photos_read_all" ON storage.objects;
CREATE POLICY "recycling_photos_read_all" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'recycling-photos');

DROP POLICY IF EXISTS "recycling_photos_insert_own" ON storage.objects;
CREATE POLICY "recycling_photos_insert_own" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'recycling-photos');

DROP POLICY IF EXISTS "recycling_photos_delete_own" ON storage.objects;
CREATE POLICY "recycling_photos_delete_own" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'recycling-photos');

-- =========================================================
-- 6. FUNCTIONS & RPCs
-- =========================================================

-- Helper: append_ledger
CREATE OR REPLACE FUNCTION append_ledger(
  p_user_id uuid,
  p_exchange_id uuid,
  p_entry_type text,
  p_amount integer,
  p_entry_kind text,
  p_note text DEFAULT NULL,
  p_group_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance bigint;
BEGIN
  SELECT COALESCE(SUM(CASE WHEN entry_type = 'credit' THEN amount ELSE -amount END), 0)::bigint
  INTO v_balance
  FROM ledger_entries
  WHERE user_id = p_user_id;

  IF p_entry_type = 'credit' THEN
    v_balance := v_balance + p_amount;
  ELSE
    v_balance := v_balance - p_amount;
  END IF;

  INSERT INTO ledger_entries (user_id, exchange_id, entry_type, amount, balance_after, entry_kind, note, group_id)
  VALUES (p_user_id, p_exchange_id, p_entry_type, p_amount, v_balance, p_entry_kind::ledger_entry_kind, p_note, p_group_id);
END;
$$;

-- create_exchange_request
CREATE OR REPLACE FUNCTION create_exchange_request(p_item_id uuid, p_owner_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_exchange_id uuid;
  v_item_status text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF auth.uid() = p_owner_id THEN
    RAISE EXCEPTION 'Cannot request your own item';
  END IF;

  SELECT status INTO v_item_status FROM items WHERE id = p_item_id;
  IF v_item_status IS NULL THEN
    RAISE EXCEPTION 'Item not found';
  END IF;
  IF v_item_status != 'available' THEN
    RAISE EXCEPTION 'Item is not available';
  END IF;

  INSERT INTO exchanges (item_id, requester_id, owner_id, status)
  VALUES (p_item_id, auth.uid(), p_owner_id, 'requested')
  RETURNING id INTO v_exchange_id;

  UPDATE items SET status = 'reserved' WHERE id = p_item_id;

  RETURN v_exchange_id;
END;
$$;

-- accept_exchange_request
CREATE OR REPLACE FUNCTION accept_exchange_request(p_exchange_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rec uuid;
BEGIN
  SELECT requester_id INTO v_rec FROM exchanges WHERE id = p_exchange_id;
  IF v_rec IS NULL THEN RAISE EXCEPTION 'Exchange not found'; END IF;
  IF auth.uid() IS NULL OR auth.uid() != (SELECT owner_id FROM exchanges WHERE id = p_exchange_id) THEN
    RAISE EXCEPTION 'Only the owner can accept';
  END IF;
  IF (SELECT status FROM exchanges WHERE id = p_exchange_id) != 'requested' THEN
    RAISE EXCEPTION 'Exchange is not in requested state';
  END IF;

  UPDATE exchanges SET status = 'accepted' WHERE id = p_exchange_id;
END;
$$;

-- hold_tokens
CREATE OR REPLACE FUNCTION hold_tokens(p_exchange_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rec uuid;
  v_own uuid;
  v_item_id uuid;
  v_price integer;
  v_bal bigint;
BEGIN
  SELECT requester_id, owner_id, item_id INTO v_rec, v_own, v_item_id
  FROM exchanges WHERE id = p_exchange_id;
  IF v_rec IS NULL THEN RAISE EXCEPTION 'Exchange not found'; END IF;
  IF auth.uid() IS NULL OR auth.uid() != v_rec THEN
    RAISE EXCEPTION 'Only the requester can hold tokens';
  END IF;
  IF (SELECT status FROM exchanges WHERE id = p_exchange_id) != 'accepted' THEN
    RAISE EXCEPTION 'Exchange must be in accepted state';
  END IF;

  SELECT token_price INTO v_price FROM items WHERE id = v_item_id;
  SELECT COALESCE(SUM(CASE WHEN entry_type='credit' THEN amount ELSE -amount END),0)::bigint
  INTO v_bal FROM ledger_entries WHERE user_id = v_rec;
  IF v_bal < v_price THEN
    RAISE EXCEPTION 'Insufficient token balance (have %, need %)', v_bal, v_price;
  END IF;

  PERFORM append_ledger(v_rec, p_exchange_id, 'debit', v_price, 'escrow_hold', 'Tokens held for exchange');
  PERFORM append_ledger(v_own, p_exchange_id, 'credit', v_price, 'escrow_hold', 'Escrow credit for exchange');

  UPDATE exchanges SET status = 'token_held' WHERE id = p_exchange_id;
END;
$$;

-- confirm_pickup
CREATE OR REPLACE FUNCTION confirm_pickup(p_exchange_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rec uuid;
  v_own uuid;
  v_status text;
  v_rec_conf boolean;
  v_own_conf boolean;
BEGIN
  SELECT requester_id, owner_id, status, requester_confirmed, owner_confirmed
  INTO v_rec, v_own, v_status, v_rec_conf, v_own_conf
  FROM exchanges WHERE id = p_exchange_id;
  IF v_rec IS NULL THEN RAISE EXCEPTION 'Exchange not found'; END IF;
  IF auth.uid() IS NULL OR (auth.uid() != v_rec AND auth.uid() != v_own) THEN
    RAISE EXCEPTION 'Not a participant';
  END IF;
  IF v_status != 'token_held' THEN
    RAISE EXCEPTION 'Exchange must be in token_held state';
  END IF;

  IF auth.uid() = v_rec THEN
    UPDATE exchanges SET requester_confirmed = true WHERE id = p_exchange_id;
  ELSE
    UPDATE exchanges SET owner_confirmed = true WHERE id = p_exchange_id;
  END IF;

  SELECT requester_confirmed, owner_confirmed INTO v_rec_conf, v_own_conf
  FROM exchanges WHERE id = p_exchange_id;

  IF v_rec_conf AND v_own_conf THEN
    UPDATE exchanges SET status = 'picked_up' WHERE id = p_exchange_id;
  END IF;
END;
$$;

-- complete_exchange
CREATE OR REPLACE FUNCTION complete_exchange(p_exchange_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rec uuid;
  v_own uuid;
  v_item_id uuid;
BEGIN
  SELECT requester_id, owner_id, item_id INTO v_rec, v_own, v_item_id
  FROM exchanges WHERE id = p_exchange_id;
  IF v_rec IS NULL THEN RAISE EXCEPTION 'Exchange not found'; END IF;
  IF auth.uid() IS NULL OR (auth.uid() != v_rec AND auth.uid() != v_own) THEN
    RAISE EXCEPTION 'Not a participant';
  END IF;
  IF (SELECT status FROM exchanges WHERE id = p_exchange_id) != 'picked_up' THEN
    RAISE EXCEPTION 'Exchange must be in picked_up state';
  END IF;

  UPDATE exchanges SET status = 'completed' WHERE id = p_exchange_id;
  UPDATE items SET status = 'sold' WHERE id = v_item_id;
END;
$$;

-- cancel_exchange
CREATE OR REPLACE FUNCTION cancel_exchange(p_exchange_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rec uuid;
  v_own uuid;
  v_item_id uuid;
  v_status text;
  v_price integer;
BEGIN
  SELECT requester_id, owner_id, item_id, status INTO v_rec, v_own, v_item_id, v_status
  FROM exchanges WHERE id = p_exchange_id;
  IF v_rec IS NULL THEN RAISE EXCEPTION 'Exchange not found'; END IF;
  IF auth.uid() IS NULL OR (auth.uid() != v_rec AND auth.uid() != v_own) THEN
    RAISE EXCEPTION 'Not a participant';
  END IF;
  IF v_status NOT IN ('requested', 'accepted', 'token_held') THEN
    RAISE EXCEPTION 'Cannot cancel exchange in current state';
  END IF;

  IF v_status = 'token_held' THEN
    SELECT token_price INTO v_price FROM items WHERE id = v_item_id;
    PERFORM append_ledger(v_rec, p_exchange_id, 'credit', v_price, 'escrow_release', 'Escrow refunded on cancel');
    PERFORM append_ledger(v_own, p_exchange_id, 'debit', v_price, 'escrow_release', 'Escrow reversed on cancel');
  END IF;

  UPDATE exchanges SET status = 'cancelled' WHERE id = p_exchange_id;
  UPDATE items SET status = 'available' WHERE id = v_item_id AND status = 'reserved';
END;
$$;

-- p2p_transfer
CREATE OR REPLACE FUNCTION p2p_transfer(p_recipient_email text, p_amount integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sender uuid;
  v_recipient uuid;
  v_bal bigint;
  v_group_id uuid;
BEGIN
  v_sender := auth.uid();
  IF v_sender IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;

  SELECT id INTO v_recipient FROM users WHERE email = p_recipient_email;
  IF v_recipient IS NULL THEN RAISE EXCEPTION 'Recipient not found'; END IF;
  IF v_recipient = v_sender THEN RAISE EXCEPTION 'Cannot send to yourself'; END IF;

  SELECT COALESCE(SUM(CASE WHEN entry_type='credit' THEN amount ELSE -amount END),0)::bigint
  INTO v_bal FROM ledger_entries WHERE user_id = v_sender;
  IF v_bal < p_amount THEN RAISE EXCEPTION 'Insufficient balance (have %, need %)', v_bal, p_amount; END IF;

  v_group_id := gen_random_uuid();
  PERFORM append_ledger(v_sender, NULL, 'debit', p_amount, 'p2p_send', 'Sent to ' || p_recipient_email, v_group_id);
  PERFORM append_ledger(v_recipient, NULL, 'credit', p_amount, 'p2p_receive', 'Received from peer', v_group_id);

  RETURN true;
END;
$$;

-- admin_issue_tokens
CREATE OR REPLACE FUNCTION admin_issue_tokens(p_user_id uuid, p_amount integer, p_note text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;
  PERFORM append_ledger(p_user_id, NULL, 'credit', p_amount, 'manual_topup', COALESCE(p_note, 'Admin topup'));
END;
$$;

-- approve_recycling_spot & reject_recycling_spot
CREATE OR REPLACE FUNCTION approve_recycling_spot(p_spot_id uuid, p_reward integer DEFAULT 5)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid;
  v_status text;
BEGIN
  SELECT user_id, status INTO v_user, v_status FROM recycling_spots WHERE id = p_spot_id;
  IF v_user IS NULL THEN RAISE EXCEPTION 'Spot not found'; END IF;
  IF v_status != 'pending' THEN RAISE EXCEPTION 'Spot already processed'; END IF;

  UPDATE recycling_spots SET status = 'approved' WHERE id = p_spot_id;
  PERFORM append_ledger(v_user, NULL, 'credit', p_reward, 'recycling_reward', 'Recycling spot approved');
END;
$$;

CREATE OR REPLACE FUNCTION reject_recycling_spot(p_spot_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text;
BEGIN
  SELECT status INTO v_status FROM recycling_spots WHERE id = p_spot_id;
  IF v_status IS NULL THEN RAISE EXCEPTION 'Spot not found'; END IF;
  IF v_status != 'pending' THEN RAISE EXCEPTION 'Spot already processed'; END IF;
  UPDATE recycling_spots SET status = 'rejected' WHERE id = p_spot_id;
END;
$$;

-- Enable Realtime for messages, exchanges, items safely
DO $$ 
BEGIN
  -- We suppress errors if they are already in the publication
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE messages;
  EXCEPTION WHEN duplicate_object OR sqlstate '42710' THEN null;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE exchanges;
  EXCEPTION WHEN duplicate_object OR sqlstate '42710' THEN null;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE items;
  EXCEPTION WHEN duplicate_object OR sqlstate '42710' THEN null;
  END;
END $$;

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
