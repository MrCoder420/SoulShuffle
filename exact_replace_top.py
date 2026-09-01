with open('app/(tabs)/index.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = lines[:1811] + [
    '              <View className="pb-4">\n',
    '                {activeChallenges.map((challenge, index) => (\n',
    '                  <View key={challenge.id}>\n'
] + lines[1821:]

with open('app/(tabs)/index.tsx', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print("Done")
