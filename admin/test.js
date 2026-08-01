require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(url, key);

async function test() {
  const { data, error, count } = await supabase.from('users').select('id', { count: 'exact' });
  console.log('Users:', { data, error, count });
}

test();
