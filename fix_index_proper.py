import os

filepath = 'app/(tabs)/index.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    text = f.read()

import re

# Block 1 (The Badge)
text = re.sub(
    r'\{\s*activeChallenge\.status\s*===\s*"COMPLETED_BY_RECEIVER"\s*\?\s*\([\s\S]*?Waiting for Partner[\s\S]*?</Text>\s*</View>\s*\)\s*\)\s*:\s*\(',
    r'(',
    text
)

# Block 2 (The Alert)
text = re.sub(
    r'\{\s*activeChallenge\.sender_id\s*===\s*currentUserId\s*&&\s*\(\s*activeChallenge\.status\s*===\s*"COMPLETED_BY_RECEIVER"\s*\?\s*\([\s\S]*?Please\s*confirm![\s\S]*?</Text>\s*</View>\s*\)\s*:\s*\(\s*(<View[\s\S]*?Awaiting completion![\s\S]*?</View>)\s*\)\s*\)\}',
    r'{activeChallenge.sender_id === currentUserId && (\n                  \1\n                )}',
    text
)

# Block 3 (The Buttons)
text = re.sub(
    r'\{\s*activeChallenge\.sender_id\s*!==\s*currentUserId\s*\?\s*\(\s*activeChallenge\.status\s*===\s*"COMPLETED_BY_RECEIVER"\s*\?\s*\([\s\S]*?Waiting for confirmation\.\.\.[\s\S]*?</Text>\s*</View>\s*\)\s*:\s*\(\s*(<TouchableOpacity[\s\S]*?Complete Challenge[\s\S]*?</TouchableOpacity>)\s*\)\s*\)\s*:\s*activeChallenge\.status\s*===\s*"COMPLETED_BY_RECEIVER"\s*\?\s*\([\s\S]*?Confirm Completion[\s\S]*?</TouchableOpacity>\s*\)\s*:\s*\(\s*(<TouchableOpacity[\s\S]*?View History[\s\S]*?</TouchableOpacity>)\s*\)\s*\}',
    r'{activeChallenge.sender_id !== currentUserId ? (\n                  \1\n                ) : (\n                  \2\n                )}',
    text
)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(text)

print("Regex done")
