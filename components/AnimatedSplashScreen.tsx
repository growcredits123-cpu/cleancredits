import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Dimensions, Platform, Image, Text, Animated } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { theme } from '@/lib/theme';

interface Props {
  onAnimationComplete: () => void;
}

export function AnimatedSplashScreen({ onAnimationComplete }: Props) {
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(0.4)).current;
  const textOpacityAnim = useRef(new Animated.Value(0)).current;
  const textTranslateYAnim = useRef(new Animated.Value(20)).current;
  const rippleScaleAnim = useRef(new Animated.Value(0.5)).current;
  const rippleOpacityAnim = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});

    let completed = false;
    const safeComplete = () => {
      if (!completed) {
        completed = true;
        onAnimationComplete();
      }
    };

    // 1. Entrance animation (scale + ripple + text)
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 6,
        tension: 80,
        useNativeDriver: true,
      }),
      Animated.timing(rippleScaleAnim, {
        toValue: 3.5,
        duration: 900,
        useNativeDriver: true,
      }),
      Animated.timing(rippleOpacityAnim, {
        toValue: 0,
        duration: 900,
        useNativeDriver: true,
      }),
      Animated.timing(textOpacityAnim, {
        toValue: 1,
        duration: 500,
        delay: 250,
        useNativeDriver: true,
      }),
      Animated.spring(textTranslateYAnim, {
        toValue: 0,
        friction: 6,
        delay: 250,
        useNativeDriver: true,
      }),
    ]).start();

    // 2. Exit animation after 1.8s
    const exitTimer = setTimeout(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }).start(() => {
        safeComplete();
      });
    }, 1800);

    // 3. Absolute fallback safety timer
    const fallbackTimer = setTimeout(safeComplete, 2400);

    return () => {
      clearTimeout(exitTimer);
      clearTimeout(fallbackTimer);
    };
  }, []);

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <Animated.View
        style={[
          styles.ripple,
          {
            opacity: rippleOpacityAnim,
            transform: [{ scale: rippleScaleAnim }],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.logoContainer,
          {
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        <View style={styles.iconCircle}>
          <Image
            source={require('@/assets/images/icon.png')}
            style={{ width: 100, height: 100 }}
            resizeMode="contain"
          />
        </View>
        <Animated.View
          style={{
            opacity: textOpacityAnim,
            transform: [{ translateY: textTranslateYAnim }],
          }}
        >
          <Text style={styles.text}>FruitMap</Text>
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0284c7',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 99999,
    elevation: 99999,
  },
  ripple: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#38bdf8',
  },
  logoContainer: {
    alignItems: 'center',
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 32,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    ...theme.elevation.lg,
    overflow: 'hidden',
  },
  text: {
    fontSize: 40,
    color: '#ffffff',
    letterSpacing: -1,
    fontFamily: theme.fonts.bold,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.15)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
});

