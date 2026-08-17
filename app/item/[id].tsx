import { useEffect, useState, useCallback } from 'react';
import {
  StyleSheet, View, Text, ScrollView, Image, TouchableOpacity,
  ActivityIndicator, Alert, Platform, Modal, TextInput
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Star, MapPin, ArrowLeft, Package, Trash2, Navigation, CheckCircle2, Clock, Coins } from 'lucide-react-native';
import * as Linking from 'expo-linking';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { theme } from '@/lib/theme';
import type { Item, User } from '@/lib/types';

type Review = {
  id: string;
  reviewer_id: string;
  rating: number;
  comment: string;
  created_at: string;
  reviewer?: { name: string; avatar_url?: string };
};

type AccessRequest = {
  id: string;
  status: 'pending' | 'approved' | 'rejected';
  token_amount: number;
  expires_at?: string;
};

export default function ItemDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const [item, setItem] = useState<Item | null>(null);
  const [owner, setOwner] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Reviews
  const [reviews, setReviews] = useState<Review[]>([]);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  // Access / Pick Permission
  const [myRequest, setMyRequest] = useState<AccessRequest | null>(null);
  const [showAccessModal, setShowAccessModal] = useState(false);
  const [requesting, setRequesting] = useState(false);

  // Owner incoming requests
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);

  const load = useCallback(async () => {
    const { data, error: qErr } = await supabase
      .from('items')
      .select('id, owner_id, title, description, photo_url, token_price, lat, lng, status, created_at, owner:users!items_owner_id_fkey(id, name, avatar_url, rating_avg, is_blocked)')
      .eq('id', id)
      .maybeSingle();
    if (qErr || !data) {
      setError(qErr?.message || 'Item not found.');
      setLoading(false);
      return;
    }
    setItem(data as unknown as Item);
    setOwner(((data as unknown as { owner: User }).owner) || null);

    // Load reviews
    const { data: revData } = await supabase
      .from('reviews')
      .select('id, reviewer_id, rating, comment, created_at, reviewer:users!reviews_reviewer_id_fkey(name, avatar_url)')
      .eq('item_id', id)
      .order('created_at', { ascending: false })
      .limit(20);
    setReviews((revData as any[]) || []);

    if (session) {
      // Load my access request for this item
      const { data: reqData } = await supabase
        .from('access_requests')
        .select('id, status, token_amount, expires_at')
        .eq('item_id', id)
        .eq('requester_id', session.user.id)
        .maybeSingle();
      setMyRequest(reqData || null);

      // If owner, load incoming pending requests
      if ((data as any).owner_id === session.user.id) {
        const { data: pendData } = await supabase
          .from('access_requests')
          .select('id, status, token_amount, requester:users!access_requests_requester_id_fkey(name, email)')
          .eq('item_id', id)
          .eq('status', 'pending');
        setPendingRequests((pendData as any[]) || []);
      }
    }

    setLoading(false);
  }, [id, session]);

  useEffect(() => { load(); }, [load]);

  async function handleRequestAccess(free: boolean) {
    if (!item || !session) return;
    setRequesting(true);
    try {
      // If token-based, deduct tokens via p2p_transfer to owner
      if (!free && item.token_price > 0) {
        const ownerEmail = (owner as any)?.email;
        if (!ownerEmail) throw new Error('Owner email not found.');
        const { data: transferOk, error: tErr } = await supabase.rpc('p2p_transfer', {
          p_recipient_email: ownerEmail,
          p_amount: item.token_price,
        });
        if (tErr || transferOk === false) throw new Error(tErr?.message || 'Token transfer failed. Check your balance.');
      }

      const { error: insErr } = await supabase.from('access_requests').insert({
        item_id: item.id,
        requester_id: session.user.id,
        owner_id: item.owner_id,
        token_amount: free ? 0 : item.token_price,
        status: free ? 'pending' : 'approved', // paid requests auto-approve after token deduction
      });
      if (insErr) throw new Error(insErr.message);

      setShowAccessModal(false);
      Alert.alert('Request Sent!', free
        ? 'Your request has been sent to the owner for approval.'
        : `${item.token_price} tokens sent to owner. Access approved! You may now visit to collect.`
      );
      load();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setRequesting(false);
    }
  }

  async function handleApproveRequest(requestId: string) {
    await supabase.from('access_requests').update({ status: 'approved' }).eq('id', requestId);
    Alert.alert('Approved', 'The user has been granted access.');
    load();
  }

  async function handleRejectRequest(requestId: string) {
    await supabase.from('access_requests').update({ status: 'rejected' }).eq('id', requestId);
    load();
  }

  async function handleSubmitReview() {
    if (!item || !session) return;
    setSubmittingReview(true);
    try {
      const { error } = await supabase.from('reviews').insert({
        item_id: item.id,
        reviewer_id: session.user.id,
        reviewed_user_id: item.owner_id,
        rating: reviewRating,
        comment: reviewComment.trim(),
      });
      if (error) throw new Error(error.message);
      setShowReviewModal(false);
      setReviewComment('');
      setReviewRating(5);
      load();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSubmittingReview(false);
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

  function handleNavigate() {
    if (!item) return;
    const url = Platform.select({
      ios: `maps:0,0?q=${item.title}@${item.lat},${item.lng}`,
      android: `geo:0,0?q=${item.lat},${item.lng}(${item.title})`,
    });
    if (url) Linking.openURL(url);
  }

  if (loading) return <ActivityIndicator size="large" color={theme.colors.primary[500]} style={{ flex: 1 }} />;
  if (error || !item) return <View style={styles.center}><Text>{error || 'Item not found'}</Text></View>;

  const isOwner = item.owner_id === session?.user.id;
  const avgRating = reviews.length > 0 ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1) : null;
  const hasReviewed = reviews.some(r => r.reviewer_id === session?.user.id);
  const isFree = item.token_price === 0;
  const accessStatus = myRequest?.status;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
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
            <View style={styles.priceBadge}>
              <Coins size={16} color={isFree ? theme.colors.success : theme.colors.primary[600]} />
              <Text style={[styles.price, { color: isFree ? theme.colors.success : theme.colors.primary[600] }]}>
                {isFree ? 'FREE to pick' : `${item.token_price} ◆ tokens`}
              </Text>
            </View>
            <View style={[styles.statusPill, { backgroundColor: item.status === 'available' ? theme.colors.primary[50] : theme.colors.neutral[100] }]}>
              <Text style={[styles.statusText, { color: item.status === 'available' ? theme.colors.primary[700] : theme.colors.neutral[500] }]}>{item.status}</Text>
            </View>
          </View>

          {avgRating && (
            <View style={styles.ratingRow}>
              {[1, 2, 3, 4, 5].map(s => (
                <Star key={s} size={16} color={theme.colors.warning} fill={parseFloat(avgRating) >= s ? theme.colors.warning : 'transparent'} />
              ))}
              <Text style={styles.ratingText}>{avgRating} ({reviews.length} reviews)</Text>
            </View>
          )}

          <Text style={styles.sectionLabel}>Description</Text>
          <Text style={styles.description}>{item.description || 'No description provided.'}</Text>

          <View style={styles.locationRow}>
            <MapPin size={16} color={theme.colors.textMuted} />
            <Text style={styles.locationText}>{item.lat.toFixed(4)}, {item.lng.toFixed(4)}</Text>
            <TouchableOpacity style={styles.navigateBtn} onPress={handleNavigate}>
              <Navigation size={14} color={theme.colors.primary[600]} />
              <Text style={styles.navigateText}>Navigate</Text>
            </TouchableOpacity>
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
                  <Text style={styles.ownerRating}>{(owner.rating_avg || 0).toFixed(1)} rating</Text>
                </View>
              </View>
            </TouchableOpacity>
          )}

          {/* PICK PERMISSION SECTION */}
          {!isOwner && item.status === 'available' && (
            <View style={styles.accessSection}>
              <Text style={styles.sectionLabel}>Entry Permission</Text>
              {!myRequest && (
                <TouchableOpacity style={styles.requestBtn} onPress={() => setShowAccessModal(true)}>
                  <CheckCircle2 size={18} color="#fff" />
                  <Text style={styles.requestBtnText}>Request Permission to Pick</Text>
                </TouchableOpacity>
              )}
              {myRequest && (
                <View style={[styles.accessStatusBadge, {
                  backgroundColor: accessStatus === 'approved' ? '#dcfce7' : accessStatus === 'rejected' ? '#fee2e2' : '#fef9c3'
                }]}>
                  {accessStatus === 'approved' && <CheckCircle2 size={16} color={theme.colors.success} />}
                  {accessStatus === 'pending' && <Clock size={16} color="#ca8a04" />}
                  <Text style={[styles.accessStatusText, {
                    color: accessStatus === 'approved' ? theme.colors.success : accessStatus === 'rejected' ? theme.colors.error : '#ca8a04'
                  }]}>
                    {accessStatus === 'approved' ? 'Access Granted — you may visit to collect!' :
                      accessStatus === 'pending' ? 'Awaiting owner approval...' :
                        'Request rejected by owner.'}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* OWNER: APPROVE/REJECT REQUESTS */}
          {isOwner && pendingRequests.length > 0 && (
            <View style={styles.accessSection}>
              <Text style={styles.sectionLabel}>Pending Entry Requests</Text>
              {pendingRequests.map(req => (
                <View key={req.id} style={styles.pendingCard}>
                  <Text style={styles.pendingName}>{req.requester?.name || 'User'}</Text>
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

          {/* REVIEWS SECTION */}
          <View style={styles.reviewsSection}>
            <View style={styles.reviewsHeader}>
              <Text style={styles.sectionLabel}>Reviews</Text>
              {!isOwner && !hasReviewed && (
                <TouchableOpacity style={styles.addReviewBtn} onPress={() => setShowReviewModal(true)}>
                  <Text style={styles.addReviewText}>Write a review</Text>
                </TouchableOpacity>
              )}
            </View>
            {reviews.length === 0 ? (
              <Text style={styles.noReviews}>No reviews yet. Be the first!</Text>
            ) : (
              reviews.map(r => (
                <View key={r.id} style={styles.reviewCard}>
                  <View style={styles.reviewTop}>
                    <Text style={styles.reviewerName}>{r.reviewer?.name || 'User'}</Text>
                    <View style={styles.starsRow}>
                      {[1, 2, 3, 4, 5].map(s => (
                        <Star key={s} size={12} color={theme.colors.warning} fill={r.rating >= s ? theme.colors.warning : 'transparent'} />
                      ))}
                    </View>
                  </View>
                  {r.comment ? <Text style={styles.reviewComment}>{r.comment}</Text> : null}
                  <Text style={styles.reviewDate}>{new Date(r.created_at).toLocaleDateString()}</Text>
                </View>
              ))
            )}
          </View>
        </View>
      </ScrollView>

      {/* ACCESS REQUEST MODAL */}
      <Modal visible={showAccessModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Request Entry Permission</Text>
            <Text style={styles.modalDesc}>
              {isFree
                ? 'This listing is free. Send a request and the owner will approve your entry.'
                : `This listing costs ${item.token_price} ◆ tokens. Choose to pay now for instant access or send a free request for the owner to approve.`}
            </Text>
            {!isFree && (
              <TouchableOpacity style={styles.payBtn} onPress={() => handleRequestAccess(false)} disabled={requesting}>
                {requesting ? <ActivityIndicator color="#fff" /> : (
                  <><Coins size={16} color="#fff" /><Text style={styles.payBtnText}>Pay {item.token_price} ◆ & Get Instant Access</Text></>
                )}
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.freeRequestBtn} onPress={() => handleRequestAccess(true)} disabled={requesting}>
              <Text style={styles.freeRequestText}>{isFree ? 'Send Request' : 'Request for Free (Awaits Approval)'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowAccessModal(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* REVIEW MODAL */}
      <Modal visible={showReviewModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Write a Review</Text>
            <Text style={styles.modalSubLabel}>Rating</Text>
            <View style={styles.starSelector}>
              {[1, 2, 3, 4, 5].map(s => (
                <TouchableOpacity key={s} onPress={() => setReviewRating(s)}>
                  <Star size={32} color={theme.colors.warning} fill={reviewRating >= s ? theme.colors.warning : 'transparent'} />
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.modalSubLabel}>Comment (optional)</Text>
            <TextInput
              style={styles.reviewInput}
              value={reviewComment}
              onChangeText={setReviewComment}
              placeholder="Share your experience..."
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            <TouchableOpacity style={styles.payBtn} onPress={handleSubmitReview} disabled={submittingReview}>
              {submittingReview ? <ActivityIndicator color="#fff" /> : <Text style={styles.payBtnText}>Submit Review</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowReviewModal(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 8 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center' },
  deleteBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center' },
  imageWrap: { width: '100%', height: 280, backgroundColor: theme.colors.neutral[100] },
  image: { width: '100%', height: '100%' },
  imagePlaceholder: { alignItems: 'center', justifyContent: 'center' },
  body: { padding: 20 },
  title: { fontSize: 24, fontWeight: '700', color: theme.colors.text, fontFamily: theme.fonts.bold },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 10 },
  priceBadge: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  price: { fontSize: 18, fontWeight: '700', fontFamily: theme.fonts.bold },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  statusText: { fontSize: 12, fontWeight: '700', textTransform: 'capitalize', fontFamily: theme.fonts.bold },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 10 },
  ratingText: { fontSize: 13, color: theme.colors.neutral[600], fontFamily: theme.fonts.regular, marginLeft: 4 },
  sectionLabel: { fontSize: 12, fontWeight: '700', color: theme.colors.neutral[500], marginTop: 20, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5, fontFamily: theme.fonts.bold },
  description: { fontSize: 15, color: theme.colors.text, lineHeight: 22, fontFamily: theme.fonts.regular },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 16 },
  locationText: { fontSize: 13, color: theme.colors.textMuted, fontFamily: theme.fonts.regular },
  navigateBtn: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: theme.colors.primary[50], paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  navigateText: { fontSize: 13, color: theme.colors.primary[700], fontWeight: '700', fontFamily: theme.fonts.bold },
  ownerCard: { flexDirection: 'row', alignItems: 'center', marginTop: 16, padding: 12, backgroundColor: theme.colors.surface, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border },
  ownerAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: theme.colors.primary[100], alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginRight: 12 },
  ownerAvatarImg: { width: '100%', height: '100%' },
  ownerInitial: { fontSize: 18, fontWeight: '700', color: theme.colors.primary[700], fontFamily: theme.fonts.bold },
  ownerInfo: { flex: 1 },
  ownerName: { fontSize: 15, fontWeight: '600', color: theme.colors.text, fontFamily: theme.fonts.bold },
  ownerRatingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  ownerRating: { fontSize: 12, color: theme.colors.textMuted, fontFamily: theme.fonts.regular },
  accessSection: { marginTop: 4 },
  requestBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: theme.colors.primary[500], borderRadius: theme.radius.md, paddingVertical: 14 },
  requestBtnText: { color: '#fff', fontSize: 15, fontWeight: '700', fontFamily: theme.fonts.bold },
  accessStatusBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 14, borderRadius: theme.radius.md },
  accessStatusText: { fontSize: 14, fontWeight: '600', fontFamily: theme.fonts.bold, flex: 1 },
  pendingCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, backgroundColor: theme.colors.surface, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border, marginBottom: 8 },
  pendingName: { fontSize: 14, fontWeight: '600', color: theme.colors.text, fontFamily: theme.fonts.bold },
  pendingActions: { flexDirection: 'row', gap: 8 },
  approveBtn: { backgroundColor: '#dcfce7', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  approveBtnText: { color: theme.colors.success, fontSize: 13, fontWeight: '700', fontFamily: theme.fonts.bold },
  rejectBtn: { backgroundColor: '#fee2e2', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  rejectBtnText: { color: theme.colors.error, fontSize: 13, fontWeight: '700', fontFamily: theme.fonts.bold },
  reviewsSection: { marginTop: 4 },
  reviewsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  addReviewBtn: { backgroundColor: theme.colors.primary[50], paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, marginTop: 20 },
  addReviewText: { fontSize: 13, color: theme.colors.primary[700], fontWeight: '700', fontFamily: theme.fonts.bold },
  noReviews: { fontSize: 14, color: theme.colors.textMuted, fontFamily: theme.fonts.regular },
  reviewCard: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.md, padding: 12, borderWidth: 1, borderColor: theme.colors.border, marginBottom: 10 },
  reviewTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  reviewerName: { fontSize: 14, fontWeight: '700', color: theme.colors.text, fontFamily: theme.fonts.bold },
  starsRow: { flexDirection: 'row', gap: 2 },
  reviewComment: { fontSize: 14, color: theme.colors.text, fontFamily: theme.fonts.regular, lineHeight: 20 },
  reviewDate: { fontSize: 11, color: theme.colors.neutral[400], fontFamily: theme.fonts.regular, marginTop: 4 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: theme.colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: theme.colors.text, fontFamily: theme.fonts.bold, marginBottom: 10 },
  modalDesc: { fontSize: 14, color: theme.colors.textMuted, fontFamily: theme.fonts.regular, lineHeight: 20, marginBottom: 20 },
  modalSubLabel: { fontSize: 13, fontWeight: '700', color: theme.colors.neutral[700], fontFamily: theme.fonts.bold, marginBottom: 8, marginTop: 12 },
  payBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: theme.colors.primary[500], borderRadius: theme.radius.md, paddingVertical: 14, marginBottom: 10 },
  payBtnText: { color: '#fff', fontSize: 15, fontWeight: '700', fontFamily: theme.fonts.bold },
  freeRequestBtn: { borderRadius: theme.radius.md, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: theme.colors.border, marginBottom: 10 },
  freeRequestText: { fontSize: 15, color: theme.colors.text, fontWeight: '600', fontFamily: theme.fonts.bold },
  cancelBtn: { alignItems: 'center', paddingVertical: 12 },
  cancelText: { fontSize: 14, color: theme.colors.neutral[500], fontFamily: theme.fonts.regular },
  starSelector: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  reviewInput: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: theme.colors.text, fontFamily: theme.fonts.regular, minHeight: 100, marginBottom: 16 },
});
