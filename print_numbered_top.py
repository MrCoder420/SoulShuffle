with open('app/(tabs)/index.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for j in range(1805, 1830):
    print(f"{j+1}: {repr(lines[j])}")
