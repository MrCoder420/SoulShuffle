with open('app/(tabs)/index.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

start = -1
for i, line in enumerate(lines):
    if '{/* Active Challenge Section */}' in line:
        start = i
        break

if start != -1:
    for i in range(start + 180, start + 250):
        if i < len(lines):
            print(f"{i+1}: {lines[i].rstrip()}")
