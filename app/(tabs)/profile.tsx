import { useEffect, useState, useCallback } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, Image, ActivityIndicator, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { Star, LogOut, Package, MapPin, Shield } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { theme } from '@/lib/theme';
import type { Item } from '@/lib/types';

export default function ProfileScreen() {
  const { session, profile, signOut, refreshProfile } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!session) return;
    const { data } = await supabase
      .from('items')
      .select('*')
      .eq('owner_id', session.user.id)
      .order('created_at', { ascending: false });
    setItems((data as Item[]) || []);
    setLoading(false);
    setRefreshing(false);
  }, [session]);

  useEffect(() => { load(); }, [load]);

  if (!profile) {
    return <ActivityIndicator size="large" color={theme.colors.primary[500]} style={{ flex: 1 }} />;
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 32 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); refreshProfile(); }} />}
    >
      <View style={styles.header}>
        <View style={styles.avatar}>
          {profile.avatar_url ? (
            <Image source={{ uri: profile.avatar_url }} style={styles.avatarImg} />
          ) : (
            <Text style={styles.avatarInitial}>{profile.name.charAt(0).toUpperCase()}</Text>
          )}
        </View>
        <Text style={styles.name}>{profile.name}</Text>
        <Text style={styles.email}>{profile.email}</Text>
        <View style={styles.ratingRow}>
          <Star size={16} color={theme.colors.warning} fill={theme.colors.warning} />
          <Text style={styles.rating}>{profile.rating_avg.toFixed(1)} rating</Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Package size={20} color={theme.colors.primary[600]} />
          <Text style={styles.statValue}>{items.length}</Text>
          <Text style={styles.statLabel}>Items</Text>
        </View>
        <View style={styles.statDivider} />
        <TouchableOpacity style={styles.stat} onPress={() => router.push('/profile/blocked')}>
          <Shield size={20} color={theme.colors.neutral[600]} />
          <Text style={styles.statValue}>0</Text>
          <Text style={styles.statLabel}>Blocked</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Your listings</Text>
        {loading ? (
          <ActivityIndicator color={theme.colors.primary[500]} style={{ marginTop: 20 }} />
        ) : items.length === 0 ? (
          <View style={styles.emptySection}>
            <Package size={32} color={theme.colors.neutral[300]} />
            <Text style={styles.emptyText}>No items posted yet</Text>
            <TouchableOpacity style={styles.postBtn} onPress={() => router.push('/(tabs)/post')}>
              <Text style={styles.postBtnText}>Post your first item</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.itemList}>
            {items.map((item) => (
              <TouchableOpacity key={item.id} style={styles.itemCard} onPress={() => router.push(`/item/${item.id}`)}>
                <View style={styles.itemThumb}>
                  {item.photo_url ? <Image source={{ uri: item.photo_url }} style={styles.itemThumbImg} /> : <Package size={20} color={theme.colors.neutral[400]} />}
                </View>
                <View style={styles.itemBody}>
                  <Text style={styles.itemTitle} numberOfLines={1}>{item.title}</Text>
                  <View style={styles.itemMetaRow}>
                    <Text style={styles.itemPrice}>{item.token_price} ◆</Text>
                    <View style={[styles.statusPill, { backgroundColor: item.status === 'available' ? theme.colors.primary[50] : theme.colors.neutral[100] }]}>
                      <Text style={[styles.statusPillText, { color: item.status === 'available' ? theme.colors.primary[700] : theme.colors.neutral[500] }]}>{item.status}</Text>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      <TouchableOpacity style={styles.signOutBtn} onPress={signOut}>
        <LogOut size={18} color={theme.colors.error} />
        <Text style={styles.signOutText}>Sign out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: { alignItems: 'center', paddingTop: 64, paddingBottom: 24, backgroundColor: theme.colors.surface, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  avatar: { width: 88, height: 88, borderRadius: 44, backgroundColor: theme.colors.primary[100], alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImg: { width: '100%', height: '100%' },
  avatarInitial: { fontSize: 36, fontWeight: '700', color: theme.colors.primary[700], fontFamily: theme.fonts.bold },
  name: { fontSize: 22, fontWeight: '700', color: theme.colors.text, marginTop: 12, fontFamily: theme.fonts.bold },
  email: { fontSize: 14, color: theme.colors.textMuted, marginTop: 2, fontFamily: theme.fonts.regular },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  rating: { fontSize: 14, color: theme.colors.neutral[600], fontWeight: '600', fontFamily: theme.fonts.bold },
  statsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', margin: 16, backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, paddingVertical: 16, borderWidth: 1, borderColor: theme.colors.border },
  stat: { flex: 1, alignItems: 'center', gap: 4 },
  statDivider: { width: 1, height: 32, backgroundColor: theme.colors.border },
  statValue: { fontSize: 20, fontWeight: '700', color: theme.colors.text, fontFamily: theme.fonts.bold },
  statLabel: { fontSize: 12, color: theme.colors.textMuted, fontFamily: theme.fonts.regular },
  section: { paddingHorizontal: 16, marginTop: 8 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: theme.colors.text, marginBottom: 12, fontFamily: theme.fonts.bold },
  emptySection: { alignItems: 'center', paddingVertical: 24, backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.colors.border },
  emptyText: { fontSize: 14, color: theme.colors.textMuted, marginTop: 8, fontFamily: theme.fonts.regular },
  postBtn: { marginTop: 12, backgroundColor: theme.colors.primary[500], paddingHorizontal: 18, paddingVertical: 10, borderRadius: 20 },
  postBtnText: { color: '#fff', fontSize: 14, fontWeight: '700', fontFamily: theme.fonts.bold },
  itemList: { gap: 10 },
  itemCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.surface, borderRadius: theme.radius.md, padding: 10, borderWidth: 1, borderColor: theme.colors.border },
  itemThumb: { width: 48, height: 48, borderRadius: theme.radius.sm, backgroundColor: theme.colors.neutral[100], alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginRight: 12 },
  itemThumbImg: { width: '100%', height: '100%' },
  itemBody: { flex: 1 },
  itemTitle: { fontSize: 15, fontWeight: '600', color: theme.colors.text, fontFamily: theme.fonts.bold },
  itemMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  itemPrice: { fontSize: 13, fontWeight: '700', color: theme.colors.primary[600], fontFamily: theme.fonts.bold },
  statusPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  statusPillText: { fontSize: 10, fontWeight: '700', textTransform: 'capitalize', fontFamily: theme.fonts.bold },
  signOutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginHorizontal: 16, marginTop: 24, paddingVertical: 14, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.error + '30' },
  signOutText: { fontSize: 15, fontWeight: '600', color: theme.colors.error, fontFamily: theme.fonts.bold },
});
