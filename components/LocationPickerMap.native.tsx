import React, { useRef, useImperativeHandle } from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import { theme } from '@/lib/theme';

export interface LocationPickerRef {
  setCenter: (lat: number, lng: number) => void;
}

interface LocationPickerMapProps {
  initialCoords?: { lat: number; lng: number } | null;
  onLocationSelect: (coords: { lat: number; lng: number }) => void;
  pickerRef?: React.RefObject<LocationPickerRef | null>;
  height?: number;
  onMapInteraction?: (active: boolean) => void;
}

const DEFAULT_LAT = 15.1636;
const DEFAULT_LNG = 120.5715;

export function LocationPickerMap({ initialCoords, onLocationSelect, pickerRef, height = 220, onMapInteraction }: LocationPickerMapProps) {
  const webviewRef = useRef<WebView>(null);
  const lat = initialCoords?.lat ?? DEFAULT_LAT;
  const lng = initialCoords?.lng ?? DEFAULT_LNG;

  useImperativeHandle(pickerRef, () => ({
    setCenter: (newLat: number, newLng: number) => {
      if (webviewRef.current) {
        webviewRef.current.postMessage(JSON.stringify({ type: 'setCenter', lat: newLat, lng: newLng }));
      }
    }
  }));

  const htmlContent = React.useMemo(() => `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body, #map { height: 100%; width: 100%; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f1f5f9; }
        .pin-marker {
          width: 30px;
          height: 30px;
          border-radius: 50% 50% 50% 0;
          background: #059669;
          position: absolute;
          transform: rotate(-45deg);
          left: 50%;
          top: 50%;
          margin: -20px 0 0 -15px;
          box-shadow: 0 4px 12px rgba(5, 150, 105, 0.4);
          border: 2px solid #ffffff;
        }
        .pin-marker::after {
          content: '';
          width: 10px;
          height: 10px;
          margin: 8px 0 0 8px;
          background: #ffffff;
          position: absolute;
          border-radius: 50%;
        }
        .hint-badge {
          position: absolute;
          top: 10px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 1000;
          background: rgba(15, 23, 42, 0.85);
          color: #ffffff;
          padding: 6px 14px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 600;
          pointer-events: none;
          box-shadow: 0 2px 8px rgba(0,0,0,0.25);
          letter-spacing: 0.3px;
        }
      </style>
    </head>
    <body>
      <div class="hint-badge">📍 Tap map to set location pin</div>
      <div id="map"></div>
      <script>
        var map = L.map('map', { zoomControl: false, attributionControl: false }).setView([${lat}, ${lng}], 15);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, subdomains: ['a', 'b', 'c'] }).addTo(map);

        setTimeout(function() {
          map.invalidateSize();
        }, 250);

        var pinIcon = L.divIcon({
          className: 'pin-marker-wrap',
          html: '<div class="pin-marker"></div>',
          iconSize: [30, 30],
          iconAnchor: [15, 30]
        });

        var marker = L.marker([${lat}, ${lng}], { icon: pinIcon, draggable: true }).addTo(map);

        function sendLocation(lat, lng) {
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'locationSelect',
              lat: Number(lat.toFixed(6)),
              lng: Number(lng.toFixed(6))
            }));
          }
        }

        marker.on('dragend', function(e) {
          var position = marker.getLatLng();
          sendLocation(position.lat, position.lng);
        });

        map.on('click', function(e) {
          marker.setLatLng(e.latlng);
          sendLocation(e.latlng.lat, e.latlng.lng);
        });

        function handleMessage(e) {
          try {
            var data = JSON.parse(e.data);
            if (data.type === 'setCenter') {
              map.setView([data.lat, data.lng], 16);
              marker.setLatLng([data.lat, data.lng]);
            }
          } catch(err) {}
        }

        window.addEventListener('message', handleMessage);
        document.addEventListener('message', handleMessage);

        var mapEl = document.getElementById('map');
        mapEl.addEventListener('touchstart', function() {
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'mapTouch', active: true }));
          }
        }, { passive: true });
        mapEl.addEventListener('touchend', function() {
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'mapTouch', active: false }));
          }
        }, { passive: true });
        mapEl.addEventListener('touchcancel', function() {
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'mapTouch', active: false }));
          }
        }, { passive: true });
      </script>
    </body>
    </html>
  `, []);

  return (
    <View style={[styles.container, { height }]}>
      <WebView
        ref={webviewRef}
        source={{ html: htmlContent }}
        style={styles.webview}
        originWhitelist={['*']}
        onMessage={(event) => {
          try {
            const data = JSON.parse(event.nativeEvent.data);
            if (data.type === 'locationSelect') {
              onLocationSelect({ lat: data.lat, lng: data.lng });
            } else if (data.type === 'mapTouch') {
              onMapInteraction?.(data.active);
            }
          } catch (e) {}
        }}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        allowFileAccess={true}
        mixedContentMode="always"
        nestedScrollEnabled={true}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    borderRadius: theme.radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.neutral[100],
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});
