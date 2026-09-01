with open('app/(tabs)/index.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if 'snapToInterval={width}' in line:
        for j in range(i, i+150):
            if '</ScrollView>' in lines[j]:
                print(f'{j+1}: {lines[j].rstrip()}')
                for k in range(j+1, j+20):
                    print(f'{k+1}: {lines[k].rstrip()}')
                break
