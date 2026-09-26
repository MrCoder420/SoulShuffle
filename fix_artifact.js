const fs = require('fs');
let content = fs.readFileSync('app/(tabs)/_layout.tsx', 'utf-8');
content = content.replace("import type { any } from '@react-navigation/bottom-tabs';", "");
fs.writeFileSync('app/(tabs)/_layout.tsx', content, 'utf-8');
