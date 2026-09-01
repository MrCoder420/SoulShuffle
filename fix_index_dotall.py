import re
import os

filepath = 'app/(tabs)/index.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    text = f.read()

text = re.sub(
    r'\{\s*activeChallenge\.status === "COMPLETED_BY_RECEIVER" \? \([\s\S]*?\) : activeChallenge\.sender_id === currentUserId \? \(',
    '{activeChallenge.sender_id === currentUserId ? (',
    text
)

text = re.sub(
    r'\{\s*activeChallenge\.sender_id === currentUserId &&\s*\(activeChallenge\.status === "COMPLETED_BY_RECEIVER" \? \([\s\S]*?\) : \(\s*(<View[\s\S]*?Awaiting completion![\s\S]*?</View>)\s*\)\)\}?',
    r'{activeChallenge.sender_id === currentUserId && (\n                  \1\n                )}',
    text
)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(text)

print("regex sub done")
