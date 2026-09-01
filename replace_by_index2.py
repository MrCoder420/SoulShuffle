with open('app/(tabs)/index.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = lines[:2038] + ["              </View>\n"] + lines[2051:]

with open('app/(tabs)/index.tsx', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print("Done")
