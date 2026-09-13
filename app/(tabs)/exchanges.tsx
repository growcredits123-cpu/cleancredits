import { useEffect, useState, useCallback } from 'react';
import { StyleSheet, View, Text, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { ArrowDownUp, Package } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { theme } from '@/lib/theme';
import type { Exchange } from '@/lib/types';

type Filter = 'all' | 'active' | 'completed';

export default function ExchangesScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');

  const load = useCallback(async () => {
    if (!session) return;
    let q = supabase
      .from('exchanges')
      .select('id, item_id, requester_id, owner_id, status, created_at, updated_at, item:items(id, title, photo_url, token_price), requester:users!exchanges_requester_id_fkey(id, name, avatar_url), owner:users!exchanges_owner_id_fkey(id, name, avatar_url)')
      .or(`requester_id.eq.${session.user.id},owner_id.eq.${session.user.id}`)
      .order('updated_at', { ascending: false });
    if (filter === 'active') {
      q = q.in('status', ['requested', 'accepted', 'token_held', 'picked_up']);
    } else if (filter === 'completed') {
      q = q.in('status', ['completed', 'cancelled']);
    }
    const { data, error } = await q;
    if (error) {
      console.warn(error.message);
    }
    setExchanges((data as unknown as Exchange[]) || []);
    setLoading(false);
    setRefreshing(false);
  }, [session, filter]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  function statusColor(status: string) {
    switch (status) {
      case 'requested': return theme.colors.secondary[500];
      case 'accepted': return theme.colors.warning;
      case 'token_held': return theme.colors.secondary[600];
      case 'picked_up': return theme.colors.primary[600];
      case 'completed': return theme.colors.success;
      default: return theme.colors.neutral[400];
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Your swaps</Text>
        <Text style={styles.subtitle}>Track exchange requests and pickups</Text>
      </View>

      <View style={styles.filterRow}>
        {(['all', 'active', 'completed'] as Filter[]).map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterChip, filter === f && styles.filterChipActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={theme.colors.primary[500]} style={styles.loader} />
      ) : exchanges.length === 0 ? (
        <View style={styles.empty}>
          <ArrowDownUp size={40} color={theme.colors.neutral[300]} />
          <Text style={styles.emptyText}>No swaps yet</Text>
          <Text style={styles.emptySubtext}>When you request or receive an item, it'll appear here.</Text>
        </View>
      ) : (
        <FlatList
          data={exchanges}
          keyExtractor={(i) => i.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
          renderItem={({ item }) => {
            const isRequester = item.requester_id === session?.user.id;
            const other = isRequester ? item.owner : item.requester;
            return (
              <TouchableOpacity style={styles.card} onPress={() => router.push(`/exchange/${item.id}`)}>
                <View style={styles.cardLeft}>
                  {item.item?.photo_url ? (
                    <Image source={{ uri: item.item.photo_url }} style={styles.thumb} />
                  ) : (
                    <View style={[styles.thumb, styles.thumbPlaceholder]}>
                      <Package size={20} color={theme.colors.neutral[400]} />
                    </View>
                  )}
                </View>
                <View style={styles.cardBody}>
                  <Text style={styles.cardTitle} numberOfLines={1}>{item.item?.title || 'Item'}</Text>
                  <Text style={styles.cardSubtext} numberOfLines={1}>{isRequester ? 'You requested' : `From ${other?.name || 'User'}`}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: statusColor(item.status) + '20' }]}>
                    <Text style={[styles.statusText, { color: statusColor(item.status) }]}>{item.status.replace('_', ' ')}</Text>
                  </View>
                </View>
                <Text style={styles.cardPrice}>{item.item?.token_price ?? 0} ◆</Text>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, backgroundColor: theme.colors.surface, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  title: { fontSize: 26, fontWeight: '700', color: theme.colors.text, fontFamily: theme.fonts.bold, maxWidth: 720, width: '100%', alignSelf: 'center' },
  subtitle: { fontSize: 13, color: theme.colors.textMuted, marginTop: 2, fontFamily: theme.fonts.regular, maxWidth: 720, width: '100%', alignSelf: 'center' },
  filterRow: { flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 12, gap: 8, backgroundColor: theme.colors.surface, maxWidth: 720, width: '100%', alignSelf: 'center' },
  filterChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: theme.colors.neutral[100] },
  filterChipActive: { backgroundColor: theme.colors.primary[500] },
  filterText: { fontSize: 13, fontWeight: '600', color: theme.colors.neutral[600], fontFamily: theme.fonts.bold },
  filterTextActive: { color: '#fff' },
  loader: { marginTop: 40 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  emptyText: { fontSize: 18, fontWeight: '700', color: theme.colors.text, marginTop: 16, fontFamily: theme.fonts.bold },
  emptySubtext: { fontSize: 14, color: theme.colors.textMuted, textAlign: 'center', marginTop: 8, fontFamily: theme.fonts.regular },
  list: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24, maxWidth: 720, width: '100%', alignSelf: 'center' },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: theme.colors.border },
  cardLeft: { marginRight: 12 },
  thumb: { width: 56, height: 56, borderRadius: theme.radius.md, backgroundColor: theme.colors.neutral[200] },
  thumbPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  cardBody: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: theme.colors.text, fontFamily: theme.fonts.bold },
  cardSubtext: { fontSize: 13, color: theme.colors.textMuted, marginTop: 2, fontFamily: theme.fonts.regular },
  statusBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, marginTop: 6 },
  statusText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize', fontFamily: theme.fonts.bold },
  cardPrice: { fontSize: 15, fontWeight: '700', color: theme.colors.primary[600], fontFamily: theme.fonts.bold },
});
