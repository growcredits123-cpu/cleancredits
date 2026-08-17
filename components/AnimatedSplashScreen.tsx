import React, { useEffect } from 'react';
import { View, StyleSheet, Dimensions, Platform, Image } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSpring,
  withSequence,
  runOnJS,
  Easing,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import * as SplashScreen from 'expo-splash-screen';
import { theme } from '@/lib/theme';

const { width, height } = Dimensions.get('window');

interface Props {
  onAnimationComplete: () => void;
}

export function AnimatedSplashScreen({ onAnimationComplete }: Props) {
  const containerOpacity = useSharedValue(1);
  const logoScale = useSharedValue(0.3);
  const logoRotation = useSharedValue(-15);
  const textOpacity = useSharedValue(0);
  const textTranslateY = useSharedValue(30);
  const rippleScale = useSharedValue(0);
  const rippleOpacity = useSharedValue(0.5);

  useEffect(() => {
    // Hide the native splash screen seamlessly once this JS component mounts
    SplashScreen.hideAsync().catch(() => {});
    
    // 1. Logo pop-in and rotate
    logoScale.value = withSpring(1, { damping: 12, stiffness: 90 });
    logoRotation.value = withSpring(0, { damping: 10, stiffness: 80 });
    
    // 2. Ripple effect behind the logo
    rippleScale.value = withDelay(
      200,
      withTiming(4, { duration: 800, easing: Easing.out(Easing.ease) })
    );
    rippleOpacity.value = withDelay(
      200,
      withTiming(0, { duration: 800, easing: Easing.out(Easing.ease) })
    );

    // 3. Text slides up and fades in
    textOpacity.value = withDelay(400, withTiming(1, { duration: 600 }));
    textTranslateY.value = withDelay(400, withSpring(0, { damping: 14, stiffness: 100 }));
    
    // 4. Fade out entire screen
    containerOpacity.value = withDelay(
      2200, 
      withTiming(0, { duration: 600, easing: Easing.inOut(Easing.ease) }, () => {
        runOnJS(onAnimationComplete)();
      })
    );
  }, []);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: containerOpacity.value,
  }));

  const logoStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: logoScale.value },
      { rotate: `${logoRotation.value}deg` }
    ],
  }));

  const textStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
    transform: [{ translateY: textTranslateY.value }],
  }));

  const rippleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: rippleScale.value }],
    opacity: rippleOpacity.value,
  }));

  return (
    <Animated.View style={[styles.container, containerStyle]}>
      <Animated.View style={[styles.ripple, rippleStyle]} />
      <Animated.View style={[styles.logoContainer, logoStyle]}>
        <View style={styles.iconCircle}>
          <Image
            source={require('@/assets/images/icon.png')}
            style={{ width: 110, height: 110, borderRadius: 28 }}
            resizeMode="cover"
          />
        </View>
        <Animated.Text style={[styles.text, textStyle]}>FruitMap</Animated.Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.colors.primary[700],
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
    backgroundColor: theme.colors.primary[500],
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
    marginBottom: 24,
    ...theme.elevation.lg,
  },
  text: {
    fontSize: 44,
    color: '#ffffff',
    letterSpacing: -1.5,
    fontFamily: Platform.OS === 'ios' ? 'Inter-Bold' : 'Inter-Bold',
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.1)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  }
});
