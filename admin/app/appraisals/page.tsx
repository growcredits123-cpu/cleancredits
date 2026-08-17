import { getAdminClient } from '@/lib/supabase';
import { AppraisalCard } from './AppraisalCard';

export const dynamic = 'force-dynamic';

export default async function AppraisalsPage() {
  const adminSupabase = getAdminClient();
  
  const { data: requests, error } = await adminSupabase
    .from('app_events')
    .select('*, user:users(name, email)')
    .eq('event_type', 'appraisal_request')
    .eq('resolved', false)
    .order('created_at', { ascending: true });

  if (error) {
    return <div className="p-4 text-red-500">Error loading requests: {error.message}</div>;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Appraisal Requests</h1>
      <p className="text-gray-500 mb-8">Review user requests for plant/tree appraisals and assign token values.</p>

      {requests?.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <p className="text-gray-500">No pending appraisal requests.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {requests?.map((req: any) => (
            <AppraisalCard key={req.id} request={req} />
          ))}
        </div>
      )}
    </div>
  );
}
