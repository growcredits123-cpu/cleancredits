import React, { useImperativeHandle } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { theme } from '@/lib/theme';
import { MapPin } from 'lucide-react-native';

export interface LocationPickerRef {
  setCenter: (lat: number, lng: number) => void;
}

interface LocationPickerMapProps {
  initialCoords?: { lat: number; lng: number } | null;
  onLocationSelect: (coords: { lat: number; lng: number }) => void;
  pickerRef?: React.RefObject<LocationPickerRef | null>;
  height?: number;
}

export function LocationPickerMap({ initialCoords, pickerRef, height = 220 }: LocationPickerMapProps) {
  useImperativeHandle(pickerRef, () => ({
    setCenter: () => {}
  }));

  const lat = initialCoords?.lat ? initialCoords.lat.toFixed(4) : '15.1636';
  const lng = initialCoords?.lng ? initialCoords.lng.toFixed(4) : '120.5715';

  return (
    <View style={[styles.fallback, { height }]}>
      <MapPin size={28} color={theme.colors.primary[600]} />
      <Text style={styles.fallbackText}>Interactive Geo Map Location Picker</Text>
      <Text style={styles.coordsText}>Selected: {lat}, {lng}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    width: '100%',
    borderRadius: theme.radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 6,
  },
  fallbackText: { fontSize: 13, fontWeight: '600', color: theme.colors.neutral[700], fontFamily: theme.fonts.bold },
  coordsText: { fontSize: 14, fontWeight: '700', color: theme.colors.primary[700], fontFamily: theme.fonts.bold },
});
