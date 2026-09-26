const fs = require('fs');

let content = fs.readFileSync('app/_layout.tsx', 'utf-8');
content = content.replace(
  "import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';",
  "import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native'; // We will remove this"
);
content = content.replace("import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native'; // We will remove this", "");
content = content.replace("import { Stack } from 'expo-router';", "import { Stack, DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';");

fs.writeFileSync('app/_layout.tsx', content, 'utf-8');
console.log('Fixed app/_layout.tsx navigation imports');
