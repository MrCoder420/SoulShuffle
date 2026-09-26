const fs = require('fs');
let content = fs.readFileSync('app/(tabs)/dares.tsx', 'utf-8');

// The new Tinder Deck components
const newDeckCode = 
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ITEM_WIDTH = SCREEN_WIDTH * 0.78;
const ITEM_HEIGHT = ITEM_WIDTH * 1.45;

const DareDeckItem = ({ item, index, isDark, onSelect, panHandlers, animatedStyle }: any) => {
  const getCatColor = (cat) => {
    const c = (cat || '').toLowerCase();
    if(c.includes('romance')) return 'bg-[#ff1b6b]';
    if(c.includes('fun')) return 'bg-purple-500';
    if(c.includes('spicy')) return 'bg-[#af2c3b]';
    return 'bg-blue-500';
  };

  const isFront = index === 0;

  // We only show category pills / text if we want them. The user's image shows them on the back cards mostly,
  // but let's keep them so the UI functions.
  return (
    <Animated.View 
      style={[
        { 
          position: 'absolute', 
          width: ITEM_WIDTH, 
          height: ITEM_HEIGHT,
          justifyContent: 'center', 
          alignItems: 'center',
          borderRadius: 30,
        },
        animatedStyle
      ]}
      {...(isFront && panHandlers ? panHandlers : {})}
    >
      <TouchableOpacity 
         activeOpacity={0.95} 
         onPress={() => onSelect(item)}
         className="w-full h-full rounded-[30px] overflow-hidden bg-slate-200 dark:bg-slate-800 shadow-xl"
         style={{ elevation: 15, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20 }}
      >
        <Image source={typeof item.image === 'string' ? { uri: item.image } : item.image} style={{ width: '100%', height: '100%', position: 'absolute' }} resizeMode="cover" />
        
        {/* The user's image shows the front card doesn't have the dark overlay or text, just the raw image. 
            Let's add a soft dark gradient at the top/bottom for text visibility if we keep text, 
            or hide text for the front card if we want exact matching. But functionally users need to see the title. 
            Let's just match the style shown: */}
        
        <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '50%', backgroundColor: 'rgba(0,0,0,0.4)' }} />

        <View className="absolute top-5 left-5 right-5 flex-row justify-between items-start">
          {item.category ? (
            <View className={\px-3.5 py-1.5 rounded-full \\}>
               <Text className="text-white text-[10px] font-black tracking-widest uppercase">{item.category}</Text>
            </View>
          ) : <View />}
          <TouchableOpacity className="w-9 h-9 rounded-full bg-white/25 items-center justify-center">
             <Ionicons name="heart-outline" size={18} color="white" />
          </TouchableOpacity>
        </View>

        <View className="absolute bottom-6 left-5 right-5">
           <Text className="text-white text-[22px] font-black mb-1 tracking-tight leading-7">{item.title}</Text>
           <Text className="text-white/80 text-[13px] leading-5 mb-5" numberOfLines={2}>{item.description}</Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const DareCarousel = ({ data, isDark, onSelectDare }: any) => {
  const [currentIndex, setCurrentIndex] = React.useState(0);
  
  // Need Animated from react-native, but it's imported at top
  const { Animated, PanResponder } = require('react-native');
  const position = React.useRef(new Animated.ValueXY()).current;

  const panResponder = React.useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (evt, gestureState) => {
        position.setValue({ x: gestureState.dx, y: gestureState.dy });
      },
      onPanResponderRelease: (evt, gestureState) => {
        if (gestureState.dx > 120) {
          Animated.spring(position, { toValue: { x: SCREEN_WIDTH + 100, y: gestureState.dy }, useNativeDriver: false }).start(() => {
            setCurrentIndex(prev => prev + 1);
            position.setValue({ x: 0, y: 0 });
          });
        } else if (gestureState.dx < -120) {
          Animated.spring(position, { toValue: { x: -SCREEN_WIDTH - 100, y: gestureState.dy }, useNativeDriver: false }).start(() => {
            setCurrentIndex(prev => prev + 1);
            position.setValue({ x: 0, y: 0 });
          });
        } else {
          Animated.spring(position, { toValue: { x: 0, y: 0 }, friction: 5, useNativeDriver: false }).start();
        }
      }
    })
  ).current;

  const visibleData = data ? data.slice(currentIndex, currentIndex + 3) : [];
  if (visibleData.length === 0 && data && data.length > 0) {
    // Loop back
    setTimeout(() => setCurrentIndex(0), 100);
  }

  // Pre-calculate rotations based on position in stack
  const renderCards = () => {
    return visibleData.map((item: any, i: number) => {
      let animatedStyle = {};
      let panHandlers = null;

      if (i === 0) { // Top Card
        panHandlers = panResponder.panHandlers;
        const rotate = position.x.interpolate({
          inputRange: [-SCREEN_WIDTH / 2, 0, SCREEN_WIDTH / 2],
          outputRange: ['-10deg', '4deg', '10deg'],
          extrapolate: 'clamp'
        });
        animatedStyle = {
          zIndex: 3,
          transform: [
            ...position.getTranslateTransform(),
            { rotate },
          ]
        };
      } else if (i === 1) { // Second Card
        animatedStyle = {
          zIndex: 2,
          transform: [
            { translateX: -20 },
            { translateY: 10 },
            { rotate: '-6deg' },
            { scale: 0.95 }
          ]
        };
      } else if (i === 2) { // Third Card
        animatedStyle = {
          zIndex: 1,
          transform: [
            { translateX: 15 },
            { translateY: 5 },
            { rotate: '2deg' },
            { scale: 0.9 }
          ]
        };
      }

      return (
        <DareDeckItem 
          key={item.id + '-' + i}
          item={item} 
          index={i} 
          isDark={isDark} 
          onSelect={onSelectDare} 
          animatedStyle={animatedStyle}
          panHandlers={panHandlers}
        />
      );
    }).reverse();
  };

  return (
    <View style={{ height: ITEM_HEIGHT + 40, alignItems: 'center', justifyContent: 'center' }}>
      {visibleData.length > 0 ? renderCards() : (
         <View className="items-center justify-center h-full">
            <Text className="text-slate-500 font-bold">No more cards!</Text>
         </View>
      )}
      <View className="absolute -bottom-6 flex-row justify-center items-center gap-2 w-full">
        <View className="w-2.5 h-2.5 rounded-full bg-[#ff1b6b]" />
        <View className="w-2.5 h-2.5 rounded-full bg-slate-700" />
        <View className="w-2.5 h-2.5 rounded-full bg-slate-700" />
        <View className="w-2.5 h-2.5 rounded-full bg-slate-700" />
      </View>
    </View>
  );
};
;

