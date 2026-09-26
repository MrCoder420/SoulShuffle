const fs = require('fs');

let content = fs.readFileSync('app/(tabs)/_layout.tsx', 'utf-8');

content = content.replace("import { CommonActions } from '@react-navigation/native';\n", "");
content = content.replace("import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';\n", "");

content = content.replace("BottomTabBarProps", "any");

content = content.replace(/navigation\.dispatch\(\s*CommonActions\.reset\(\{\s*index:\s*0,\s*routes:\s*\[\{\s*name:\s*'index'\s*\}\],\s*\}\)\s*\);/g, "router.replace('/');");

fs.writeFileSync('app/(tabs)/_layout.tsx', content, 'utf-8');
console.log('Fixed _layout.tsx navigation');
