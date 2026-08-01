import { useEffect, useState, useCallback } from 'react';
import { StyleSheet, View, Text, ScrollView, Image, TouchableOpacity, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Star, Flag, ArrowLeft, Package, Ban } from 'lucide-react-native';
import { TextInput } from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { theme } from '@/lib/theme';
import type { User, Item } from '@/lib/types';

export default function ProfileDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const [user, setUser] = useState<User | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reportModal, setReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('');

  const load = useCallback(async () => {
    const { data } = await supabase.from('users').select('*').eq('id', id).maybeSingle();
    setUser(data as User | null);
    const { data: itemData } = await supabase
      .from('items')
      .select('*')
      .eq('owner_id', id)
      .neq('status', 'removed')
      .order('created_at', { ascending: false });
    setItems((itemData as Item[]) || []);
    setLoading(false);
    setRefreshing(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function submitReport() {
    if (!reportReason.trim() || !session) return;
    const { error } = await supabase.from('reports').insert({
      reporter_id: session.user.id,
      reported_user_id: id,
      reason: reportReason.trim(),
    });
    if (error) { Alert.alert('Report failed', error.message); return; }
    setReportModal(false);
    setReportReason('');
    Alert.alert('Reported', 'Thank you. Our team will review this user.');
  }

  if (loading) return <ActivityIndicator size="large" color={theme.colors.primary[500]} style={{ flex: 1 }} />;
  if (!user) return <View style={styles.center}><Text>User not found</Text></View>;

  const isSelf = user.id === session?.user.id;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 32 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
    >
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={22} color={theme.colors.text} />
        </TouchableOpacity>
        {!isSelf && (
          <TouchableOpacity style={styles.reportBtn} onPress={() => setReportModal(true)}>
            <Flag size={18} color={theme.colors.error} />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.header}>
        <View style={styles.avatar}>
          {user.avatar_url ? <Image source={{ uri: user.avatar_url }} style={styles.avatarImg} /> : <Text style={styles.avatarInitial}>{user.name.charAt(0).toUpperCase()}</Text>}
        </View>
        <Text style={styles.name}>{user.name}</Text>
        <View style={styles.ratingRow}>
          <Star size={16} color={theme.colors.warning} fill={theme.colors.warning} />
          <Text style={styles.rating}>{user.rating_avg.toFixed(1)} rating</Text>
        </View>
        {user.is_blocked && (
          <View style={styles.blockedBadge}>
            <Ban size={14} color={theme.colors.error} />
            <Text style={styles.blockedText}>Blocked by admin</Text>
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{user.name.split(' ')[0]}'s listings</Text>
        {items.length === 0 ? (
          <View style={styles.empty}><Package size={32} color={theme.colors.neutral[300]} /><Text style={styles.emptyText}>No active listings</Text></View>
        ) : (
          <View style={styles.itemList}>
            {items.map((item) => (
              <TouchableOpacity key={item.id} style={styles.itemCard} onPress={() => router.push(`/item/${item.id}`)}>
                <View style={styles.itemThumb}>
                  {item.photo_url ? <Image source={{ uri: item.photo_url }} style={styles.itemThumbImg} /> : <Package size={20} color={theme.colors.neutral[400]} />}
                </View>
                <View style={styles.itemBody}>
                  <Text style={styles.itemTitle} numberOfLines={1}>{item.title}</Text>
                  <Text style={styles.itemPrice}>{item.token_price} ◆</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {reportModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Report {user.name}</Text>
            <TextInput
              style={styles.modalInput}
              value={reportReason}
              onChangeText={setReportReason}
              placeholder="Describe the issue…"
              placeholderTextColor={theme.colors.neutral[400]}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setReportModal(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalReport} onPress={submitReport}>
                <Text style={styles.modalReportText}>Submit report</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topBar: { position: 'absolute', top: 56, left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between', zIndex: 10 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center' },
  reportBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center' },
  header: { alignItems: 'center', paddingTop: 72, paddingBottom: 24, backgroundColor: theme.colors.surface, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  avatar: { width: 88, height: 88, borderRadius: 44, backgroundColor: theme.colors.primary[100], alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImg: { width: '100%', height: '100%' },
  avatarInitial: { fontSize: 36, fontWeight: '700', color: theme.colors.primary[700], fontFamily: theme.fonts.bold },
  name: { fontSize: 22, fontWeight: '700', color: theme.colors.text, marginTop: 12, fontFamily: theme.fonts.bold },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  rating: { fontSize: 14, color: theme.colors.neutral[600], fontWeight: '600', fontFamily: theme.fonts.bold },
  blockedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8, backgroundColor: theme.colors.error + '15', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  blockedText: { fontSize: 12, fontWeight: '700', color: theme.colors.error, fontFamily: theme.fonts.bold },
  section: { paddingHorizontal: 16, marginTop: 20 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: theme.colors.text, marginBottom: 12, fontFamily: theme.fonts.bold },
  empty: { alignItems: 'center', paddingVertical: 24, backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.colors.border },
  emptyText: { fontSize: 14, color: theme.colors.textMuted, marginTop: 8, fontFamily: theme.fonts.regular },
  itemList: { gap: 10 },
  itemCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.surface, borderRadius: theme.radius.md, padding: 10, borderWidth: 1, borderColor: theme.colors.border },
  itemThumb: { width: 48, height: 48, borderRadius: theme.radius.sm, backgroundColor: theme.colors.neutral[100], alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginRight: 12 },
  itemThumbImg: { width: '100%', height: '100%' },
  itemBody: { flex: 1 },
  itemTitle: { fontSize: 15, fontWeight: '600', color: theme.colors.text, fontFamily: theme.fonts.bold },
  itemPrice: { fontSize: 13, fontWeight: '700', color: theme.colors.primary[600], marginTop: 2, fontFamily: theme.fonts.bold },
  modalOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 24 },
  modalSheet: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.xl, padding: 24 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: theme.colors.text, marginBottom: 16, fontFamily: theme.fonts.bold },
  modalInput: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: theme.colors.text, minHeight: 80, fontFamily: theme.fonts.regular },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 16 },
  modalCancel: { flex: 1, paddingVertical: 14, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center' },
  modalCancelText: { fontSize: 15, fontWeight: '600', color: theme.colors.neutral[600], fontFamily: theme.fonts.bold },
  modalReport: { flex: 1, paddingVertical: 14, borderRadius: theme.radius.md, backgroundColor: theme.colors.error, alignItems: 'center' },
  modalReportText: { fontSize: 15, fontWeight: '700', color: '#fff', fontFamily: theme.fonts.bold },
});
