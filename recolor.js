const fs = require('fs');
let content = fs.readFileSync('app/(tabs)/dares.tsx', 'utf8');

// Match colors exactly to the provided image

// Backgrounds
content = content.replace(/dark:bg-\\[#0F0608\\]/g, 'dark:bg-[#0B0406]');
content = content.replace(/dark:bg-\\[#1C1215\\]/g, 'dark:bg-[#161114]');
content = content.replace(/dark:bg-slate-800/g, 'dark:bg-[#1C1518]'); // Card backs

// Dots
content = content.replace(
  '<View className="w-2.5 h-2.5 rounded-full bg-slate-800" />\\n        <View className="w-2.5 h-2.5 rounded-full bg-slate-800" />\\n        <View className="w-2.5 h-2.5 rounded-full bg-slate-800" />',
  '<View className="w-2 h-2 rounded-full bg-[#221C1E]" />\\n        <View className="w-2 h-2 rounded-full bg-[#221C1E]" />\\n        <View className="w-2 h-2 rounded-full bg-[#221C1E]" />'
);
content = content.replace(
  '<View className="w-2.5 h-2.5 rounded-full bg-[#ff1b6b]" />',
  '<View className="w-2.5 h-2.5 rounded-full bg-[#FF1B6B]" />'
);

// Header Pink text
content = content.replace(/text-\\[#ff1b6b\\]/g, 'text-[#FF1B6B]');
content = content.replace(/color="#ff1b6b"/g, 'color="#FF1B6B"');

fs.writeFileSync('app/(tabs)/dares.tsx', content, 'utf8');
