import { getAdminClient } from '@/lib/supabase';
import { UserCard } from './UserCard';

export const dynamic = 'force-dynamic';

export default async function UsersPage() {
  const adminSupabase = getAdminClient();
  
  const { data: users, error } = await adminSupabase
    .from('users')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    return <div className="p-4 text-red-500">Error loading users: {error.message}</div>;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Users Management</h1>
      <p className="text-gray-500 mb-8">Click on a user profile to edit details or toggle requirements.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {users?.map((user: any) => (
          <UserCard key={user.id} user={user} />
        ))}
      </div>
    </div>
  );
}
