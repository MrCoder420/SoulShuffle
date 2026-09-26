const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'app/(tabs)/dares.tsx');
let content = fs.readFileSync(filePath, 'utf-8');

// Add Reanimated & Dimensions imports
if (!content.includes('react-native-reanimated')) {
  content = content.replace(
    "import { View, Text, ScrollView",
    "import { View, Text, ScrollView, Dimensions"
  );
  content = content.replace(
    "import React,",
    "import Animated, { useSharedValue, useAnimatedScrollHandler, useAnimatedStyle, interpolate, Extrapolation } from 'react-native-reanimated';\nimport React,"
  );
}

// Extract the ACTIVE room view replacement
const activeRoomView = 
        <ScrollView 
          showsVerticalScrollIndicator={false} 
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#e11d48']} tintColor={isDark ? '#fff' : '#e11d48'} />
          }
          contentContainerStyle={{ paddingBottom: 100 }}
        >
          {/* Header Title */}
          <View className="px-6 pt-2 pb-4">
            <Text className="text-4xl font-black text-slate-900 dark:text-white mb-1 tracking-tight">Dares</Text>
            <Text className="text-slate-500 dark:text-slate-400 text-sm font-medium">Step out, connect, and make memories 💖</Text>
          </View>

          {/* Carousel */}
          <View className="mt-2 mb-6">
            <DareCarousel data={dares} isDark={isDark} onSelectDare={setSelectedDare} />
          </View>

          {/* Explore Categories */}
          <View className="px-6 mt-4">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-xl font-bold text-slate-900 dark:text-white">Explore Categories</Text>
              <TouchableOpacity>
                <Text className="text-[#ff1b6b] font-bold text-sm">See all</Text>
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -24 }} contentContainerStyle={{ paddingHorizontal: 24 }}>
              {[
                { id: 'romance', label: 'Romance', image: require('@/assets/images/bundle_romantic.jpg'), color: 'text-[#ff1b6b]' },
                { id: 'fun', label: 'Fun', image: require('@/assets/images/bundle_cozy.jpg'), color: 'text-purple-500' },
                { id: 'deep', label: 'Deep', image: require('@/assets/images/sunset_picnic.jpeg'), color: 'text-blue-600 dark:text-blue-400' },
                { id: 'spicy', label: 'Spicy', image: require('@/assets/images/bundle_spicy.jpg'), color: 'text-[#ff1b6b]' }
              ].map((cat, i) => (
                <TouchableOpacity key={cat.id} activeOpacity={0.9} className="w-[100px] h-[120px] bg-white dark:bg-[#1C1215] rounded-3xl overflow-hidden mr-3 items-center shadow-sm border border-slate-50 dark:border-rose-950/20">
                  <View className="w-full h-[65%]">
                    <Image source={cat.image} className="w-full h-full" resizeMode="cover" />
                  </View>
                  <View className="flex-1 justify-center items-center w-full">
                    <Text className={\	ext-[11px] font-bold \\}>{cat.label}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </ScrollView>
;

// Build DareCarousel component to inject at the top
const dareCarouselComponent = 
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ITEM_WIDTH = SCREEN_WIDTH * 0.72;
const SPACING = (SCREEN_WIDTH - ITEM_WIDTH) / 2;

const DareCarouselItem = ({ item, index, scrollX, isDark, onSelect }) => {
  const inputRange = [
    (index - 1) * ITEM_WIDTH,
    index * ITEM_WIDTH,
    (index + 1) * ITEM_WIDTH
  ];

  const style = useAnimatedStyle(() => {
    const scale = interpolate(scrollX.value, inputRange, [0.85, 1, 0.85], Extrapolation.CLAMP);
    const translateX = interpolate(scrollX.value, inputRange, [ITEM_WIDTH * 0.22, 0, -ITEM_WIDTH * 0.22], Extrapolation.CLAMP);
    const zIndex = interpolate(scrollX.value, [
      (index - 0.5) * ITEM_WIDTH,
      index * ITEM_WIDTH,
      (index + 0.5) * ITEM_WIDTH,
    ], [0, 100, 0], Extrapolation.CLAMP);

    return {
      transform: [{ translateX }, { scale }],
      zIndex: Math.round(zIndex)
    };
  });
  
  if (item.spacer) {
    return <View style={{ width: SPACING }} />;
  }

  const getCatColor = (cat) => {
    const c = (cat || '').toLowerCase();
    if(c.includes('romance')) return 'bg-[#ff1b6b]';
    if(c.includes('fun')) return 'bg-purple-500';
    if(c.includes('spicy')) return 'bg-[#af2c3b]';
    return 'bg-blue-500';
  };

  return (
    <Animated.View style={[{ width: ITEM_WIDTH, height: ITEM_WIDTH * 1.45, justifyContent: 'center', alignItems: 'center' }, style]}>
      <TouchableOpacity 
         activeOpacity={0.95} 
         onPress={() => onSelect(item)}
         className="w-full h-full rounded-[30px] overflow-hidden bg-slate-200 dark:bg-slate-800 shadow-xl"
         style={{ elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 15 }}
      >
        <Image source={typeof item.image === 'string' ? { uri: item.image } : item.image} style={{ width: '100%', height: '100%', position: 'absolute' }} resizeMode="cover" />
        
        {/* Gradient replacement */}
        <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '70%', backgroundColor: 'rgba(0,0,0,0.5)' }} />

        {/* Top Info */}
        <View className="absolute top-5 left-5 right-5 flex-row justify-between items-start">
          <View className={\px-3.5 py-1.5 rounded-full \\}>
             <Text className="text-white text-[10px] font-black tracking-widest uppercase">{item.category}</Text>
          </View>
          <TouchableOpacity className="w-9 h-9 rounded-full bg-white/25 items-center justify-center">
             <Ionicons name="heart-outline" size={18} color="white" />
          </TouchableOpacity>
        </View>

        {/* Bottom Info */}
        <View className="absolute bottom-6 left-5 right-5">
           <Text className="text-white text-[22px] font-black mb-1 tracking-tight leading-7">{item.title}</Text>
           <Text className="text-white/80 text-[13px] leading-5 mb-5" numberOfLines={2}>{item.description}</Text>
           
           <View className="flex-row items-center justify-between">
              <View className="flex-row items-center">
                 <Ionicons name="people" size={16} color="white" />
                 <Text className="text-white text-xs font-semibold ml-1.5">2+ People</Text>
              </View>
              <View className="w-11 h-11 rounded-full bg-[#ff1b6b] items-center justify-center">
                 <Ionicons name="arrow-forward" size={20} color="white" />
              </View>
           </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const DareCarousel = ({ data, isDark, onSelectDare }) => {
  const scrollX = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler((event) => {
    scrollX.value = event.contentOffset.x;
  });
  
  const paddedData = data && data.length > 0 ? [{ id: 'left-pad', spacer: true }, ...data, { id: 'right-pad', spacer: true }] : [];

  return (
    <View>
      <Animated.FlatList
        data={paddedData}
        keyExtractor={(item, index) => item.id || \spacer-\\}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={ITEM_WIDTH}
        decelerationRate="fast"
        bounces={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        renderItem={({ item, index }) => (
          <DareCarouselItem item={item} index={index} scrollX={scrollX} isDark={isDark} onSelect={onSelectDare} />
        )}
      />
      {/* Pagination Dots */}
      <View className="flex-row justify-center items-center mt-6 gap-2">
        <View className="w-6 h-2 rounded-full bg-[#ff1b6b]" />
        <View className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-700" />
        <View className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-700" />
        <View className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-700" />
      </View>
    </View>
  );
};
;

// Insert the component before the main Dares component
if (!content.includes('DareCarouselItem')) {
  content = content.replace(
    "export default function Dares() {",
    dareCarouselComponent + "\n\nexport default function Dares() {"
  );
}

// Replace the Active state ScrollView block
// The existing ScrollView starts at oom && room.status === 'ACTIVE' ? ( and ends at the first ) : (
const activeStateRegex = /(room\s*&&\s*room\.status\s*===\s*'ACTIVE'\s*\?\s*\()([\s\S]*?)(?=\)\s*:\s*\()/;
content = content.replace(activeStateRegex, \$1\\);

fs.writeFileSync(filePath, content, 'utf-8');
console.log('Successfully injected new UI');
