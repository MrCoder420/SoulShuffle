with open('app/(tabs)/index.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for j in range(2035, 2055):
    print(repr(lines[j]))
