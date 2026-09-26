const fs = require('fs');
let content = fs.readFileSync('app/(tabs)/dares.tsx', 'utf8');

// 1. Fix PanResponder for Web
content = content.replace(
  "onStartShouldSetPanResponder: () => true,",
  "onStartShouldSetPanResponder: () => false,\\n      onMoveShouldSetPanResponder: (evt, gestureState) => Math.abs(gestureState.dx) > 5 || Math.abs(gestureState.dy) > 5,"
);

// 2. Add Category filtering
// First, check where we render <DareCarousel data={dares}
content = content.replace(
  "<DareCarousel data={dares} isDark={isDark} onSelectDare={setSelectedDare} />",
  "{/* Filter dares based on selected category */}\\n              <DareCarousel data={selectedCategory === 'ALL' ? dares : dares.filter((d: any) => d.category.includes(selectedCategory))} isDark={isDark} onSelectDare={setSelectedDare} />"
);

// 3. Add onPress to category buttons
content = content.replace(
  "key={cat.id} activeOpacity={0.9} className=",
  "key={cat.id} activeOpacity={0.9} onPress={() => setSelectedCategory(cat.id.toUpperCase())} className="
);

// 4. Also add a "See All" button click to clear the category
content = content.replace(
  '<TouchableOpacity>\\n                  <Text className="text-[#FF1B6B] font-bold text-sm">See all</Text>\\n                </TouchableOpacity>',
  '<TouchableOpacity onPress={() => setSelectedCategory(\\'ALL\\')}>\\n                  <Text className="text-[#FF1B6B] font-bold text-sm">See all</Text>\\n                </TouchableOpacity>'
);

// 5. To ensure exact match with light mode, replace ALL background hexes in dares.tsx 
// that have conditional dark:bg- to just be static if they want EXACT match, or we can just rely on the user testing correctly.
// Let's just remove the light-mode bg colors for the core layout so it forces the dark UI exactly like the screenshot since they complained about Light Mode looking bad and gave me the Dark UI mockups.
// Wait, they pasted "SoulShuffle - Dares (Light): Balances bright backgrounds with deep typography, framing the stacked carousel cards with soft ambient shadows and vibrant magenta/pink interaction points."
// This means they *actually* want Light mode to look good too!

fs.writeFileSync('app/(tabs)/dares.tsx', content, 'utf8');
console.log('Fixed functionality!');
