import os
import re

filepath = 'app/(tabs)/index.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    text = f.read()

text = re.sub(
    r'\(\s*activeChallenge\.status\s*===\s*"COMPLETED_BY_RECEIVER"\s*\?\s*\(\s*<View[\s\S]*?Please\s*confirm![\s\S]*?</View>\s*\)\s*:\s*\(',
    r'(',
    text
)

text = re.sub(
    r'\{\s*activeChallenge\.status\s*===\s*"COMPLETED_BY_RECEIVER"\s*\?\s*\(\s*<View[\s\S]*?Waiting for confirmation[\s\S]*?</View>\s*\)\s*:\s*\(',
    r'(',
    text
)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(text)

print("Regex done")
