with open('app/(tabs)/index.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if '{activeChallenges.length > 0 && (' in line:
        for j in range(max(0, i-2), min(len(lines), i+80)):
            print(f'{j+1}: {lines[j].rstrip()}')
        break
