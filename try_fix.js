const fs = require('fs');
let content = fs.readFileSync('app/(tabs)/dares.tsx', 'utf-8');

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

const startIndex = content.indexOf(") : room && room.status === 'ACTIVE' ? (");
if (startIndex === -1) throw new Error("Could not find start");

const afterStart = content.substring(startIndex);
const endPattern = ") : (\n        <ScrollView \n          contentContainerStyle={{ flexGrow: 1 }}\n          showsVerticalScrollIndicator={false}\n          refreshControl=";

const endIndex = content.indexOf(") : (\\n        <ScrollView \\n          contentContainerStyle={{ flexGrow: 1 }}");
