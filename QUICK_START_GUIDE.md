# EcoSwap - Quick Start Guide

## 🚀 Running the App

### Mobile App (Expo)

```bash
# Install dependencies (if not already done)
npm install

# Start development server
npm run dev

# Or use Expo CLI directly
npx expo start
```

**Options when app starts:**
- Press `i` for iOS simulator
- Press `a` for Android emulator  
- Scan QR code with Expo Go app on your phone

### Admin Panel (Next.js)

```bash
# Navigate to admin folder
cd admin

# Install dependencies (if not already done)
npm install

# Start development server (runs on port 3001)
npm run dev

# Or for production build
npm run build
npm start
```

Access admin panel at: `http://localhost:3001`

## 📱 Testing the App

### On Physical Device (Recommended)
1. Install **Expo Go** from App Store (iOS) or Play Store (Android)
2. Run `npm run dev` in project root
3. Scan the QR code with:
   - iOS: Camera app
   - Android: Expo Go app
4. App will load on your device

### On Emulator/Simulator
**iOS (Mac only):**
1. Install Xcode from App Store
2. Run `npm run dev`
3. Press `i` to open in iOS Simulator

**Android:**
1. Install Android Studio
2. Set up Android emulator
3. Run `npm run dev`
4. Press `a` to open in Android emulator

## 🔧 Recent Fixes Applied

### ✅ Navigation & Layout Issues Fixed
- Bottom tab bar no longer collides with device navigation area
- Headers properly respect device notches and status bars
- All content is fully visible and accessible
- Keyboard doesn't overlap input fields
- Works on all iOS and Android devices

### ✅ SafeAreaView Implementation
All screens now use proper safe area handling:
- Tab screens (Map, Post, Recycle, Exchanges, Wallet, Profile)
- Detail screens (Item detail, Exchange chat)
- Auth screens (Login, Signup)

## 📋 App Features

1. **Map View** - Browse nearby items for swap
2. **Post Item** - List items with photo, description, location
3. **Recycle** - Report recycling spots, earn tokens
4. **Exchanges** - Track swap requests and pickups
5. **Wallet** - Manage eco-tokens, send to others
6. **Profile** - View your items and account details

## 🔑 Environment Setup

### Mobile App (.env in root)
```env
EXPO_PUBLIC_SUPABASE_URL=https://sruluflddqhxghibysvb.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

### Admin Panel (admin/.env)
```env
NEXT_PUBLIC_SUPABASE_URL=https://sruluflddqhxghibysvb.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

## 🐛 Troubleshooting

### Metro bundler issues
```bash
# Clear cache and restart
npx expo start -c
```

### Dependencies issues
```bash
# Clear and reinstall
rm -rf node_modules
npm install
```

### iOS build issues
```bash
# Clear iOS cache
rm -rf ios/build
npx expo start -c
```

### Android build issues
```bash
# Clear Android cache
cd android && ./gradlew clean && cd ..
npx expo start -c
```

## 📦 Tech Stack

- **Frontend**: React Native, Expo SDK 54
- **Routing**: Expo Router 6
- **Backend**: Supabase (Auth, Database, Storage)
- **Styling**: NativeWind (Tailwind for React Native)
- **Maps**: React Native Maps
- **Icons**: Lucide React Native
- **Admin**: Next.js 14, TypeScript, Tailwind CSS

## 🌐 Deployment Options

### Mobile App
1. **EAS Build** (Recommended): `eas build --platform android/ios`
2. **Web**: `npm run build:web`
3. **Expo Publish**: `npx expo publish`

### Admin Panel
1. **Vercel** (Recommended): `vercel --prod`
2. **Docker**: Build and deploy container
3. **Traditional**: Build and use PM2

See `LAYOUT_FIXES_SUMMARY.md` for detailed deployment instructions.

## 📝 Notes

- The app requires camera and location permissions
- Test on real devices for best experience
- Supabase backend is already configured
- All layout issues have been fixed (July 26, 2026)

## 💡 Need Help?

Check these files for more info:
- `LAYOUT_FIXES_SUMMARY.md` - Detailed fix documentation
- `README.md` - Project overview
- Supabase Dashboard - Backend data and auth

---

**Ready to test!** Run `npm run dev` and scan the QR code 📱
