const fs = require('fs');
let content = fs.readFileSync('app/(tabs)/dares.tsx', 'utf8');

// The current header block starts with "{/* Header */}" and ends at "</View>" before "{loading ?"
const headerStart = "{/* Header */}";
const headerEnd = "</View>";

const startIdx = content.indexOf(headerStart);
let afterHeaderIdx = content.indexOf(headerEnd, startIdx + headerStart.length);
afterHeaderIdx = content.indexOf("</View>", afterHeaderIdx + 1); // it's nested
afterHeaderIdx = content.indexOf("</View>", afterHeaderIdx + 1); 

// Better way: use regex to replace the entire header View block
const headerRegex = /\{\/\* Header \*\/\}[\s\S]*?(?=\{\s*loading \?)/;

const newHeader = \{/* Header */}
        <View className="flex-row items-center justify-between px-6 pt-5 pb-3 bg-[#fff8f7] dark:bg-[#0B0406] z-10">
          <TouchableOpacity onPress={openSidebar}>
            <Ionicons name="menu-outline" size={32} color={isDark ? "#fff" : "#000"} />
          </TouchableOpacity>
          <View className="flex-row items-center justify-center absolute left-0 right-0 z-[-1]" pointerEvents="none" style={{ paddingHorizontal: 100 }}>
            <Ionicons name="infinite" size={28} color="#FF1B6B" style={{ transform: [{ rotate: '-15deg' }] }} />
            <Text className="text-[#FF1B6B] font-black text-[22px] leading-6 tracking-tight ml-1" style={{ flexShrink: 1, textAlign: 'center' }}>SoulShuffl\\ne</Text>
          </View>
          <View className="flex-row items-center gap-4">
            <TouchableOpacity>
               <Ionicons name="notifications-outline" size={26} color={isDark ? "#fff" : "#000"} />
               <View className="absolute top-0 right-0 w-2.5 h-2.5 rounded-full bg-[#FF1B6B]" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push('/profile')}>
              <Image 
                source={{ uri: userAvatar }} 
                className="w-9 h-9 rounded-full border border-slate-200 dark:border-rose-950/30"
              />
            </TouchableOpacity>
          </View>
        </View>

        \;

content = content.replace(headerRegex, newHeader);
fs.writeFileSync('app/(tabs)/dares.tsx', content, 'utf8');
console.log('Fixed Header');
