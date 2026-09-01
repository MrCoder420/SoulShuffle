with open('app/(tabs)/index.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if '</ScrollView>' in line:
        for j in range(i-5, i+15):
            print(f"{j+1}: {lines[j].rstrip()}")
