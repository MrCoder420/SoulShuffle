with open('app/(tabs)/dares.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if 'const handleSendChallenge = ' in line:
        for j in range(i, i+60):
            if j < len(lines):
                print(f"{j+1}: {lines[j].rstrip()}")
        break
