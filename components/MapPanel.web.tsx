import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { theme } from '@/lib/theme';
import type { Item } from '@/lib/types';

export interface MapRef {
  animateToRegion: (region: { latitude: number; longitude: number }, duration?: number) => void;
}

interface MapPanelProps {
  region: { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number };
  onRegionChange: (r: any) => void;
  items: Item[];
  onItemPress: (id: string) => void;
  showsUserLocation?: boolean;
  mapRef?: any;
}

export function MapPanel({ items }: MapPanelProps) {
  return (
    <View style={styles.fallback}>
      <ActivityIndicator color={theme.colors.primary[500]} />
      <Text style={styles.fallbackText}>Map view is available on mobile devices.</Text>
      <Text style={styles.fallbackSubtext}>{items?.length || 0} items nearby</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.neutral[100], gap: 8 },
  fallbackText: { fontSize: 14, color: theme.colors.textMuted, fontFamily: theme.fonts.regular },
  fallbackSubtext: { fontSize: 16, fontWeight: '700', color: theme.colors.text, fontFamily: theme.fonts.bold },
});
