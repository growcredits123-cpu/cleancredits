import { useEffect, useState, useCallback } from 'react';
import { StyleSheet, View, Text, FlatList, TouchableOpacity, RefreshControl, Modal, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Send, ArrowDownCircle, ArrowUpCircle, Gift } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { theme } from '@/lib/theme';
import type { LedgerEntry } from '@/lib/types';

export default function WalletScreen() {
  const { session } = useAuth();
  const [balance, setBalance] = useState<number | null>(null);
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showSend, setShowSend] = useState(false);
  const [sendTo, setSendTo] = useState('');
  const [sendAmount, setSendAmount] = useState('');
  const [sendError, setSendError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [showPurchase, setShowPurchase] = useState(false);

  const load = useCallback(async () => {
    if (!session) return;
    const { data: bal } = await supabase.rpc('get_user_balance', { p_user_id: session.user.id });
    setBalance(typeof bal === 'number' ? bal : 0);
    const { data, error } = await supabase
      .from('ledger_entries')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
      .limit(50);
    if (!error) setEntries((data as LedgerEntry[]) || []);
    setLoading(false);
    setRefreshing(false);
  }, [session]);

  useEffect(() => {
    load();

    if (!session) return;

    // Set up live real-time update for ledger entries
    const channel = supabase
      .channel('wallet_updates')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'ledger_entries',
          filter: `user_id=eq.${session.user.id}`
        },
        () => {
          load();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [load, session]);

  async function handleSend() {
    setSendError(null);
    const amount = parseInt(sendAmount, 10);
    if (!sendTo.trim()) return setSendError('Enter a recipient email.');
    if (!amount || amount <= 0) return setSendError('Enter a valid amount.');

    setSending(true);
    const { data, error } = await supabase.rpc('p2p_transfer', {
      p_recipient_email: sendTo.trim(),
      p_amount: amount,
    });
    setSending(false);
    if (error) return setSendError(error.message);
    if (data === false) return setSendError('Transfer failed — check balance and recipient.');
    setShowSend(false);
    setSendTo('');
    setSendAmount('');
    load();
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Wallet</Text>
        <Text style={styles.subtitle}>Your token balance and history</Text>
        <Text style={{ fontSize: 11, color: theme.colors.neutral[400], marginTop: 4, fontFamily: theme.fonts.regular }}>User ID: {session?.user.id}</Text>
      </View>

      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Available balance</Text>
        {balance === null ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.balanceValue}>{balance.toLocaleString()} ◆</Text>
        )}
        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => setShowSend(true)}>
            <Send size={16} color={theme.colors.primary[700]} />
            <Text style={styles.sendBtnText}>Send</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => setShowPurchase(true)}>
            <Gift size={16} color={theme.colors.primary[700]} />
            <Text style={styles.sendBtnText}>Purchase</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.historyHeader}>
        <Text style={styles.historyTitle}>Recent activity</Text>
      </View>

      <FlatList
        data={entries}
        keyExtractor={(i) => i.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        ListEmptyComponent={
          loading ? <ActivityIndicator color={theme.colors.primary[500]} style={{ marginTop: 20 }} /> :
          <View style={styles.empty}><Gift size={36} color={theme.colors.neutral[300]} /><Text style={styles.emptyText}>No transactions yet</Text></View>
        }
        renderItem={({ item }) => {
          const isCredit = item.entry_type === 'credit';
          return (
            <View style={styles.entryRow}>
              <View style={[styles.entryIcon, { backgroundColor: (isCredit ? theme.colors.success : theme.colors.error) + '18' }]}>
                {isCredit ? <ArrowDownCircle size={22} color={theme.colors.success} /> : <ArrowUpCircle size={22} color={theme.colors.error} />}
              </View>
              <View style={styles.entryBody}>
                <Text style={styles.entryKind}>{item.entry_kind.replace(/_/g, ' ')}</Text>
                <Text style={styles.entryDate}>{new Date(item.created_at).toLocaleString()}</Text>
                <Text style={styles.entryTxId} numberOfLines={1} ellipsizeMode="middle">TxID: {item.group_id || item.id}</Text>
              </View>
              <Text style={[styles.entryAmount, { color: isCredit ? theme.colors.success : theme.colors.error }]}>
                {isCredit ? '+' : '-'}{item.amount} ◆
              </Text>
            </View>
          );
        }}
      />

      <Modal visible={showSend} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Send tokens</Text>
            <Text style={styles.modalLabel}>Recipient email</Text>
            <TextInput style={styles.modalInput} value={sendTo} onChangeText={setSendTo} placeholder="friend@example.com" placeholderTextColor={theme.colors.neutral[400]} autoCapitalize="none" keyboardType="email-address" />
            <Text style={styles.modalLabel}>Amount</Text>
            <TextInput style={styles.modalInput} value={sendAmount} onChangeText={setSendAmount} placeholder="10" placeholderTextColor={theme.colors.neutral[400]} keyboardType="numeric" />
            {sendError && <Text style={styles.modalError}>{sendError}</Text>}
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setShowSend(false)}><Text style={styles.modalCancelText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={styles.modalSend} onPress={handleSend} disabled={sending}>
                {sending ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.modalSendText}>Send</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showPurchase} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Purchase tokens</Text>
            <Text style={styles.modalLabel}>Select a package (Demo)</Text>
            
            <TouchableOpacity style={styles.packageBtn} onPress={() => { setShowPurchase(false); alert('In-app purchases coming soon!'); }}>
              <Text style={styles.packageText}>100 Tokens - $4.99</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.packageBtn} onPress={() => { setShowPurchase(false); alert('In-app purchases coming soon!'); }}>
              <Text style={styles.packageText}>500 Tokens - $19.99</Text>
            </TouchableOpacity>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setShowPurchase(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, backgroundColor: theme.colors.surface, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  title: { fontSize: 26, fontWeight: '700', color: theme.colors.text, fontFamily: theme.fonts.bold },
  subtitle: { fontSize: 13, color: theme.colors.textMuted, marginTop: 2, fontFamily: theme.fonts.regular },
  balanceCard: { margin: 16, borderRadius: theme.radius.xl, padding: 24, backgroundColor: theme.colors.primary[600], alignItems: 'center' },
  balanceLabel: { fontSize: 13, color: theme.colors.primary[50], fontFamily: theme.fonts.regular, textTransform: 'uppercase', letterSpacing: 1 },
  balanceValue: { fontSize: 44, fontWeight: '700', color: '#fff', fontFamily: theme.fonts.bold, marginTop: 8 },
  actionButtons: { flexDirection: 'row', gap: 10, marginTop: 16 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#fff', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 20 },
  sendBtnText: { fontSize: 14, fontWeight: '700', color: theme.colors.primary[700], fontFamily: theme.fonts.bold },
  historyHeader: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  historyTitle: { fontSize: 15, fontWeight: '700', color: theme.colors.neutral[700], fontFamily: theme.fonts.bold },
  list: { paddingHorizontal: 16, paddingBottom: 24 },
  empty: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontSize: 14, color: theme.colors.textMuted, marginTop: 12, fontFamily: theme.fonts.regular },
  entryRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.surface, borderRadius: theme.radius.md, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: theme.colors.border },
  entryIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  entryBody: { flex: 1 },
  entryKind: { fontSize: 14, fontWeight: '600', color: theme.colors.text, textTransform: 'capitalize', fontFamily: theme.fonts.bold },
  entryDate: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2, fontFamily: theme.fonts.regular },
  entryTxId: { fontSize: 10, color: theme.colors.neutral[400], marginTop: 2, fontFamily: theme.fonts.regular },
  entryAmount: { fontSize: 16, fontWeight: '700', fontFamily: theme.fonts.bold },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  modalSheet: { backgroundColor: theme.colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 36 },
  modalTitle: { fontSize: 22, fontWeight: '700', color: theme.colors.text, marginBottom: 16, fontFamily: theme.fonts.bold },
  modalLabel: { fontSize: 13, fontWeight: '600', color: theme.colors.neutral[700], marginBottom: 6, marginTop: 10, fontFamily: theme.fonts.bold },
  modalInput: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: theme.colors.text, fontFamily: theme.fonts.regular },
  modalError: { color: theme.colors.error, fontSize: 13, marginTop: 10, fontFamily: theme.fonts.regular },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 20 },
  modalCancel: { flex: 1, paddingVertical: 14, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center' },
  modalCancelText: { fontSize: 15, fontWeight: '600', color: theme.colors.neutral[600], fontFamily: theme.fonts.bold },
  modalSend: { flex: 1, paddingVertical: 14, borderRadius: theme.radius.md, backgroundColor: theme.colors.primary[500], alignItems: 'center' },
  modalSendText: { fontSize: 15, fontWeight: '700', color: '#fff', fontFamily: theme.fonts.bold },
  packageBtn: { padding: 16, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md, marginBottom: 10, alignItems: 'center' },
  packageText: { fontSize: 16, color: theme.colors.text, fontFamily: theme.fonts.bold },
});
