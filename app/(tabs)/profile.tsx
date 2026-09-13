import { useEffect, useState, useCallback } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, Image, ActivityIndicator, RefreshControl, Modal, TextInput, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Star, LogOut, Package, MapPin, Shield, Camera, X } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { theme } from '@/lib/theme';
import type { Item } from '@/lib/types';
import useSWR from 'swr';

export default function ProfileScreen() {
  const { session, profile, signOut, refreshProfile } = useAuth();
  
  // Modal States
  const [showLandModal, setShowLandModal] = useState(false);
  const [showIdModal, setShowIdModal] = useState(false);
  const [showAppraisalModal, setShowAppraisalModal] = useState(false);
  
  // Upload States
  const [uploadBusy, setUploadBusy] = useState(false);
  const [appraisalItem, setAppraisalItem] = useState('');

  const fetcher = async () => {
    if (!session) return [];
    const { data, error } = await supabase
      .from('items')
      .select('*')
      .eq('owner_id', session.user.id)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data as Item[]) || [];
  };

  const { data: items = [], error, mutate, isValidating } = useSWR(session ? `profile_items_${session.user.id}` : null, fetcher);

  const requestsFetcher = async () => {
    if (!session) return [];
    const { data, error } = await supabase
      .from('access_requests')
      .select('id, item_id, token_amount, status, requester:users!access_requests_requester_id_fkey(name), item:items!access_requests_item_id_fkey(title)')
      .eq('owner_id', session.user.id)
      .eq('status', 'pending');
    if (error) throw error;
    return data || [];
  };

  const { data: pendingRequests = [], mutate: mutateRequests } = useSWR(session ? `profile_requests_${session.user.id}` : null, requestsFetcher);

  async function handleApproveRequest(requestId: string) {
    await supabase.from('access_requests').update({ status: 'approved' }).eq('id', requestId);
    Alert.alert('Approved', 'Access granted.');
    mutateRequests();
  }

  async function handleRejectRequest(requestId: string) {
    await supabase.from('access_requests').update({ status: 'rejected' }).eq('id', requestId);
    mutateRequests();
  }

  useEffect(() => {
    if (!session) return;
    const channel = supabase
      .channel(`public:items:owner_${session.user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'items', filter: `owner_id=eq.${session.user.id}` }, () => {
        mutate();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session, mutate]);

  async function getAssetBase64(asset: ImagePicker.ImagePickerAsset): Promise<string> {
    if (asset.base64) return asset.base64;
    try {
      const res = await fetch(asset.uri);
      const blob = await res.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const dataUrl = reader.result as string;
          const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (e) {
      return '';
    }
  }

  async function handleUploadLandProof() {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') return Alert.alert('Permission required to upload photos.');

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.7,
        base64: true,
      });

      if (result.canceled || !result.assets[0]) return;
      
      setUploadBusy(true);
      const b64 = await getAssetBase64(result.assets[0]);
      if (!b64) throw new Error('Could not read image data.');
      const filePath = `${session!.user.id}/land_${Date.now()}.jpg`;
      
      const { error: uploadError } = await supabase.storage
        .from('verification-docs')
        .upload(filePath, decode(b64), { contentType: 'image/jpeg' });
        
      if (uploadError) throw new Error(uploadError.message);
      
      const { data: { publicUrl } } = supabase.storage.from('verification-docs').getPublicUrl(filePath);

      const { error: dbError } = await supabase
        .from('land_ownership_proofs')
        .insert({ user_id: session!.user.id, document_url: publicUrl, status: 'pending' });
        
      if (dbError) throw new Error(dbError.message);

      Alert.alert('Success', 'Land ownership proof submitted for review.');
      setShowLandModal(false);
    } catch (e: any) {
      Alert.alert('Upload Failed', e.message);
    } finally {
      setUploadBusy(false);
    }
  }

  async function handleUploadID() {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') return Alert.alert('Permission required to upload photos.');

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.7,
        base64: true,
      });

      if (result.canceled || !result.assets[0]) return;
      
      setUploadBusy(true);
      const b64 = await getAssetBase64(result.assets[0]);
      if (!b64) throw new Error('Could not read image data.');
      const filePath = `${session!.user.id}/id_${Date.now()}.jpg`;
      
      const { error: uploadError } = await supabase.storage
        .from('verification-docs')
        .upload(filePath, decode(b64), { contentType: 'image/jpeg' });
        
      if (uploadError) throw new Error(uploadError.message);
      
      const { data: { publicUrl } } = supabase.storage.from('verification-docs').getPublicUrl(filePath);

      const { error: dbError } = await supabase
        .from('id_verifications')
        .insert({ user_id: session!.user.id, id_photo_url: publicUrl, status: 'pending' });
        
      if (dbError) throw new Error(dbError.message);

      Alert.alert('Success', 'ID document submitted for verification.');
      setShowIdModal(false);
    } catch (e: any) {
      Alert.alert('Upload Failed', e.message);
    } finally {
      setUploadBusy(false);
    }
  }

  async function handleRequestAppraisal() {
    if (!appraisalItem.trim()) return Alert.alert('Error', 'Please describe the item.');
    setUploadBusy(true);
    try {
      const { error } = await supabase.from('app_events').insert({
        user_id: session!.user.id,
        event_type: 'appraisal_request',
        payload: { description: appraisalItem }
      });
      if (error) throw new Error(error.message);
      Alert.alert('Success', 'Appraisal request sent to admin.');
      setShowAppraisalModal(false);
      setAppraisalItem('');
    } catch (e: any) {
      Alert.alert('Request Failed', e.message);
    } finally {
      setUploadBusy(false);
    }
  }

  if (!profile) {
    return <ActivityIndicator size="large" color={theme.colors.primary[500]} style={{ flex: 1 }} />;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 32, maxWidth: 720, width: '100%', alignSelf: 'center' }}
        refreshControl={<RefreshControl refreshing={isValidating} onRefresh={() => { mutate(); mutateRequests(); refreshProfile(); }} tintColor={theme.colors.primary[500]} />}
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
            <Text style={styles.rating}>{(profile as any).rating_avg?.toFixed(1) || '0.0'} rating</Text>
            <Text style={styles.reviewsCount}>({(profile as any).reviews_count || 0} reviews)</Text>
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
        <Text style={styles.sectionTitle}>Verifications & Appraisals</Text>
        <TouchableOpacity style={styles.actionRow} onPress={() => setShowLandModal(true)}>
          <Shield size={20} color={theme.colors.neutral[600]} />
          <Text style={styles.actionText}>Verify Land Ownership</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionRow} onPress={() => setShowAppraisalModal(true)}>
          <Star size={20} color={theme.colors.neutral[600]} />
          <Text style={styles.actionText}>Request Plant/Tree Appraisal</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionRow} onPress={() => setShowIdModal(true)}>
          <Shield size={20} color={theme.colors.neutral[600]} />
          <Text style={styles.actionText}>Upload ID Document</Text>
        </TouchableOpacity>
      </View>

      {pendingRequests.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pending Pick Requests</Text>
          {pendingRequests.map((req: any) => (
            <View key={req.id} style={styles.pendingCard}>
              <View style={styles.pendingInfo}>
                <Text style={styles.pendingName}>{req.requester?.name || 'User'}</Text>
                <Text style={styles.pendingItem}>wants to pick from {req.item?.title}</Text>
              </View>
              <View style={styles.pendingActions}>
                <TouchableOpacity style={styles.approveBtn} onPress={() => handleApproveRequest(req.id)}>
                  <Text style={styles.approveBtnText}>Approve</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.rejectBtn} onPress={() => handleRejectRequest(req.id)}>
                  <Text style={styles.rejectBtnText}>Reject</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Your listings</Text>
        {!items && isValidating ? (
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

      {/* LAND OWNERSHIP MODAL */}
      <Modal visible={showLandModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Land Ownership Proof</Text>
              <TouchableOpacity onPress={() => setShowLandModal(false)}><X color={theme.colors.neutral[500]} /></TouchableOpacity>
            </View>
            <Text style={styles.modalDesc}>Upload a photo of your property deed, lease agreement, or utility bill to verify land ownership.</Text>
            <TouchableOpacity style={styles.uploadBtn} onPress={handleUploadLandProof} disabled={uploadBusy}>
              {uploadBusy ? <ActivityIndicator color="#fff" /> : <><Camera color="#fff" size={20} /><Text style={styles.uploadBtnText}>Select & Upload Document</Text></>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ID VERIFICATION MODAL */}
      <Modal visible={showIdModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>ID Verification</Text>
              <TouchableOpacity onPress={() => setShowIdModal(false)}><X color={theme.colors.neutral[500]} /></TouchableOpacity>
            </View>
            <Text style={styles.modalDesc}>Upload a valid Government ID or School ID. Admins will review to verify your account.</Text>
            <TouchableOpacity style={styles.uploadBtn} onPress={handleUploadID} disabled={uploadBusy}>
              {uploadBusy ? <ActivityIndicator color="#fff" /> : <><Camera color="#fff" size={20} /><Text style={styles.uploadBtnText}>Select & Upload ID</Text></>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* APPRAISAL MODAL */}
      <Modal visible={showAppraisalModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Request Appraisal</Text>
              <TouchableOpacity onPress={() => setShowAppraisalModal(false)}><X color={theme.colors.neutral[500]} /></TouchableOpacity>
            </View>
            <Text style={styles.modalDesc}>Describe the plant, tree, or seeds you want appraised. An admin will review and assign a market token value.</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., 5-year-old Apple Tree"
              value={appraisalItem}
              onChangeText={setAppraisalItem}
            />
            <TouchableOpacity style={styles.uploadBtn} onPress={handleRequestAppraisal} disabled={uploadBusy}>
              {uploadBusy ? <ActivityIndicator color="#fff" /> : <Text style={styles.uploadBtnText}>Submit Request</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: { alignItems: 'center', paddingTop: 24, paddingBottom: 24, backgroundColor: theme.colors.surface, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  avatar: { width: 88, height: 88, borderRadius: 44, backgroundColor: theme.colors.primary[100], alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImg: { width: '100%', height: '100%' },
  avatarInitial: { fontSize: 36, fontWeight: '700', color: theme.colors.primary[700], fontFamily: theme.fonts.bold },
  name: { fontSize: 22, fontWeight: '700', color: theme.colors.text, marginTop: 12, fontFamily: theme.fonts.bold },
  email: { fontSize: 14, color: theme.colors.textMuted, marginTop: 2, fontFamily: theme.fonts.regular },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  rating: { fontSize: 14, color: theme.colors.neutral[600], fontWeight: '600', fontFamily: theme.fonts.bold },
  reviewsCount: { fontSize: 14, color: theme.colors.neutral[400], fontFamily: theme.fonts.regular, marginLeft: 4 },
  statsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', margin: 16, backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, paddingVertical: 16, borderWidth: 1, borderColor: theme.colors.border },
  stat: { flex: 1, alignItems: 'center', gap: 4 },
  statDivider: { width: 1, height: 32, backgroundColor: theme.colors.border },
  statValue: { fontSize: 20, fontWeight: '700', color: theme.colors.text, fontFamily: theme.fonts.bold },
  statLabel: { fontSize: 12, color: theme.colors.textMuted, fontFamily: theme.fonts.regular },
  section: { paddingHorizontal: 16, marginTop: 16 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: theme.colors.text, marginBottom: 12, fontFamily: theme.fonts.bold },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  actionText: { fontSize: 15, color: theme.colors.text, fontFamily: theme.fonts.regular },
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
  
  pendingCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, backgroundColor: theme.colors.surface, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border, marginBottom: 8 },
  pendingInfo: { flex: 1, marginRight: 8 },
  pendingName: { fontSize: 14, fontWeight: '600', color: theme.colors.text, fontFamily: theme.fonts.bold },
  pendingItem: { fontSize: 12, color: theme.colors.textMuted, fontFamily: theme.fonts.regular, marginTop: 2 },
  pendingActions: { flexDirection: 'row', gap: 8 },
  approveBtn: { backgroundColor: '#dcfce7', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  approveBtnText: { color: theme.colors.success, fontSize: 13, fontWeight: '700', fontFamily: theme.fonts.bold },
  rejectBtn: { backgroundColor: '#fee2e2', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  rejectBtnText: { color: theme.colors.error, fontSize: 13, fontWeight: '700', fontFamily: theme.fonts.bold },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: Platform.OS === 'web' ? 'center' : 'flex-end',
    alignItems: Platform.OS === 'web' ? 'center' : undefined,
    padding: Platform.OS === 'web' ? 20 : 0,
  },
  modalContent: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderRadius: Platform.OS === 'web' ? 24 : undefined,
    maxWidth: Platform.OS === 'web' ? 480 : undefined,
    width: '100%',
    padding: 24,
    paddingBottom: 36,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: theme.colors.text, fontFamily: theme.fonts.bold },
  modalDesc: { fontSize: 14, color: theme.colors.textMuted, marginBottom: 20, fontFamily: theme.fonts.regular, lineHeight: 20 },
  uploadBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: theme.colors.primary[500], paddingVertical: 14, borderRadius: theme.radius.md },
  uploadBtnText: { color: '#fff', fontSize: 15, fontWeight: '700', fontFamily: theme.fonts.bold },
  input: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: theme.colors.text, fontFamily: theme.fonts.regular, marginBottom: 20 },
});
