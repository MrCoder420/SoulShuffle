import re

filepath = 'app/(tabs)/index.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Remove the badge logic entirely
code = re.sub(
    r'\{\s*activeChallenge\.status\s*===\s*"COMPLETED_BY_RECEIVER"\s*\?\s*\(\s*activeChallenge\.sender_id\s*===\s*currentUserId\s*\?\s*\([\s\S]*?<!-- Badge End -->',
    '',
    code
)

# Replace the specific lines safely using regex
# Replace the first ternary check
code = re.sub(
    r'\{\s*activeChallenge\.status\s*===\s*"COMPLETED_BY_RECEIVER"\s*\?\s*\([\s\S]*?\)\s*:\s*\(\s*<View className="absolute top-4 left-4 bg-slate-500',
    r'{activeChallenge.sender_id !== currentUserId ? (\n                    <View className="absolute top-4 left-4 bg-slate-500',
    code
)

# Replace the alert check
code = re.sub(
    r'\{\s*activeChallenge\.sender_id\s*===\s*currentUserId\s*&&\s*\(\s*activeChallenge\.status\s*===\s*"COMPLETED_BY_RECEIVER"\s*\?\s*\([\s\S]*?\)\s*:\s*\(\s*(<View[\s\S]*?Awaiting completion![\s\S]*?</View>)\s*\)\)',
    r'{activeChallenge.sender_id === currentUserId && (\n                  \1\n                )',
    code
)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(code)

print("Regex replaced")
