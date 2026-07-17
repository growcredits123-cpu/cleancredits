export type ItemStatus = 'available' | 'reserved' | 'sold' | 'removed';
export type ExchangeStatus =
  | 'requested'
  | 'accepted'
  | 'token_held'
  | 'picked_up'
  | 'completed'
  | 'cancelled';
export type EntryType = 'credit' | 'debit';
export type EntryKind =
  | 'topup'
  | 'escrow_hold'
  | 'escrow_release'
  | 'p2p_send'
  | 'p2p_receive'
  | 'manual_topup'
  | 'recycling_reward';
export type RecyclingStatus = 'pending' | 'approved' | 'rejected';
export type ReportStatus = 'open' | 'reviewed' | 'resolved';

export interface User {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  rating_avg: number;
  is_blocked: boolean;
  created_at: string;
}

export interface Item {
  id: string;
  owner_id: string;
  title: string;
  description: string;
  photo_url: string | null;
  photo_path: string | null;
  token_price: number;
  lat: number;
  lng: number;
  status: ItemStatus;
  created_at: string;
  owner?: User;
}

export interface Exchange {
  id: string;
  item_id: string;
  requester_id: string;
  owner_id: string;
  status: ExchangeStatus;
  created_at: string;
  updated_at: string;
  item?: Item;
  requester?: User;
  owner?: User;
}

export interface LedgerEntry {
  id: string;
  user_id: string;
  exchange_id: string | null;
  entry_type: EntryType;
  amount: number;
  balance_after: number;
  entry_kind: EntryKind;
  note: string | null;
  created_at: string;
}

export interface RecyclingSpot {
  id: string;
  user_id: string;
  lat: number;
  lng: number;
  photo_url: string | null;
  photo_path: string | null;
  status: RecyclingStatus;
  geohash: string;
  created_at: string;
  user?: User;
}

export interface Message {
  id: string;
  exchange_id: string;
  sender_id: string;
  text: string;
  created_at: string;
}

export interface Rating {
  id: string;
  from_user: string;
  to_user: string;
  exchange_id: string;
  score: number;
  comment: string;
  created_at: string;
}

export interface Report {
  id: string;
  reporter_id: string;
  reported_user_id: string;
  reason: string;
  status: ReportStatus;
  created_at: string;
}
