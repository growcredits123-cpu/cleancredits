import { useEffect, useState, useCallback } from 'react';
import { StyleSheet, View, Text, ScrollView, Image, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Star, MapPin, ArrowLeft, Package, Trash2 } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { theme } from '@/lib/theme';
import type { Item, User } from '@/lib/types';

export default function ItemDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const [item, setItem] = useState<Item | null>(null);
  const [owner, setOwner] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error: qErr } = await supabase
      .from('items')
      .select('id, owner_id, title, description, photo_url, photo_path, token_price, lat, lng, status, created_at, owner:users!items_owner_id_fkey(id, name, avatar_url, rating_avg, is_blocked)')
      .eq('id', id)
      .maybeSingle();
    if (qErr || !data) {
      setError(qErr?.message || 'Item not found.');
      setLoading(false);
      return;
    }
    setItem(data as unknown as Item);
    setOwner(((data as unknown as { owner: User }).owner) || null);
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function handleRequest() {
    if (!item || !session) return;
    setRequesting(true);
    const { data, error } = await supabase.rpc('create_exchange_request', {
      p_item_id: item.id,
      p_owner_id: item.owner_id,
    });
    setRequesting(false);
    if (error) {
      Alert.alert('Request failed', error.message);
      return;
    }
    if (data) {
      Alert.alert('Request sent!', 'The owner will be notified.');
      router.push(`/exchange/${data}`);
    }
  }

  async function handleDelete() {
    if (!item) return;
    Alert.alert('Remove listing?', 'This will take the item off the map.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive', onPress: async () => {
          await supabase.from('items').update({ status: 'removed' }).eq('id', item.id);
          router.back();
        }
      },
    ]);
  }

  if (loading) return <ActivityIndicator size="large" color={theme.colors.primary[500]} style={{ flex: 1 }} />;
  if (error || !item) return <View style={styles.center}><Text>{error || 'Item not found'}</Text></View>;

  const isOwner = item.owner_id === session?.user.id;
  const canRequest = !isOwner && item.status === 'available';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ArrowLeft size={22} color={theme.colors.text} />
          </TouchableOpacity>
          {isOwner && (
            <TouchableOpacity onPress={handleDelete} style={styles.deleteBtn}>
              <Trash2 size={18} color={theme.colors.error} />
            </TouchableOpacity>
          )}
        </View>

      <View style={styles.imageWrap}>
        {item.photo_url ? (
          <Image source={{ uri: item.photo_url }} style={styles.image} />
        ) : (
          <View style={[styles.image, styles.imagePlaceholder]}>
            <Package size={48} color={theme.colors.neutral[300]} />
          </View>
        )}
      </View>

      <View style={styles.body}>
        <Text style={styles.title}>{item.title}</Text>
        <View style={styles.priceRow}>
          <Text style={styles.price}>{item.token_price} ◆</Text>
          <View style={[styles.statusPill, { backgroundColor: item.status === 'available' ? theme.colors.primary[50] : theme.colors.neutral[100] }]}>
            <Text style={[styles.statusText, { color: item.status === 'available' ? theme.colors.primary[700] : theme.colors.neutral[500] }]}>{item.status}</Text>
          </View>
        </View>

        <Text style={styles.sectionLabel}>Description</Text>
        <Text style={styles.description}>{item.description || 'No description provided.'}</Text>

        <View style={styles.locationRow}>
          <MapPin size={16} color={theme.colors.textMuted} />
          <Text style={styles.locationText}>{item.lat.toFixed(4)}, {item.lng.toFixed(4)}</Text>
        </View>

        {owner && (
          <TouchableOpacity style={styles.ownerCard} onPress={() => router.push(`/profile/${owner.id}`)}>
            <View style={styles.ownerAvatar}>
              {owner.avatar_url ? <Image source={{ uri: owner.avatar_url }} style={styles.ownerAvatarImg} /> : <Text style={styles.ownerInitial}>{owner.name.charAt(0)}</Text>}
            </View>
            <View style={styles.ownerInfo}>
              <Text style={styles.ownerName}>{owner.name}</Text>
              <View style={styles.ownerRatingRow}>
                <Star size={12} color={theme.colors.warning} fill={theme.colors.warning} />
                <Text style={styles.ownerRating}>{owner.rating_avg.toFixed(1)}</Text>
              </View>
            </View>
          </TouchableOpacity>
        )}

        {canRequest && (
          <TouchableOpacity style={styles.requestBtn} onPress={handleRequest} disabled={requesting}>
            {requesting ? <ActivityIndicator color="#fff" /> : <Text style={styles.requestBtnText}>Request swap</Text>}
          </TouchableOpacity>
        )}
      </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 8, zIndex: 10 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center' },
  deleteBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center' },
  imageWrap: { width: '100%', height: 300, backgroundColor: theme.colors.neutral[100] },
  image: { width: '100%', height: '100%' },
  imagePlaceholder: { alignItems: 'center', justifyContent: 'center' },
  body: { padding: 20 },
  title: { fontSize: 24, fontWeight: '700', color: theme.colors.text, fontFamily: theme.fonts.bold },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 },
  price: { fontSize: 20, fontWeight: '700', color: theme.colors.primary[600], fontFamily: theme.fonts.bold },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  statusText: { fontSize: 12, fontWeight: '700', textTransform: 'capitalize', fontFamily: theme.fonts.bold },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: theme.colors.neutral[600], marginTop: 20, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5, fontFamily: theme.fonts.bold },
  description: { fontSize: 15, color: theme.colors.text, lineHeight: 22, fontFamily: theme.fonts.regular },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 16 },
  locationText: { fontSize: 13, color: theme.colors.textMuted, fontFamily: theme.fonts.regular },
  ownerCard: { flexDirection: 'row', alignItems: 'center', marginTop: 20, padding: 12, backgroundColor: theme.colors.surface, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border },
  ownerAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: theme.colors.primary[100], alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginRight: 12 },
  ownerAvatarImg: { width: '100%', height: '100%' },
  ownerInitial: { fontSize: 18, fontWeight: '700', color: theme.colors.primary[700], fontFamily: theme.fonts.bold },
  ownerInfo: { flex: 1 },
  ownerName: { fontSize: 15, fontWeight: '600', color: theme.colors.text, fontFamily: theme.fonts.bold },
  ownerRatingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  ownerRating: { fontSize: 12, color: theme.colors.textMuted, fontFamily: theme.fonts.regular },
  requestBtn: { backgroundColor: theme.colors.primary[500], borderRadius: theme.radius.md, paddingVertical: 16, alignItems: 'center', marginTop: 24 },
  requestBtnText: { color: '#fff', fontSize: 16, fontWeight: '700', fontFamily: theme.fonts.bold },
});
