import { useState } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { Camera, MapPin, Tag, FileText } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { theme } from '@/lib/theme';
import { encodeGeohash } from '@/lib/geohash';
import { decode } from 'base64-arraybuffer';

export default function PostScreen() {
  const { session } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tokenPrice, setTokenPrice] = useState('1');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function pickImage() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      setError('Photo permission denied.');
      return;
    }
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
    if (status !== 'granted') {
      setError('Location permission denied.');
      return;
    }
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    setCoords({ lat: loc.coords.latitude, lng: loc.coords.longitude });
  }

  async function handleSubmit() {
    setError(null);
    if (!title.trim()) return setError('Please enter a title.');
    if (!imageUri) return setError('Please add a photo.');
    if (!coords) return setError('Please capture your location.');
    const price = parseInt(tokenPrice, 10);
    if (isNaN(price) || price < 0) return setError('Token price must be a number.');

    setBusy(true);
    try {
      if (!imageBase64) throw new Error('Image data is missing.');
      const photoPath = `${session!.user.id}/${Date.now()}.jpg`;
      const { error: upErr } = await supabase.storage
        .from('item-photos')
        .upload(photoPath, decode(imageBase64), { contentType: 'image/jpeg', upsert: false });
      if (upErr) throw new Error(upErr.message);

      const { data: pub } = supabase.storage.from('item-photos').getPublicUrl(photoPath);

      const geohash = encodeGeohash(coords.lat, coords.lng, 12);

      const { error: insErr } = await supabase.from('items').insert({
        owner_id: session!.user.id,
        title: title.trim(),
        description: description.trim(),
        photo_url: pub.publicUrl,
        token_price: price,
        lat: coords.lat,
        lng: coords.lng,
        geohash,
        status: 'available',
      });
      if (insErr) throw new Error(insErr.message);

      setSuccess(true);
      setTitle('');
      setDescription('');
      setTokenPrice('1');
      setImageUri(null);
      setImageBase64(null);
      setCoords(null);
      setTimeout(() => setSuccess(false), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to post item.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Post an item</Text>
          <Text style={styles.subtitle}>List something you no longer need for others to swap.</Text>

        <TouchableOpacity style={styles.photoBox} onPress={pickImage}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.photo} />
          ) : (
            <View style={styles.photoPlaceholder}>
              <Camera size={28} color={theme.colors.neutral[400]} />
              <Text style={styles.photoText}>Add a photo</Text>
            </View>
          )}
        </TouchableOpacity>

        <View style={styles.field}>
          <View style={styles.labelRow}>
            <Tag size={14} color={theme.colors.neutral[500]} />
            <Text style={styles.label}>Title</Text>
          </View>
          <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="e.g. Kids bike, good condition" placeholderTextColor={theme.colors.neutral[400]} />
        </View>

        <View style={styles.field}>
          <View style={styles.labelRow}>
            <FileText size={14} color={theme.colors.neutral[500]} />
            <Text style={styles.label}>Description</Text>
          </View>
          <TextInput style={[styles.input, styles.textarea]} value={description} onChangeText={setDescription} placeholder="Describe the item, condition, size…" placeholderTextColor={theme.colors.neutral[400]} multiline numberOfLines={4} textAlignVertical="top" />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Token price</Text>
          <TextInput style={styles.input} value={tokenPrice} onChangeText={setTokenPrice} placeholder="1" placeholderTextColor={theme.colors.neutral[400]} keyboardType="numeric" />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Location</Text>
          <TouchableOpacity style={styles.locationBtn} onPress={captureLocation}>
            <MapPin size={16} color={theme.colors.primary[600]} />
            <Text style={styles.locationText}>
              {coords ? `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}` : 'Capture GPS location'}
            </Text>
          </TouchableOpacity>
        </View>

        {error && <Text style={styles.error}>{error}</Text>}
        {success && <Text style={styles.success}>Item posted! It's now on the map.</Text>}

        <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={busy}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Post item</Text>}
        </TouchableOpacity>
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  scroll: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40 },
  title: { fontSize: 26, fontWeight: '700', color: theme.colors.text, fontFamily: theme.fonts.bold },
  subtitle: { fontSize: 14, color: theme.colors.textMuted, marginTop: 4, marginBottom: 20, fontFamily: theme.fonts.regular },
  photoBox: { width: '100%', height: 200, borderRadius: theme.radius.lg, overflow: 'hidden', marginBottom: 20, backgroundColor: theme.colors.neutral[100] },
  photo: { width: '100%', height: '100%' },
  photoPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  photoText: { fontSize: 14, color: theme.colors.neutral[400], fontFamily: theme.fonts.regular },
  field: { marginBottom: 16 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  label: { fontSize: 13, fontWeight: '600', color: theme.colors.neutral[700], fontFamily: theme.fonts.bold },
  input: {
    borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md, paddingHorizontal: 14, paddingVertical: 14, fontSize: 16,
    color: theme.colors.text, fontFamily: theme.fonts.regular,
  },
  textarea: { minHeight: 100 },
  locationBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: theme.colors.border,
    backgroundColor: theme.colors.primary[50], borderRadius: theme.radius.md, paddingHorizontal: 14, paddingVertical: 14,
  },
  locationText: { fontSize: 15, color: theme.colors.text, fontFamily: theme.fonts.regular },
  error: { color: theme.colors.error, fontSize: 13, marginBottom: 10, fontFamily: theme.fonts.regular },
  success: { color: theme.colors.success, fontSize: 13, marginBottom: 10, fontFamily: theme.fonts.bold },
  submitBtn: {
    backgroundColor: theme.colors.primary[500], borderRadius: theme.radius.md, paddingVertical: 16,
    alignItems: 'center', marginTop: 8,
  },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '700', fontFamily: theme.fonts.bold },
});
