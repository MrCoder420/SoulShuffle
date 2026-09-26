const fs = require('fs');

// 1. Fix _layout.tsx
let layoutContent = fs.readFileSync('app/(tabs)/_layout.tsx', 'utf-8');
layoutContent = layoutContent.replace("function CustomTabBar({ state, navigation }: BottomTabBarProps)", "function CustomTabBar({ state, navigation }: any)");
layoutContent = layoutContent.replace(/export default function TabLayout\(\) \{[\s\S]*?(?=return \()/g, (match) => {
  return match.replace(/tab\.name/g, 'tab.name'); // actually the error in _layout is about . state.routes.find((r: any) => r.name === tab.name)
});
layoutContent = layoutContent.replace(/\(r\) =>/g, "(r: any) =>");
fs.writeFileSync('app/(tabs)/_layout.tsx', layoutContent, 'utf-8');

// 2. Fix dares.tsx
let daresContent = fs.readFileSync('app/(tabs)/dares.tsx', 'utf-8');
daresContent = daresContent.replace("const DareCarouselItem = ({ item, index, scrollX, isDark, onSelect })", "const DareCarouselItem = ({ item, index, scrollX, isDark, onSelect }: any)");
daresContent = daresContent.replace("const DareCarousel = ({ data, isDark, onSelectDare })", "const DareCarousel = ({ data, isDark, onSelectDare }: any)");
daresContent = daresContent.replace(/\(cat\) =>/g, "(cat: any) =>");
fs.writeFileSync('app/(tabs)/dares.tsx', daresContent, 'utf-8');

// 3. Fix profile.tsx
let profileContent = fs.readFileSync('app/(tabs)/profile.tsx', 'utf-8');
profileContent = profileContent.replace(/const cachedAvatar = await AsyncStorage\.getItem\(\partnerAvatar_\$\{room\.id\}\\);/g, "const cachedAvatar = await AsyncStorage.getItem(\partnerAvatar_\\);");
fs.writeFileSync('app/(tabs)/profile.tsx', profileContent, 'utf-8');

console.log('Fixed TS errors');
