import React, { useRef, useEffect, useImperativeHandle, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
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

export function LocationPickerMap({
  initialCoords,
  onLocationSelect,
  pickerRef,
  height = 240,
  onMapInteraction,
}: LocationPickerMapProps) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const lat = initialCoords?.lat ?? DEFAULT_LAT;
  const lng = initialCoords?.lng ?? DEFAULT_LNG;

  useImperativeHandle(pickerRef, () => ({
    setCenter: (newLat: number, newLng: number) => {
      try {
        iframeRef.current?.contentWindow?.postMessage(
          JSON.stringify({ type: 'setCenter', lat: newLat, lng: newLng }),
          '*'
        );
      } catch (e) {}
    },
  }));

  useEffect(() => {
    function handleMessage(e: MessageEvent) {
      try {
        const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
        if (data?.type === 'locationSelect' && typeof data.lat === 'number' && typeof data.lng === 'number') {
          onLocationSelect({ lat: data.lat, lng: data.lng });
        } else if (data?.type === 'mapTouch') {
          onMapInteraction?.(!!data.active);
        }
      } catch (err) {}
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('message', handleMessage);
      return () => window.removeEventListener('message', handleMessage);
    }
  }, [onLocationSelect, onMapInteraction]);

  const htmlContent = useMemo(() => `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
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
          background: #0284c7;
          position: absolute;
          transform: rotate(-45deg);
          left: 50%;
          top: 50%;
          margin: -20px 0 0 -15px;
          box-shadow: 0 4px 12px rgba(2, 132, 199, 0.4);
          border: 2px solid #ffffff;
          cursor: grab;
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
          white-space: nowrap;
        }
        .leaflet-control-zoom {
          border: none !important;
          box-shadow: 0 2px 8px rgba(0,0,0,0.15) !important;
        }
      </style>
    </head>
    <body>
      <div class="hint-badge">📍 Click or drag pin to choose harvest location</div>
      <div id="map"></div>
      <script>
        var map = L.map('map', { zoomControl: true, attributionControl: false }).setView([${lat}, ${lng}], 15);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, subdomains: ['a', 'b', 'c'] }).addTo(map);

        setTimeout(function() {
          map.invalidateSize();
        }, 200);

        window.addEventListener('resize', function() {
          map.invalidateSize();
        });

        var pinIcon = L.divIcon({
          className: 'pin-marker-wrap',
          html: '<div class="pin-marker"></div>',
          iconSize: [30, 30],
          iconAnchor: [15, 30]
        });

        var marker = L.marker([${lat}, ${lng}], { icon: pinIcon, draggable: true }).addTo(map);

        function sendLocation(lat, lng) {
          try {
            window.parent.postMessage(JSON.stringify({
              type: 'locationSelect',
              lat: Number(lat.toFixed(6)),
              lng: Number(lng.toFixed(6))
            }), '*');
          } catch(err) {}
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
            var data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
            if (data.type === 'setCenter') {
              map.setView([data.lat, data.lng], 16);
              marker.setLatLng([data.lat, data.lng]);
            }
          } catch(err) {}
        }

        window.addEventListener('message', handleMessage);
      </script>
    </body>
    </html>
  `, [lat, lng]);

  return (
    <View style={[styles.container, { height }]}>
      <iframe
        ref={iframeRef as any}
        srcDoc={htmlContent}
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          backgroundColor: '#f1f5f9',
        }}
        title="Location Picker Map"
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
});
