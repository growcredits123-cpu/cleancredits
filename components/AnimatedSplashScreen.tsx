import React, { useEffect } from 'react';
import { View, StyleSheet, Dimensions, Platform, Image } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import * as SplashScreen from 'expo-splash-screen';
import { theme } from '@/lib/theme';

const { width, height } = Dimensions.get('window');

interface Props {
  onAnimationComplete: () => void;
}

export function AnimatedSplashScreen({ onAnimationComplete }: Props) {
  const opacity = useSharedValue(1);
  const scale = useSharedValue(0.6);
  const textOpacity = useSharedValue(0);
  const textTranslateY = useSharedValue(20);

  useEffect(() => {
    // Hide the native splash screen seamlessly once this JS component mounts
    SplashScreen.hideAsync().catch(() => {});
    
    // Start animation sequence
    scale.value = withSpring(1, { damping: 14, stiffness: 100 });
    textOpacity.value = withDelay(300, withTiming(1, { duration: 600 }));
    textTranslateY.value = withDelay(300, withSpring(0, { damping: 12, stiffness: 90 }));
    
    // Fade out everything after 2 seconds
    opacity.value = withDelay(
      2000, 
      withTiming(0, { duration: 500 }, () => {
        runOnJS(onAnimationComplete)();
      })
    );
  }, []);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const logoStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const textStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
    transform: [{ translateY: textTranslateY.value }],
  }));

  return (
    <Animated.View style={[styles.container, containerStyle]}>
      <Animated.View style={[styles.logoContainer, logoStyle]}>
        <View style={styles.iconCircle}>
          <Image
            source={require('@/assets/images/icon.png')}
            style={{ width: 110, height: 110, borderRadius: 28 }}
            resizeMode="cover"
          />
        </View>
        <Animated.Text style={[styles.text, textStyle]}>GrowCredits</Animated.Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.colors.primary[600],
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 99999,
    elevation: 99999,
  },
  logoContainer: {
    alignItems: 'center',
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
  },
  text: {
    fontSize: 48,
    color: '#ffffff',
    letterSpacing: -1.5,
    fontFamily: Platform.OS === 'ios' ? 'Inter-Bold' : 'Inter-Bold', // Use loaded font
    fontWeight: '700',
  }
});
