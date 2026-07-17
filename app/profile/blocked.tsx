import { StyleSheet, View, Text, ScrollView } from 'react-native';
import { Ban } from 'lucide-react-native';
import { theme } from '@/lib/theme';

export default function BlockedScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Ban size={48} color={theme.colors.neutral[300]} />
      <Text style={styles.title}>Blocked users</Text>
      <Text style={styles.subtitle}>You haven't blocked anyone.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  title: { fontSize: 20, fontWeight: '700', color: theme.colors.text, marginTop: 16, fontFamily: theme.fonts.bold },
  subtitle: { fontSize: 14, color: theme.colors.textMuted, marginTop: 4, fontFamily: theme.fonts.regular },
});
