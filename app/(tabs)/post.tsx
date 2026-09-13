import { useState, useRef, useEffect } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform, Image, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { Camera, MapPin, Tag, FileText, Compass, Video } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { theme } from '@/lib/theme';
import { encodeGeohash } from '@/lib/geohash';
import { decode } from 'base64-arraybuffer';
import { LocationPickerMap, LocationPickerRef } from '@/components/LocationPickerMap';

const CATEGORIES = [
  { id: 'fruit', label: 'Fruit' },
  { id: 'vegetable', label: 'Vegetable' },
  { id: 'tree', label: 'Tree' },
  { id: 'seed', label: 'Seed' },
];

export default function PostScreen() {
  const { session } = useAuth();
  const pickerRef = useRef<LocationPickerRef>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('fruit');
  const [tokenPrice, setTokenPrice] = useState('1');
  
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  
  const [imageUri2, setImageUri2] = useState<string | null>(null);
  const [imageBase642, setImageBase642] = useState<string | null>(null);
  
  const [videoUri, setVideoUri] = useState<string | null>(null);
  
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [locating, setLocating] = useState(false);
  const [mapScrollEnabled, setMapScrollEnabled] = useState(true);

  useEffect(() => {
    captureLocation();
  }, []);

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

  function handlePhotoOption(index: 1 | 2) {
    if (Platform.OS === 'web') {
      pickImage(index);
      return;
    }
    Alert.alert(
      'Add Photo',
      'Choose a photo source',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Take Photo', onPress: () => takePhoto(index) },
        { text: 'Choose from Gallery', onPress: () => pickImage(index) }
      ]
    );
  }

  async function takePhoto(index: 1 | 2) {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      setError('Camera permission denied.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsEditing: true,
      aspect: [4, 3],
      base64: true,
    });
    if (!result.canceled && result.assets[0]) {
      const b64 = await getAssetBase64(result.assets[0]);
      if (index === 1) {
        setImageUri(result.assets[0].uri);
        setImageBase64(b64 || null);
      } else {
        setImageUri2(result.assets[0].uri);
        setImageBase642(b64 || null);
      }
    }
  }

  async function pickImage(index: 1 | 2) {
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
      const b64 = await getAssetBase64(result.assets[0]);
      if (index === 1) {
        setImageUri(result.assets[0].uri);
        setImageBase64(b64 || null);
      } else {
        setImageUri2(result.assets[0].uri);
        setImageBase642(b64 || null);
      }
    }
  }

  async function pickVideo() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      setError('Video permission denied.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: true,
      quality: 1,
    });
    if (!result.canceled && result.assets[0]) {
      setVideoUri(result.assets[0].uri);
    }
  }

  async function captureLocation() {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError('Location permission denied. Please select a position on the map.');
        setLocating(false);
        return;
      }
      let loc = await Location.getLastKnownPositionAsync();
      if (!loc) {
        try {
          loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Lowest });
        } catch (e) {}
      }
      if (loc) {
        const newCoords = { lat: loc.coords.latitude, lng: loc.coords.longitude };
        setCoords(newCoords);
        pickerRef.current?.setCenter(newCoords.lat, newCoords.lng);
      }
    } catch (e) {
      // Fallback
    } finally {
      setLocating(false);
    }
  }

  function handleLocationSelect(selectedCoords: { lat: number; lng: number }) {
    setCoords(selectedCoords);
  }

  async function handleSubmit() {
    setError(null);
    if (!title.trim()) return setError('Please enter a title.');
    if (!imageUri || !imageUri2) return setError('2 Photos are required.');
    if (category === 'seed' && !videoUri) return setError('A video showing planting is required for seeds.');
    if (!coords) return setError('Please mark a location on the Geo Map.');
    const price = parseInt(tokenPrice, 10);
    if (isNaN(price) || price < 0) return setError('Token price must be a number.');

    setBusy(true);
    try {
      if (!imageBase64 || !imageBase642) throw new Error('Image data is missing.');
      const photoPath1 = `${session!.user.id}/${Date.now()}_1.jpg`;
      const photoPath2 = `${session!.user.id}/${Date.now()}_2.jpg`;
      
      const { error: upErr1 } = await supabase.storage
        .from('item-photos')
        .upload(photoPath1, decode(imageBase64), { contentType: 'image/jpeg', upsert: false });
      if (upErr1) throw new Error(upErr1.message);

      const { error: upErr2 } = await supabase.storage
        .from('item-photos')
        .upload(photoPath2, decode(imageBase642), { contentType: 'image/jpeg', upsert: false });
      if (upErr2) throw new Error(upErr2.message);

      let videoPath = null;
      let finalVideoUrl = null;
      if (category === 'seed' && videoUri) {
        videoPath = `${session!.user.id}/${Date.now()}_video.mp4`;
        const resp = await fetch(videoUri);
        const blob = await resp.blob();
        const { error: vidErr } = await supabase.storage
          .from('item-photos')
          .upload(videoPath, blob, { contentType: 'video/mp4', upsert: false });
        if (vidErr) throw new Error(vidErr.message);
        finalVideoUrl = supabase.storage.from('item-photos').getPublicUrl(videoPath).data.publicUrl;
      }

      const pub1 = supabase.storage.from('item-photos').getPublicUrl(photoPath1).data.publicUrl;
      // Note: We use photo_url for photo 1. We might not have photo_url_2 in DB yet, but we will add it.

      const geohash = encodeGeohash(coords.lat, coords.lng, 12);

      const { error: insErr } = await supabase.from('items').insert({
        owner_id: session!.user.id,
        title: title.trim(),
        description: description.trim(),
        category: category,
        photo_url: pub1,
        // We pass this assuming we update the schema later or it just ignores it if not strictly typed
        // photo_url_2: pub2,
        // video_url: finalVideoUrl,
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
      setImageUri2(null);
      setImageBase642(null);
      setVideoUri(null);
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
        <ScrollView scrollEnabled={mapScrollEnabled} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Post a listing</Text>
          <Text style={styles.subtitle}>List your fruit, vegetable, tree, or seed to the FruitMap.</Text>

          <View style={styles.categoryRow}>
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat.id}
                style={[styles.categoryBtn, category === cat.id && styles.categoryBtnActive]}
                onPress={() => setCategory(cat.id)}
              >
                <Text style={[styles.categoryText, category === cat.id && styles.categoryTextActive]}>
                  {cat.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.photosContainer}>
            <TouchableOpacity style={styles.photoBoxHalf} onPress={() => handlePhotoOption(1)}>
              {imageUri ? (
                <Image source={{ uri: imageUri }} style={styles.photo} />
              ) : (
                <View style={styles.photoPlaceholder}>
                  <Camera size={24} color={theme.colors.neutral[400]} />
                  <Text style={styles.photoText}>Photo 1 *</Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.photoBoxHalf} onPress={() => handlePhotoOption(2)}>
              {imageUri2 ? (
                <Image source={{ uri: imageUri2 }} style={styles.photo} />
              ) : (
                <View style={styles.photoPlaceholder}>
                  <Camera size={24} color={theme.colors.neutral[400]} />
                  <Text style={styles.photoText}>Photo 2 *</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {category === 'seed' && (
            <TouchableOpacity style={styles.photoBox} onPress={pickVideo}>
              {videoUri ? (
                <View style={styles.photoPlaceholder}>
                  <Video size={28} color={theme.colors.primary[500]} />
                  <Text style={styles.photoText}>Video Selected</Text>
                </View>
              ) : (
                <View style={styles.photoPlaceholder}>
                  <Video size={28} color={theme.colors.neutral[400]} />
                  <Text style={styles.photoText}>Add planting video (Required)</Text>
                </View>
              )}
            </TouchableOpacity>
          )}

          <View style={styles.field}>
            <View style={styles.labelRow}>
              <Tag size={14} color={theme.colors.neutral[500]} />
              <Text style={styles.label}>Title</Text>
            </View>
            <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="e.g. Fresh Mangoes, Oak Tree..." placeholderTextColor={theme.colors.neutral[400]} />
          </View>

          <View style={styles.field}>
            <View style={styles.labelRow}>
              <FileText size={14} color={theme.colors.neutral[500]} />
              <Text style={styles.label}>Description</Text>
            </View>
            <TextInput style={[styles.input, styles.textarea]} value={description} onChangeText={setDescription} placeholder="Describe the item, rules for picking, permissions..." placeholderTextColor={theme.colors.neutral[400]} multiline numberOfLines={4} textAlignVertical="top" />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Tokens required (0 for free)</Text>
            <TextInput style={styles.input} value={tokenPrice} onChangeText={setTokenPrice} placeholder="1" placeholderTextColor={theme.colors.neutral[400]} keyboardType="numeric" />
          </View>

          <View style={styles.field}>
            <View style={styles.labelRow}>
              <MapPin size={14} color={theme.colors.primary[600]} />
              <Text style={styles.label}>Location (Geo Map)</Text>
            </View>
            
            <LocationPickerMap
              initialCoords={coords}
              onLocationSelect={handleLocationSelect}
              pickerRef={pickerRef}
              height={220}
              onMapInteraction={(active: boolean) => setMapScrollEnabled(!active)}
            />

            <View style={styles.locationMetaRow}>
              <View style={styles.coordsBadge}>
                <MapPin size={14} color={theme.colors.primary[600]} />
                <Text style={styles.coordsText}>
                  {coords ? `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}` : 'Tap map to mark location'}
                </Text>
              </View>

              <TouchableOpacity style={styles.gpsBtn} onPress={captureLocation} disabled={locating}>
                {locating ? (
                  <ActivityIndicator size="small" color={theme.colors.primary[600]} />
                ) : (
                  <>
                    <Compass size={14} color={theme.colors.primary[600]} />
                    <Text style={styles.gpsText}>Use My GPS</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {error && <Text style={styles.error}>{error}</Text>}
          {success && <Text style={styles.success}>Posted successfully to FruitMap!</Text>}

          <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={busy}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Post to map</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  scroll: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40, maxWidth: 720, width: '100%', alignSelf: 'center' },
  title: { fontSize: 26, fontWeight: '700', color: theme.colors.text, fontFamily: theme.fonts.bold },
  subtitle: { fontSize: 14, color: theme.colors.textMuted, marginTop: 4, marginBottom: 20, fontFamily: theme.fonts.regular },
  categoryRow: { flexDirection: 'row', gap: 8, marginBottom: 20, flexWrap: 'wrap' },
  categoryBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: theme.colors.neutral[100], borderWidth: 1, borderColor: theme.colors.neutral[200] },
  categoryBtnActive: { backgroundColor: theme.colors.primary[50], borderColor: theme.colors.primary[500] },
  categoryText: { fontSize: 14, color: theme.colors.neutral[600], fontFamily: theme.fonts.regular },
  categoryTextActive: { color: theme.colors.primary[700], fontFamily: theme.fonts.bold },
  photosContainer: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  photoBoxHalf: { flex: 1, height: 120, borderRadius: theme.radius.lg, overflow: 'hidden', backgroundColor: theme.colors.neutral[100] },
  photoBox: { width: '100%', height: 120, borderRadius: theme.radius.lg, overflow: 'hidden', marginBottom: 20, backgroundColor: theme.colors.neutral[100] },
  photo: { width: '100%', height: '100%' },
  photoPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  photoText: { fontSize: 13, color: theme.colors.neutral[500], fontFamily: theme.fonts.regular },
  field: { marginBottom: 16 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  label: { fontSize: 13, fontWeight: '600', color: theme.colors.neutral[700], fontFamily: theme.fonts.bold },
  input: {
    borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md, paddingHorizontal: 14, paddingVertical: 14, fontSize: 16,
    color: theme.colors.text, fontFamily: theme.fonts.regular,
  },
  textarea: { minHeight: 100 },
  locationMetaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, gap: 10 },
  coordsBadge: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface, borderRadius: theme.radius.md, paddingHorizontal: 12, paddingVertical: 10,
  },
  coordsText: { fontSize: 14, color: theme.colors.text, fontFamily: theme.fonts.regular },
  gpsBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: theme.colors.primary[50],
    borderWidth: 1, borderColor: theme.colors.primary[100], borderRadius: theme.radius.md,
    paddingHorizontal: 12, paddingVertical: 10,
  },
  gpsText: { fontSize: 13, fontWeight: '700', color: theme.colors.primary[700], fontFamily: theme.fonts.bold },
  error: { color: theme.colors.error, fontSize: 13, marginBottom: 10, fontFamily: theme.fonts.regular },
  success: { color: theme.colors.success, fontSize: 13, marginBottom: 10, fontFamily: theme.fonts.bold },
  submitBtn: {
    backgroundColor: theme.colors.primary[500], borderRadius: theme.radius.md, paddingVertical: 16,
    alignItems: 'center', marginTop: 8,
  },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '700', fontFamily: theme.fonts.bold },
});
