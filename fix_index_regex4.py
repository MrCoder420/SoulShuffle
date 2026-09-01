import re

filepath = 'app/(tabs)/index.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    code = f.read()

# Replace first ternary (badge)
code = re.sub(
    r'\{\s*activeChallenge\.status === "COMPLETED_BY_RECEIVER"\s*\?\s*\([\s\S]*?Awaiting Partner\s*</Text>\s*</View>\s*\)\s*\)\s*:\s*activeChallenge.sender_id === currentUserId \? \(',
    r'{activeChallenge.sender_id === currentUserId ? (',
    code
)

# Replace second ternary (alert)
code = re.sub(
    r'\{\s*activeChallenge\.sender_id === currentUserId &&\s*\(\s*activeChallenge\.status === "COMPLETED_BY_RECEIVER"\s*\?\s*\([\s\S]*?Please\s*confirm!\s*</Text>\s*</View>\s*\)\s*:\s*\(\s*(<View[\s\S]*?Awaiting completion!\s*</Text>\s*</View>)\s*\)\s*\)\s*\}',
    r'{activeChallenge.sender_id === currentUserId && (\n                  \1\n                )}',
    code
)

# Replace third ternary (buttons)
code = re.sub(
    r'\{\s*activeChallenge\.sender_id !== currentUserId\s*\?\s*\(\s*activeChallenge\.status === "COMPLETED_BY_RECEIVER"\s*\?\s*\([\s\S]*?Waiting for confirmation\.\.\.\s*</Text>\s*</View>\s*\)\s*:\s*\(\s*(<TouchableOpacity[\s\S]*?Complete Challenge\s*</Text>\s*</TouchableOpacity>)\s*\)\s*\)\s*:\s*activeChallenge\.status === "COMPLETED_BY_RECEIVER"\s*\?\s*\([\s\S]*?Confirm Completion\s*</Text>\s*</TouchableOpacity>\s*\)\s*:\s*\(\s*(<TouchableOpacity[\s\S]*?View History\s*</Text>\s*</TouchableOpacity>)\s*\)\s*\}',
    r'{activeChallenge.sender_id !== currentUserId ? (\n                  \1\n                ) : (\n                  \2\n                )}',
    code
)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(code)

print("Replaced")
