import React, { useRef, useEffect, useImperativeHandle } from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
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
  mapRef?: React.RefObject<MapRef>;
}

export function MapPanel({ region, onRegionChange, items, onItemPress, showsUserLocation, mapRef }: MapPanelProps) {
  const webviewRef = useRef<WebView>(null);

  useImperativeHandle(mapRef, () => ({
    animateToRegion: (newRegion) => {
      if (webviewRef.current) {
        webviewRef.current.postMessage(JSON.stringify({ type: 'setCenter', lat: newRegion.latitude, lng: newRegion.longitude }));
      }
    }
  }));

  const validItems = (items || []).filter(
    (item) => item && typeof item.lat === 'number' && typeof item.lng === 'number' && !isNaN(item.lat) && !isNaN(item.lng)
  );

  const htmlContent = React.useMemo(() => `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <style>
        body { padding: 0; margin: 0; background-color: #f1f5f9; }
        html, body, #map { height: 100%; width: 100%; }
        .custom-marker { background: #059669; border: 2px solid white; border-radius: 50%; width: 26px; height: 26px; box-shadow: 0 2px 6px rgba(0,0,0,0.3); }
        .user-marker { background: #3b82f6; border: 3px solid white; border-radius: 50%; width: 20px; height: 20px; box-shadow: 0 2px 6px rgba(0,0,0,0.3); }
        .locate-btn { position: absolute; bottom: 20px; right: 20px; z-index: 1000; background: white; padding: 10px; border-radius: 50%; box-shadow: 0 2px 6px rgba(0,0,0,0.3); cursor: pointer; font-size: 20px; line-height: 20px; text-align: center; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <div class="locate-btn" onclick="locateUser()">📍</div>
      <script>
        var map = L.map('map', { zoomControl: false, attributionControl: false }).setView([${region.latitude}, ${region.longitude}], 14);
        
        var tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { 
          maxZoom: 19,
          subdomains: ['a', 'b', 'c']
        }).addTo(map);

        setTimeout(function() {
          map.invalidateSize();
        }, 300);

        var markers = {};
        var userMarker = null;
        var currentLat = ${region.latitude};
        var currentLng = ${region.longitude};

        if (${showsUserLocation ? 'true' : 'false'}) {
          var userIcon = L.divIcon({ className: 'user-marker', iconSize: [20, 20], iconAnchor: [10, 10] });
          userMarker = L.marker([currentLat, currentLng], { icon: userIcon, zIndexOffset: 1000 }).addTo(map);
        }

        function locateUser() {
          map.setView([currentLat, currentLng], 14);
        }

        function safePostMessage(msg) {
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify(msg));
          }
        }

        function addMarker(id, lat, lng) {
          var icon = L.divIcon({ className: 'custom-marker', iconSize: [26, 26], iconAnchor: [13, 13] });
          var marker = L.marker([lat, lng], { icon: icon }).addTo(map);
          marker.on('click', function() {
            safePostMessage({ type: 'markerPress', id: id });
          });
          markers[id] = marker;
        }

        map.on('moveend', function() {
          var center = map.getCenter();
          var bounds = map.getBounds();
          var latDelta = bounds.getNorth() - bounds.getSouth();
          var lngDelta = bounds.getEast() - bounds.getWest();
          safePostMessage({
            type: 'regionChange',
            region: { latitude: center.lat, longitude: center.lng, latitudeDelta: latDelta, longitudeDelta: lngDelta }
          });
        });

        function handleMessage(e) {
          try {
            var data = JSON.parse(e.data);
            if (data.type === 'updateItems') {
              for (var id in markers) { map.removeLayer(markers[id]); }
              markers = {};
              if (data.items) {
                data.items.forEach(function(item) { addMarker(item.id, item.lat, item.lng); });
              }
            } else if (data.type === 'setCenter') {
              currentLat = data.lat;
              currentLng = data.lng;
              map.setView([data.lat, data.lng]);
              if (userMarker) userMarker.setLatLng([data.lat, data.lng]);
            }
          } catch(err) {}
        }
        
        window.addEventListener('message', handleMessage);
        document.addEventListener('message', handleMessage);
      </script>
    </body>
    </html>
  `, []);

  useEffect(() => {
    if (webviewRef.current) {
      webviewRef.current.postMessage(JSON.stringify({ type: 'updateItems', items: validItems }));
    }
  }, [items]);

  return (
    <View style={styles.container}>
      <WebView
        ref={webviewRef}
        source={{ html: htmlContent }}
        style={styles.webview}
        originWhitelist={['*']}
        onMessage={(event) => {
          try {
            const data = JSON.parse(event.nativeEvent.data);
            if (data.type === 'markerPress') {
              onItemPress(data.id);
            } else if (data.type === 'regionChange') {
              onRegionChange(data.region);
            }
          } catch (e) {}
        }}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        allowFileAccess={true}
        mixedContentMode="always"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.neutral[100] },
  webview: { flex: 1, backgroundColor: 'transparent' },
});
