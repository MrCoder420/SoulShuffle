import os

filepath = 'app/(tabs)/index.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = []
i = 0
while i < len(lines):
    line = lines[i]
    if 'activeChallenge.status === "COMPLETED_BY_RECEIVER"' in line and '?' in line:
        # Check if next line has sender_id
        if i + 1 < len(lines) and 'activeChallenge.sender_id === currentUserId' in lines[i+1]:
            new_lines.append('                {activeChallenge.sender_id === currentUserId ? (\n')
            # skip until we close this ternary
            j = i + 1
            while j < len(lines) and ') : (' not in lines[j] and ') : activeChallenge.sender_id' not in lines[j]:
                j += 1
            if j < len(lines):
                i = j + 1
                continue
    new_lines.append(line)
    i += 1

with open(filepath, 'w', encoding='utf-8') as f:
    f.writelines(new_lines)
print("Removed last badge!")
