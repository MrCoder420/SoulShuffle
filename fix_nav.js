const fs = require('fs');

let content = fs.readFileSync('app/(tabs)/_layout.tsx', 'utf-8');

content = content.replace("import { CommonActions } from '@react-navigation/native';\n", "");
content = content.replace("import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';\n", "");

content = content.replace("({ state, descriptors, navigation }: BottomTabBarProps)", "({ state, descriptors, navigation }: any)");

const replaceBlock = 
avigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: 'index' }],
        })
      );;
content = content.replace(replaceBlock, outer.replace('/'););

fs.writeFileSync('app/(tabs)/_layout.tsx', content, 'utf-8');
console.log('Fixed imports in _layout.tsx');
