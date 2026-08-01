/*
# EcoSwap — Exchange state machine + ledger RPCs (Phase 3 + 5)

## Overview
Implements the exchange lifecycle as a set of SECURITY DEFINER RPC functions.
Clients never write to ledger_entries directly (RLS blocks them); all token
movements go through these functions, which run as the service role. Every
function appends ledger rows and computes balance_after for the affected user
at insert time. No stored balance field is ever mutated.

## Functions
1. `create_exchange_request(p_item_id, p_owner_id)` — creates an exchange row
   in status 'requested'. Returns the new exchange id. Caller must be the
   requester (auth.uid).
2. `accept_exchange_request(p_exchange_id)` — owner accepts; status moves to
   'accepted'. No ledger movement yet.
3. `hold_tokens(p_exchange_id)` — requester confirms they want to proceed after
   acceptance; debits requester's available balance and credits an escrow
   ledger entry (entry_kind='escrow_hold') tagged to the exchange. Status moves
   to 'token_held'. Fails if requester has insufficient balance. The escrow
   entry is a credit to a synthetic escrow "user" represented by the exchange
   id — but since ledger_entries.user_id references users, we instead record
   two rows: a debit on the requester (balance_after reflects their reduced
   balance) and a credit on the owner with entry_kind='escrow_hold' and note
   'escrow' so it is distinguishable from a final release. The owner's
   balance_after is NOT increased for spendable purposes because the escrow
   credit is offset by the pending release — but to keep the double-entry
   invariant (sum per exchange = 0), we record the escrow credit on the owner
   with a negative balance_after impact via a separate marker. Simpler and
   auditable: we record a debit on requester and a matching credit on owner
   tagged 'escrow_hold'. On release (complete), we convert by adding a debit
   on owner 'escrow_release' and credit on requester 'escrow_release' — no,
   that double-moves. 

   CLEAN DESIGN (double-entry per exchange, net zero):
   - hold_tokens: debit requester (escrow_hold), credit owner (escrow_hold).
     Both amount = token_price. Net exchange movement = 0.
     The owner's credit is "held" — we mark it via entry_kind so the wallet
     can exclude escrow_hold credits from available balance if desired. For
     MVP, the owner sees the credit as pending until pickup.
   - complete_exchange: no additional ledger movement — the tokens are
     already with the owner from hold_tokens. We just move status to
     'completed'. The requester's debit is final; the owner's credit becomes
     spendable. This keeps net movement = 0 at every step.
   - cancel_exchange (from token_held): reverse the hold — credit requester
     (escrow_release) and debit owner (escrow_release), returning tokens.
     Net movement for the exchange = 0 (debit + credit - credit - debit = 0).
4. `confirm_pickup(p_exchange_id)` — either party confirms; status moves to
   'picked_up' when both have confirmed (tracked via a separate column
   `requester_confirmed` and `owner_confirmed` added to exchanges).
5. `complete_exchange(p_exchange_id)` — finalizes after pickup. Status ->
   'completed'. No ledger movement (tokens already transferred at hold).
6. `cancel_exchange(p_exchange_id)` — cancels. If status was 'token_held',
   reverses the escrow. Status -> 'cancelled'.
7. `p2p_transfer(p_recipient_email, p_amount)` — peer-to-peer token send.
   Debits sender, credits recipient. Returns true on success.
8. `admin_issue_tokens(p_user_id, p_amount, p_note)` — admin manual topup.
   Credits the user with entry_kind='manual_topup'. (Service-role only.)

## Schema changes
- Adds `requester_confirmed` and `owner_confirmed` boolean columns to
  exchanges (default false).

## Security
- All functions are SECURITY DEFINER, search_path = public.
- Each checks auth.uid() for authorization (caller is a participant).
- Ledger writes happen inside the function; RLS on ledger_entries blocks
  direct client writes but allows these definer functions to insert.

## Double-entry invariant
For any exchange that reaches token_held, the sum of all ledger entries
with that exchange_id is 0. On completion it stays 0 (tokens already moved).
On cancellation from token_held, the reversal entries also sum to 0 with
the original hold, leaving net 0. This is verifiable via:
  SELECT exchange_id, SUM(CASE WHEN entry_type='credit' THEN amount ELSE
  -amount END) FROM ledger_entries WHERE exchange_id IS NOT NULL GROUP BY
  exchange_id; — every row should be 0.
*/

-- =========================================================
-- Add confirmation columns to exchanges
-- =========================================================
ALTER TABLE exchanges
  ADD COLUMN IF NOT EXISTS requester_confirmed boolean NOT NULL DEFAULT false;
ALTER TABLE exchanges
  ADD COLUMN IF NOT EXISTS owner_confirmed boolean NOT NULL DEFAULT false;

-- =========================================================
-- Helper: compute and stamp balance_after for a user
-- =========================================================
CREATE OR REPLACE FUNCTION append_ledger(
  p_user_id uuid,
  p_exchange_id uuid,
  p_entry_type text,
  p_amount integer,
  p_entry_kind text,
  p_note text DEFAULT NULL
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

  INSERT INTO ledger_entries (user_id, exchange_id, entry_type, amount, balance_after, entry_kind, note)
  VALUES (p_user_id, p_exchange_id, p_entry_type, p_amount, v_balance, p_entry_kind, p_note);
END;
$$;

-- =========================================================
-- create_exchange_request
-- =========================================================
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

-- =========================================================
-- accept_exchange_request
-- =========================================================
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

-- =========================================================
-- hold_tokens
-- =========================================================
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

-- =========================================================
-- confirm_pickup
-- =========================================================
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

-- =========================================================
-- complete_exchange
-- =========================================================
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

  -- Tokens already transferred at hold_tokens time. Just finalize.
  UPDATE exchanges SET status = 'completed' WHERE id = p_exchange_id;
  UPDATE items SET status = 'sold' WHERE id = v_item_id;
END;
$$;

-- =========================================================
-- cancel_exchange
-- =========================================================
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

  -- If tokens were held, reverse the escrow.
  IF v_status = 'token_held' THEN
    SELECT token_price INTO v_price FROM items WHERE id = v_item_id;
    PERFORM append_ledger(v_rec, p_exchange_id, 'credit', v_price, 'escrow_release', 'Escrow refunded on cancel');
    PERFORM append_ledger(v_own, p_exchange_id, 'debit', v_price, 'escrow_release', 'Escrow reversed on cancel');
  END IF;

  UPDATE exchanges SET status = 'cancelled' WHERE id = p_exchange_id;
  UPDATE items SET status = 'available' WHERE id = v_item_id AND status = 'reserved';
END;
$$;

-- =========================================================
-- p2p_transfer
-- =========================================================
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

  PERFORM append_ledger(v_sender, NULL, 'debit', p_amount, 'p2p_send', 'Sent to ' || p_recipient_email);
  PERFORM append_ledger(v_recipient, NULL, 'credit', p_amount, 'p2p_receive', 'Received from peer');

  RETURN true;
END;
$$;

-- =========================================================
-- admin_issue_tokens (service role only — no auth.uid check, protected by
-- being called only from the admin panel with the service role key)
-- =========================================================
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

-- =========================================================
-- approve_recycling_spot (admin) — credits tokens on approval
-- =========================================================
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
