import { useState, useCallback, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, Image, ActivityIndicator, Alert, Platform, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { Camera, MapPin, Recycle, CheckCircle2, AlertTriangle } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { theme } from '@/lib/theme';
import { encodeGeohash } from '@/lib/geohash';
import type { RecyclingSpot } from '@/lib/types';
import { decode } from 'base64-arraybuffer';

export default function RecycleScreen() {
  const { session } = useAuth();
  const [spots, setSpots] = useState<RecyclingSpot[]>([]);
  const [loading, setLoading] = useState(true);
  const [reporting, setReporting] = useState(false);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('recycling_spots')
      .select('id, user_id, lat, lng, photo_url, status, geohash, created_at, user:users!recycling_spots_user_id_fkey(id, name, avatar_url)')
      .eq('status', 'approved')
      .order('created_at', { ascending: false })
      .limit(50);
    setSpots((data as unknown as RecyclingSpot[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function pickImage() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { setError('Photo permission denied.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsEditing: true,
      aspect: [4, 3],
      base64: true,
    });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
      setImageBase64(result.assets[0].base64 || null);
    }
  }

  async function captureLocation() {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') { setError('Location permission denied.'); return; }
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    setCoords({ lat: loc.coords.latitude, lng: loc.coords.longitude });
  }

  async function submitReport() {
    setError(null);
    if (!imageUri) return setError('Please add a photo.');
    if (!coords) return setError('Please capture your location.');
    if (!session) return;

    setBusy(true);
    try {
      const geohash = encodeGeohash(coords.lat, coords.lng, 12);
      const prefix = geohash.slice(0, 8);

      // Duplicate check: any approved spot within the same geohash prefix (~38m)
      const { data: nearby } = await supabase
        .from('recycling_spots')
        .select('id')
        .eq('status', 'approved')
        .like('geohash', prefix + '%')
        .limit(1);

      if (nearby && nearby.length > 0) {
        setError('A recycling spot already exists near this location (within ~20m).');
        setBusy(false);
        return;
      }

      if (!imageBase64) throw new Error('Image data is missing.');
      const photoPath = `${session.user.id}/${Date.now()}.jpg`;
      const { error: upErr } = await supabase.storage
        .from('recycling-photos')
        .upload(photoPath, decode(imageBase64), { contentType: 'image/jpeg', upsert: false });
      if (upErr) throw new Error(upErr.message);

      const { data: pub } = supabase.storage.from('recycling-photos').getPublicUrl(photoPath);

      const { error: insErr } = await supabase.from('recycling_spots').insert({
        user_id: session.user.id,
        lat: coords.lat,
        lng: coords.lng,
        photo_url: pub.publicUrl,
        photo_path: photoPath,
        status: 'pending',
        geohash,
      });
      if (insErr) throw new Error(insErr.message);

      setSuccess(true);
      setImageUri(null);
      setImageBase64(null);
      setCoords(null);
      setTimeout(() => { setSuccess(false); setReporting(false); }, 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Submission failed.');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <ActivityIndicator size="large" color={theme.colors.primary[500]} style={{ flex: 1 }} />;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <View style={styles.header}>
          <Text style={styles.title}>Recycling spots</Text>
          <Text style={styles.subtitle}>Find drop-off points or report a new one to earn tokens.</Text>
        </View>

      {!reporting ? (
        <>
          <TouchableOpacity style={styles.reportBtn} onPress={() => { setReporting(true); setError(null); }}>
            <Recycle size={20} color="#fff" />
            <Text style={styles.reportBtnText}>Report a new spot</Text>
          </TouchableOpacity>

          <Text style={styles.sectionTitle}>Approved spots near you</Text>
          {spots.length === 0 ? (
            <View style={styles.empty}>
              <Recycle size={36} color={theme.colors.neutral[300]} />
              <Text style={styles.emptyText}>No approved spots yet</Text>
              <Text style={styles.emptySubtext}>Be the first to report one and earn tokens!</Text>
            </View>
          ) : (
            <View style={styles.spotList}>
              {spots.map((spot) => (
                <View key={spot.id} style={styles.spotCard}>
                  {spot.photo_url && <Image source={{ uri: spot.photo_url }} style={styles.spotPhoto} />}
                  <View style={styles.spotBody}>
                    <View style={styles.spotMetaRow}>
                      <MapPin size={14} color={theme.colors.primary[600]} />
                      <Text style={styles.spotCoords}>{spot.lat.toFixed(4)}, {spot.lng.toFixed(4)}</Text>
                    </View>
                    <Text style={styles.spotUser}>Reported by {(spot as any).user?.name || 'Community'}</Text>
                  </View>
                  <CheckCircle2 size={20} color={theme.colors.success} />
                </View>
              ))}
            </View>
          )}
        </>
      ) : (
        <View style={styles.form}>
          <Text style={styles.formTitle}>Report a recycling spot</Text>

          <TouchableOpacity style={styles.photoBox} onPress={pickImage}>
            {imageUri ? (
              <Image source={{ uri: imageUri }} style={styles.photo} />
            ) : (
              <View style={styles.photoPlaceholder}>
                <Camera size={28} color={theme.colors.neutral[400]} />
                <Text style={styles.photoText}>Add a photo of the spot</Text>
              </View>
            )}
          </TouchableOpacity>

          <View style={styles.field}>
            <Text style={styles.label}>Location</Text>
            <TouchableOpacity style={styles.locationBtn} onPress={captureLocation}>
              <MapPin size={16} color={theme.colors.primary[600]} />
              <Text style={styles.locationText}>
                {coords ? `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}` : 'Capture GPS location'}
              </Text>
            </TouchableOpacity>
          </View>

          {error && (
            <View style={styles.errorBox}>
              <AlertTriangle size={16} color={theme.colors.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
          {success && (
            <View style={styles.successBox}>
              <CheckCircle2 size={16} color={theme.colors.success} />
              <Text style={styles.successText}>Spot submitted! Admin will review it. You'll earn tokens on approval.</Text>
            </View>
          )}

          <View style={styles.formActions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => { setReporting(false); setImageUri(null); setImageBase64(null); setCoords(null); setError(null); }}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.submitBtn} onPress={submitReport} disabled={busy}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Submit</Text>}
            </TouchableOpacity>
          </View>
        </View>
      )}
    </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 16, backgroundColor: theme.colors.surface, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  title: { fontSize: 26, fontWeight: '700', color: theme.colors.text, fontFamily: theme.fonts.bold },
  subtitle: { fontSize: 13, color: theme.colors.textMuted, marginTop: 4, fontFamily: theme.fonts.regular },
  reportBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, margin: 16, backgroundColor: theme.colors.primary[500], paddingVertical: 14, borderRadius: theme.radius.md },
  reportBtnText: { color: '#fff', fontSize: 15, fontWeight: '700', fontFamily: theme.fonts.bold },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: theme.colors.neutral[700], paddingHorizontal: 20, marginBottom: 12, fontFamily: theme.fonts.bold },
  empty: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 24 },
  emptyText: { fontSize: 16, fontWeight: '700', color: theme.colors.text, marginTop: 12, fontFamily: theme.fonts.bold },
  emptySubtext: { fontSize: 14, color: theme.colors.textMuted, textAlign: 'center', marginTop: 4, fontFamily: theme.fonts.regular },
  spotList: { paddingHorizontal: 16, gap: 10 },
  spotCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.surface, borderRadius: theme.radius.md, padding: 10, borderWidth: 1, borderColor: theme.colors.border, overflow: 'hidden' },
  spotPhoto: { width: 56, height: 56, borderRadius: theme.radius.sm, marginRight: 12 },
  spotBody: { flex: 1 },
  spotMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  spotCoords: { fontSize: 13, color: theme.colors.text, fontFamily: theme.fonts.regular },
  spotUser: { fontSize: 11, color: theme.colors.textMuted, marginTop: 2, fontFamily: theme.fonts.regular },
  form: { padding: 20 },
  formTitle: { fontSize: 20, fontWeight: '700', color: theme.colors.text, marginBottom: 16, fontFamily: theme.fonts.bold },
  photoBox: { width: '100%', height: 180, borderRadius: theme.radius.lg, overflow: 'hidden', marginBottom: 16, backgroundColor: theme.colors.neutral[100] },
  photo: { width: '100%', height: '100%' },
  photoPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  photoText: { fontSize: 14, color: theme.colors.neutral[400], fontFamily: theme.fonts.regular },
  field: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: theme.colors.neutral[700], marginBottom: 6, fontFamily: theme.fonts.bold },
  locationBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.primary[50], borderRadius: theme.radius.md, paddingHorizontal: 14, paddingVertical: 14 },
  locationText: { fontSize: 15, color: theme.colors.text, fontFamily: theme.fonts.regular },
  errorBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: theme.colors.error + '10', borderRadius: theme.radius.md, padding: 12, marginBottom: 12 },
  errorText: { flex: 1, fontSize: 13, color: theme.colors.error, fontFamily: theme.fonts.regular },
  successBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: theme.colors.success + '12', borderRadius: theme.radius.md, padding: 12, marginBottom: 12 },
  successText: { flex: 1, fontSize: 13, color: theme.colors.success, fontFamily: theme.fonts.regular },
  formActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center' },
  cancelText: { fontSize: 15, fontWeight: '600', color: theme.colors.neutral[600], fontFamily: theme.fonts.bold },
  submitBtn: { flex: 1, paddingVertical: 14, borderRadius: theme.radius.md, backgroundColor: theme.colors.primary[500], alignItems: 'center' },
  submitText: { fontSize: 15, fontWeight: '700', color: '#fff', fontFamily: theme.fonts.bold },
});