// we need to slice out the old DareCarouselItem and DareCarousel
const startIdx = content.indexOf("const { width: SCREEN_WIDTH } = Dimensions.get('window');");
const endIdx = content.indexOf("export default function Dares() {");

if (startIdx !== -1 && endIdx !== -1) {
   content = content.substring(0, startIdx) + newDeckCode + "\n" + content.substring(endIdx);
} else {
   console.log("Could not find blocks to replace!");
}

// Adjust the header to match the text wrapping exactly.
// The image shows "SoulShuffl \n e" which is likely just restricted width.
// Also fix the text "Step out, connect, and make memories ??"
content = content.replace(
  '<Text className="text-slate-500 dark:text-slate-400 text-[15px] font-medium">Step out, connect, and make memories ??</Text>',
  '<Text className="text-slate-500 dark:text-slate-300 text-[15px] font-medium tracking-tight">Step out, connect, and make memories ??</Text>'
);

// We replace the header text so it can wrap like in the image, or just be exactly matching.
// The image has the header center aligned:
content = content.replace(
  '<View className="flex-row items-center justify-center absolute left-0 right-0 z-[-1]" pointerEvents="none">\n          <Ionicons name="infinite" size={28} color="#ff1b6b" style={{ transform: [{ rotate: \'-15deg\' }] }} />\n          <Text className="text-[#ff1b6b] font-black text-2xl tracking-tight ml-1">SoulShuffle</Text>\n        </View>',
  '<View className="flex-row items-center justify-center absolute left-0 right-0 z-[-1]" pointerEvents="none" style={{ paddingHorizontal: 100 }}>\n          <Ionicons name="infinite" size={28} color="#ff1b6b" style={{ transform: [{ rotate: \'-15deg\' }] }} />\n          <Text className="text-[#ff1b6b] font-black text-[22px] leading-6 tracking-tight ml-1" style={{ flexShrink: 1, textAlign: \'center\' }}>SoulShuffl\\ne</Text>\n        </View>'
);

// We also need to fix the outer background color to match the image (#0F0608).
// The user has a <SafeAreaView className="flex-1 bg-slate-50 dark:bg-[#0F0608]">
// Make it exact.
content = content.replace('bg-[#0F0608]', 'bg-[#100709]');

fs.writeFileSync('app/(tabs)/dares.tsx', content, 'utf-8');
console.log('Done replacement');
