import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  PanResponder,
  Animated,
  StatusBar,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, ZoomIn, ZoomOut, RotateCcw, Search, Move } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

interface ImageViewerModalProps {
  visible: boolean;
  imageUri: string | null;
  title?: string;
  onClose: () => void;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const MIN_SCALE = 1.0;
const MAX_SCALE = 5.0;

export function ImageViewerModal({
  visible,
  imageUri,
  title,
  onClose,
}: ImageViewerModalProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  const currentScale = useRef(1);
  const currentTranslateX = useRef(0);
  const currentTranslateY = useRef(0);

  const [displayScale, setDisplayScale] = useState(1);

  // Keep ref in sync with animated values
  useEffect(() => {
    const scaleId = scale.addListener(({ value }) => {
      currentScale.current = value;
      setDisplayScale(value);
    });
    const txId = translateX.addListener(({ value }) => {
      currentTranslateX.current = value;
    });
    const tyId = translateY.addListener(({ value }) => {
      currentTranslateY.current = value;
    });

    return () => {
      scale.removeListener(scaleId);
      translateX.removeListener(txId);
      translateY.removeListener(tyId);
    };
  }, [scale, translateX, translateY]);

  // Reset transform when modal opens/closes
  const resetZoom = useCallback((animate = true) => {
    if (animate) {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch (e) {}
      Animated.parallel([
        Animated.spring(scale, {
          toValue: 1,
          useNativeDriver: true,
          bounciness: 4,
        }),
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: true,
          bounciness: 4,
        }),
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          bounciness: 4,
        }),
      ]).start();
    } else {
      scale.setValue(1);
      translateX.setValue(0);
      translateY.setValue(0);
    }
  }, [scale, translateX, translateY]);

  useEffect(() => {
    if (visible) {
      resetZoom(false);
    }
  }, [visible, resetZoom]);

  const triggerHaptic = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (e) {}
  };

  // Step zoom in / out
  const zoomIn = () => {
    triggerHaptic();
    const nextScale = Math.min(currentScale.current + 0.5, MAX_SCALE);
    Animated.spring(scale, {
      toValue: nextScale,
      useNativeDriver: true,
      bounciness: 2,
    }).start();
  };

  const zoomOut = () => {
    triggerHaptic();
    const nextScale = Math.max(currentScale.current - 0.5, MIN_SCALE);
    if (nextScale <= 1.05) {
      resetZoom(true);
    } else {
      Animated.spring(scale, {
        toValue: nextScale,
        useNativeDriver: true,
        bounciness: 2,
      }).start();
    }
  };

  // Magnifier toggle: jump directly to 2.5x or reset to 1x
  const toggleMagnifier = () => {
    triggerHaptic();
    if (currentScale.current > 1.3) {
      resetZoom(true);
    } else {
      Animated.spring(scale, {
        toValue: 2.5,
        useNativeDriver: true,
        bounciness: 3,
      }).start();
    }
  };

  // Double tap state
  const lastTapRef = useRef<number>(0);

  // Gesture tracking refs
  const pinchStartDistRef = useRef<number | null>(null);
  const pinchStartScaleRef = useRef<number>(1);
  const panStartOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,

      onPanResponderGrant: (evt) => {
        const touches = evt.nativeEvent.touches;
        const now = Date.now();

        // Double tap detection
        if (touches.length === 1) {
          if (now - lastTapRef.current < 300) {
            // Double tap triggered
            toggleMagnifier();
            lastTapRef.current = 0;
            return;
          }
          lastTapRef.current = now;
        }

        if (touches.length === 2) {
          // Pinch gesture start
          const dx = touches[0].pageX - touches[1].pageX;
          const dy = touches[0].pageY - touches[1].pageY;
          pinchStartDistRef.current = Math.sqrt(dx * dx + dy * dy);
          pinchStartScaleRef.current = currentScale.current;
        } else if (touches.length === 1) {
          // Pan gesture start
          panStartOffsetRef.current = {
            x: currentTranslateX.current,
            y: currentTranslateY.current,
          };
        }
      },

      onPanResponderMove: (evt, gestureState) => {
        const touches = evt.nativeEvent.touches;

        if (touches.length === 2) {
          // 2-finger pinch zoom
          const dx = touches[0].pageX - touches[1].pageX;
          const dy = touches[0].pageY - touches[1].pageY;
          const currentDist = Math.sqrt(dx * dx + dy * dy);

          if (pinchStartDistRef.current && pinchStartDistRef.current > 0) {
            const factor = currentDist / pinchStartDistRef.current;
            const newScale = Math.min(
              Math.max(pinchStartScaleRef.current * factor, 0.8),
              MAX_SCALE + 0.5
            );
            scale.setValue(newScale);
          }
        } else if (touches.length === 1 && currentScale.current > 1.05) {
          // Pan when zoomed in
          const maxTx = (SCREEN_WIDTH * (currentScale.current - 1)) / 2 + 50;
          const maxTy = (SCREEN_HEIGHT * 0.7 * (currentScale.current - 1)) / 2 + 50;

          const newX = Math.min(
            Math.max(panStartOffsetRef.current.x + gestureState.dx, -maxTx),
            maxTx
          );
          const newY = Math.min(
            Math.max(panStartOffsetRef.current.y + gestureState.dy, -maxTy),
            maxTy
          );

          translateX.setValue(newX);
          translateY.setValue(newY);
        }
      },

      onPanResponderRelease: () => {
        pinchStartDistRef.current = null;

        // Snap back bounds if over-scaled or under-scaled
        if (currentScale.current < 1.05) {
          resetZoom(true);
        } else if (currentScale.current > MAX_SCALE) {
          Animated.spring(scale, {
            toValue: MAX_SCALE,
            useNativeDriver: true,
          }).start();
        }

        // Clamp translation within view bounds
        if (currentScale.current > 1.05) {
          const maxTx = Math.max(0, (SCREEN_WIDTH * (currentScale.current - 1)) / 2);
          const maxTy = Math.max(0, (SCREEN_HEIGHT * 0.7 * (currentScale.current - 1)) / 2);

          const clampedX = Math.min(Math.max(currentTranslateX.current, -maxTx), maxTx);
          const clampedY = Math.min(Math.max(currentTranslateY.current, -maxTy), maxTy);

          if (clampedX !== currentTranslateX.current || clampedY !== currentTranslateY.current) {
            Animated.parallel([
              Animated.spring(translateX, { toValue: clampedX, useNativeDriver: true }),
              Animated.spring(translateY, { toValue: clampedY, useNativeDriver: true }),
            ]).start();
          }
        }
      },
    })
  ).current;

  if (!visible || !imageUri) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <StatusBar barStyle="light-content" backgroundColor="rgba(0,0,0,0.95)" />
      <View style={styles.backdrop}>
        <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
          {/* Top Bar */}
          <View style={styles.topBar}>
            <View style={styles.titleWrap}>
              <Text style={styles.titleText} numberOfLines={1}>
                {title || 'Photo View'}
              </Text>
              <Text style={styles.hintText}>
                Pinch with 2 fingers to zoom • Double tap to magnify
              </Text>
            </View>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onClose}
              accessibilityLabel="Close viewer"
            >
              <X size={22} color="#ffffff" />
            </TouchableOpacity>
          </View>

          {/* Main Interactive Zoom Area */}
          <View style={styles.imageContainer} {...panResponder.panHandlers}>
            <Animated.View
              style={[
                styles.imageWrap,
                {
                  transform: [
                    { scale },
                    { translateX },
                    { translateY },
                  ],
                },
              ]}
            >
              <Image
                source={{ uri: imageUri }}
                style={styles.fullImage}
                resizeMode="contain"
              />
            </Animated.View>
          </View>

          {/* Bottom Zoom / Magnifier Toolbar */}
          <View style={styles.bottomBar}>
            <View style={styles.toolbarCard}>
              {/* Zoom Out */}
              <TouchableOpacity
                style={[
                  styles.toolBtn,
                  displayScale <= 1.05 && styles.toolBtnDisabled,
                ]}
                onPress={zoomOut}
                disabled={displayScale <= 1.05}
                accessibilityLabel="Zoom out"
              >
                <ZoomOut
                  size={20}
                  color={displayScale <= 1.05 ? 'rgba(255,255,255,0.4)' : '#ffffff'}
                />
              </TouchableOpacity>

              {/* Scale Indicator */}
              <View style={styles.scaleBadge}>
                <Text style={styles.scaleText}>
                  {Math.round(displayScale * 100)}%
                </Text>
              </View>

              {/* Zoom In */}
              <TouchableOpacity
                style={[
                  styles.toolBtn,
                  displayScale >= MAX_SCALE && styles.toolBtnDisabled,
                ]}
                onPress={zoomIn}
                disabled={displayScale >= MAX_SCALE}
                accessibilityLabel="Zoom in"
              >
                <ZoomIn
                  size={20}
                  color={displayScale >= MAX_SCALE ? 'rgba(255,255,255,0.4)' : '#ffffff'}
                />
              </TouchableOpacity>

              <View style={styles.divider} />

              {/* Magnifier Tool Button */}
              <TouchableOpacity
                style={[
                  styles.toolActionBtn,
                  displayScale > 1.3 && styles.toolActionBtnActive,
                ]}
                onPress={toggleMagnifier}
                accessibilityLabel="Magnifier tool"
              >
                <Search size={18} color="#ffffff" />
                <Text style={styles.toolActionText}>
                  {displayScale > 1.3 ? 'Active (2.5x)' : 'Magnify'}
                </Text>
              </TouchableOpacity>

              {/* Reset Button */}
              {displayScale > 1.05 && (
                <TouchableOpacity
                  style={styles.resetBtn}
                  onPress={() => resetZoom(true)}
                  accessibilityLabel="Reset zoom"
                >
                  <RotateCcw size={16} color="#38bdf8" />
                  <Text style={styles.resetText}>Reset</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Panning indicator when zoomed */}
            {displayScale > 1.1 && (
              <View style={styles.panHintBadge}>
                <Move size={12} color="#94a3b8" />
                <Text style={styles.panHintText}>Drag with 1 finger to pan</Text>
              </View>
            )}
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(5, 10, 20, 0.96)',
  },
  safeArea: {
    flex: 1,
    justifyContent: 'space-between',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    zIndex: 10,
  },
  titleWrap: {
    flex: 1,
    marginRight: 12,
  },
  titleText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  hintText: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  imageContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  imageWrap: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullImage: {
    width: '100%',
    height: '100%',
  },
  bottomBar: {
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === 'ios' ? 12 : 20,
    alignItems: 'center',
    zIndex: 10,
  },
  toolbarCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    borderRadius: 30,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  toolBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolBtnDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  scaleBadge: {
    paddingHorizontal: 10,
    minWidth: 54,
    alignItems: 'center',
  },
  scaleText: {
    color: '#38bdf8',
    fontSize: 14,
    fontWeight: '700',
  },
  divider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    marginHorizontal: 10,
  },
  toolActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0284c7',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  toolActionBtnActive: {
    backgroundColor: '#0369a1',
    borderWidth: 1,
    borderColor: '#38bdf8',
  },
  toolActionText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 20,
    marginLeft: 8,
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
  },
  resetText: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: '600',
  },
  panHintBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  panHintText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '500',
  },
});
