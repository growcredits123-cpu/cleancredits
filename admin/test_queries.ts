import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(url, key);

async function main() {
  console.log("Testing ledger_entries query...");
  const ledger = await supabase
    .from('ledger_entries')
    .select('id, user_id, amount, note, created_at, user:users!ledger_entries_user_id_fkey(name, email)')
    .eq('entry_kind', 'manual_topup')
    .order('created_at', { ascending: false })
    .limit(15);
  console.log("Ledger error:", ledger.error);
  console.log("Ledger data count:", ledger.data?.length);

  console.log("Testing users query...");
  const users = await supabase.from('users').select('*');
  console.log("Users error:", users.error);
  console.log("Users count:", users.data?.length);
}

main();
