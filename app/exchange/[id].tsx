import { useEffect, useState, useCallback, useRef } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, TextInput, KeyboardAvoidingView, Platform, Image, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Send, CheckCircle2, XCircle, Package, Star } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { theme } from '@/lib/theme';
import type { Exchange, Message, Item, User } from '@/lib/types';

interface FullExchange extends Exchange {
  item?: Item;
  requester?: User;
  owner?: User;
}

export default function ExchangeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const insets = useSafeAreaInsets();
  const [exchange, setExchange] = useState<FullExchange | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [showRating, setShowRating] = useState(false);
  const [score, setScore] = useState(5);
  const [comment, setComment] = useState('');
  const [hasRated, setHasRated] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const load = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase
      .from('exchanges')
      .select('id, item_id, requester_id, owner_id, status, created_at, updated_at, requester_confirmed, owner_confirmed, item:items(id, title, photo_url, token_price, description), requester:users!exchanges_requester_id_fkey(id, name, avatar_url, rating_avg), owner:users!exchanges_owner_id_fkey(id, name, avatar_url, rating_avg)')
      .eq('id', id)
      .maybeSingle();
    if (data) {
      setExchange(data as unknown as FullExchange);
      const { data: msgs } = await supabase
        .from('messages')
        .select('*')
        .eq('exchange_id', id)
        .order('created_at', { ascending: true });
      setMessages((msgs as Message[]) || []);

      if ((data as unknown as FullExchange).status === 'completed' && session) {
        const otherId = (data as unknown as FullExchange).requester_id === session.user.id
          ? (data as unknown as FullExchange).owner_id
          : (data as unknown as FullExchange).requester_id;
        const { data: existing } = await supabase
          .from('ratings')
          .select('id')
          .eq('exchange_id', id)
          .eq('from_user', session.user.id)
          .eq('to_user', otherId)
          .maybeSingle();
        setHasRated(!!existing);
      }
    }
    setLoading(false);
  }, [id, session]);

  useEffect(() => { load(); }, [load]);

  // Realtime subscription for messages
  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`messages:${id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `exchange_id=eq.${id}` }, (payload) => {
        setMessages((prev) => [...prev, payload.new as Message]);
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'exchanges', filter: `id=eq.${id}` }, () => {
        load();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [id, load]);

  async function sendMessage(msgText: string) {
    if (!msgText || !session || !id) return;
    await supabase.from('messages').insert({ exchange_id: id, sender_id: session.user.id, text: msgText });
  }

  async function act(rpc: string, label: string) {
    setActing(true);
    const { error } = await supabase.rpc(rpc, { p_exchange_id: id });
    setActing(false);
    if (error) { Alert.alert(label + ' failed', error.message); return; }
    load();
  }

  async function submitRating() {
    if (!exchange || !session) return;
    const otherId = exchange.requester_id === session.user.id ? exchange.owner_id : exchange.requester_id;
    const { error } = await supabase.from('ratings').insert({
      from_user: session.user.id,
      to_user: otherId,
      exchange_id: exchange.id,
      score,
      comment: comment.trim(),
    });
    if (error) { Alert.alert('Rating failed', error.message); return; }
    setShowRating(false);
    setHasRated(true);
    Alert.alert('Thanks!', 'Your rating was submitted.');
  }

  if (loading) return <ActivityIndicator size="large" color={theme.colors.primary[500]} style={{ flex: 1 }} />;
  if (!exchange || !session) return <View style={styles.center}><Text>Exchange not found</Text></View>;

  const isRequester = exchange.requester_id === session.user.id;
  const otherUser = isRequester ? exchange.owner : exchange.requester;
  const status = exchange.status;
  const myConfirmed = isRequester ? (exchange as any).requester_confirmed : (exchange as any).owner_confirmed;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ArrowLeft size={22} color={theme.colors.text} />
          </TouchableOpacity>
          <View style={styles.topTitleWrap}>
            <Text style={styles.topTitle} numberOfLines={1}>{exchange.item?.title || 'Exchange'}</Text>
            <Text style={styles.topSubtext}>{otherUser?.name}</Text>
          </View>
        </View>

      <View style={styles.statusBar}>
        <View style={[styles.statusBadge, { backgroundColor: statusColor(status) + '20' }]}>
          <Text style={[styles.statusText, { color: statusColor(status) }]}>{status.replace('_', ' ')}</Text>
        </View>
        <Text style={styles.priceText}>{exchange.item?.token_price ?? 0} ◆</Text>
      </View>

      <ScrollView ref={scrollRef} style={styles.chatArea} contentContainerStyle={{ padding: 16, paddingBottom: 8 }}>
        {messages.length === 0 ? (
          <View style={styles.chatEmpty}>
            <Package size={32} color={theme.colors.neutral[300]} />
            <Text style={styles.chatEmptyText}>No messages yet. Say hello!</Text>
          </View>
        ) : (
          messages.map((m) => {
            const mine = m.sender_id === session.user.id;
            return (
              <View key={m.id} style={[styles.msgBubble, mine ? styles.msgMine : styles.msgTheirs]}>
                <Text style={[styles.msgText, mine ? styles.msgTextMine : styles.msgTextTheirs]}>{m.text}</Text>
                <Text style={[styles.msgTime, mine ? styles.msgTimeMine : styles.msgTimeTheirs]}>
                  {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Action bar */}
      <View style={styles.actionBar}>
        {status === 'requested' && !isRequester && (
          <>
            <TouchableOpacity style={styles.actBtnAccept} onPress={() => act('accept_exchange_request', 'Accept')} disabled={acting}>
              <Text style={styles.actBtnText}>Accept</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actBtnDecline} onPress={() => act('cancel_exchange', 'Cancel')} disabled={acting}>
              <Text style={styles.actBtnTextDark}>Decline</Text>
            </TouchableOpacity>
          </>
        )}
        {status === 'accepted' && isRequester && (
          <>
            <TouchableOpacity style={styles.actBtnAccept} onPress={() => act('hold_tokens', 'Hold tokens')} disabled={acting}>
              <Text style={styles.actBtnText}>Hold {exchange.item?.token_price ?? 0} ◆</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actBtnDecline} onPress={() => act('cancel_exchange', 'Cancel')} disabled={acting}>
              <Text style={styles.actBtnTextDark}>Cancel</Text>
            </TouchableOpacity>
          </>
        )}
        {status === 'token_held' && (
          <>
            <TouchableOpacity
              style={[styles.actBtnAccept, myConfirmed && styles.actBtnDisabled]}
              onPress={() => act('confirm_pickup', 'Confirm pickup')}
              disabled={acting || myConfirmed}
            >
              <Text style={styles.actBtnText}>{myConfirmed ? 'Pickup confirmed' : 'Confirm pickup'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actBtnDecline} onPress={() => act('cancel_exchange', 'Cancel')} disabled={acting}>
              <Text style={styles.actBtnTextDark}>Cancel</Text>
            </TouchableOpacity>
          </>
        )}
        {status === 'picked_up' && (
          <TouchableOpacity style={styles.actBtnAccept} onPress={() => act('complete_exchange', 'Complete')} disabled={acting}>
            <Text style={styles.actBtnText}>Mark complete</Text>
          </TouchableOpacity>
        )}
        {status === 'completed' && !hasRated && (
          <TouchableOpacity style={styles.actBtnRate} onPress={() => setShowRating(true)}>
            <Star size={16} color="#fff" />
            <Text style={styles.actBtnText}>Rate {otherUser?.name?.split(' ')[0]}</Text>
          </TouchableOpacity>
        )}
        {status === 'completed' && hasRated && (
          <View style={styles.ratedBadge}>
            <CheckCircle2 size={16} color={theme.colors.success} />
            <Text style={styles.ratedText}>Exchange rated</Text>
          </View>
        )}
      </View>

      {/* Message input — available in active states */}
      {['requested', 'accepted', 'token_held', 'picked_up'].includes(status) && (
        <ChatInput onSend={sendMessage} />
      )}

      {/* Rating modal */}
      {showRating && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Rate {otherUser?.name}</Text>
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((s) => (
                <TouchableOpacity key={s} onPress={() => setScore(s)}>
                  <Star size={36} color={s <= score ? theme.colors.warning : theme.colors.neutral[300]} fill={s <= score ? theme.colors.warning : 'none'} />
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={styles.modalInput}
              value={comment}
              onChangeText={setComment}
              placeholder="Leave a comment (optional)"
              placeholderTextColor={theme.colors.neutral[400]}
              multiline
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setShowRating(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSend} onPress={submitRating}>
                <Text style={styles.modalSendText}>Submit</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

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

function ChatInput({ onSend }: { onSend: (text: string) => void }) {
  const [text, setText] = useState('');
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      <TextInput
        style={styles.input}
        value={text}
        onChangeText={setText}
        placeholder="Type a message…"
        placeholderTextColor={theme.colors.neutral[400]}
        multiline
      />
      <TouchableOpacity 
        style={styles.sendBtn} 
        onPress={() => {
          if (text.trim()) {
            onSend(text.trim());
            setText('');
          }
        }} 
        disabled={!text.trim()}
      >
        <Send size={18} color={text.trim() ? '#fff' : theme.colors.neutral[400]} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, backgroundColor: theme.colors.surface, borderBottomWidth: 1, borderBottomColor: theme.colors.border, maxWidth: 800, width: '100%', alignSelf: 'center' },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  topTitleWrap: { flex: 1, marginLeft: 4 },
  topTitle: { fontSize: 16, fontWeight: '700', color: theme.colors.text, fontFamily: theme.fonts.bold },
  topSubtext: { fontSize: 12, color: theme.colors.textMuted, fontFamily: theme.fonts.regular },
  statusBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: theme.colors.surface, maxWidth: 800, width: '100%', alignSelf: 'center' },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: 13, fontWeight: '700', textTransform: 'capitalize', fontFamily: theme.fonts.bold },
  priceText: { fontSize: 16, fontWeight: '700', color: theme.colors.primary[600], fontFamily: theme.fonts.bold },
  chatArea: { flex: 1, maxWidth: 800, width: '100%', alignSelf: 'center' },
  chatEmpty: { alignItems: 'center', paddingVertical: 40 },
  chatEmptyText: { fontSize: 14, color: theme.colors.textMuted, marginTop: 8, fontFamily: theme.fonts.regular },
  msgBubble: { maxWidth: '78%', padding: 10, borderRadius: 14, marginBottom: 8 },
  msgMine: { alignSelf: 'flex-end', backgroundColor: theme.colors.primary[500] },
  msgTheirs: { alignSelf: 'flex-start', backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border },
  msgText: { fontSize: 15, fontFamily: theme.fonts.regular },
  msgTextMine: { color: '#fff' },
  msgTextTheirs: { color: theme.colors.text },
  msgTime: { fontSize: 10, marginTop: 4, fontFamily: theme.fonts.regular },
  msgTimeMine: { color: 'rgba(255,255,255,0.7)' },
  msgTimeTheirs: { color: theme.colors.neutral[400] },
  actionBar: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: theme.colors.surface, borderTopWidth: 1, borderTopColor: theme.colors.border, maxWidth: 800, width: '100%', alignSelf: 'center' },
  actBtnAccept: { flex: 1, backgroundColor: theme.colors.primary[500], borderRadius: theme.radius.md, paddingVertical: 12, alignItems: 'center' },
  actBtnDecline: { flex: 1, backgroundColor: theme.colors.neutral[100], borderRadius: theme.radius.md, paddingVertical: 12, alignItems: 'center' },
  actBtnRate: { flex: 1, flexDirection: 'row', gap: 6, backgroundColor: theme.colors.warning, borderRadius: theme.radius.md, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  actBtnDisabled: { opacity: 0.5 },
  actBtnText: { color: '#fff', fontSize: 14, fontWeight: '700', fontFamily: theme.fonts.bold },
  actBtnTextDark: { color: theme.colors.neutral[700], fontSize: 14, fontWeight: '700', fontFamily: theme.fonts.bold },
  ratedBadge: { flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', paddingVertical: 12 },
  ratedText: { fontSize: 14, fontWeight: '600', color: theme.colors.success, fontFamily: theme.fonts.bold },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 12, paddingTop: 10, backgroundColor: theme.colors.surface, borderTopWidth: 1, borderTopColor: theme.colors.border, maxWidth: 800, width: '100%', alignSelf: 'center' },
  input: { flex: 1, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 15, maxHeight: 100, color: theme.colors.text, backgroundColor: theme.colors.neutral[50], fontFamily: theme.fonts.regular },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: theme.colors.primary[500], alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
  modalOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalSheet: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.xl, padding: 24, maxWidth: 480, width: '100%' },
  modalTitle: { fontSize: 20, fontWeight: '700', color: theme.colors.text, marginBottom: 16, fontFamily: theme.fonts.bold },
  starsRow: { flexDirection: 'row', justifyContent: 'center', gap: 12, marginBottom: 16 },
  modalInput: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: theme.colors.text, minHeight: 60, fontFamily: theme.fonts.regular },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 16 },
  modalCancel: { flex: 1, paddingVertical: 14, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center' },
  modalCancelText: { fontSize: 15, fontWeight: '600', color: theme.colors.neutral[600], fontFamily: theme.fonts.bold },
  modalSend: { flex: 1, paddingVertical: 14, borderRadius: theme.radius.md, backgroundColor: theme.colors.primary[500], alignItems: 'center' },
  modalSendText: { fontSize: 15, fontWeight: '700', color: '#fff', fontFamily: theme.fonts.bold },
});
