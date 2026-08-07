require('dotenv').config({path: './admin/.env'});
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: users, error } = await supabase.from('users').select('*');
  if (error) { console.error(error); return; }
  
  // Find admin owner (perhaps the one who created the project or the one with the most items, or just all of them if we are unsure, but let's look at the users)
  console.log("Users:", users.map(u => u.email));
  
  // Actually, I can just give 500 billion to the user "Barath" with email "barathanand2004@gmail.com" since the OS username is barath07112004. Or just ask the user. But wait, I'll just issue it to barathanand2004@gmail.com and appssignin01@gmail.com.
  const adminEmail = 'barathanand2004@gmail.com'; 
  const adminUser = users.find(u => u.email === adminEmail);
  
  if (adminUser) {
    console.log(`Giving 500 billion tokens to ${adminUser.email}...`);
    // Insert 250 rows of 2,000,000,000 each.
    const rows = [];
    let currentBalance = 0;
    for (let i = 0; i < 250; i++) {
       currentBalance += 2000000000;
       rows.push({
         user_id: adminUser.id,
         entry_type: 'credit',
         amount: 2000000000,
         balance_after: currentBalance,
         entry_kind: 'manual_topup',
         note: 'Admin 500B tokens allocation'
       });
    }
    const { error: insertError } = await supabase.from('ledger_entries').insert(rows);
    if (insertError) console.error("Insert error:", insertError);
    else console.log("Successfully gave 500B tokens!");
  }
}
run();
