const fs = require('fs');
let code = fs.readFileSync('app/(tabs)/dares.tsx', 'utf-8');

const oldHeaderRegex = /<View className="flex-row items-center justify-between px-6 pt-5 pb-3 bg-\[#fff8f7\] dark:bg-\[#0F0608\] z-10">[\s\S]*?<TouchableOpacity onPress=\{\(\) => router\.push\('\/profile'\)\}>[\s\S]*?<\/View>/g;

const matches = [...code.matchAll(oldHeaderRegex)];
if (matches.length > 1) {
    const secondMatchIndex = matches[1].index;
    code = code.substring(0, secondMatchIndex) + code.substring(secondMatchIndex + matches[1][0].length);
}

fs.writeFileSync('app/(tabs)/dares.tsx', code, 'utf-8');
