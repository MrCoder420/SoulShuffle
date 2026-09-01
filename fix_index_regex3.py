import re

filepath = 'app/(tabs)/index.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    code = f.read()

# Remove the badge check
code = re.sub(
    r'\{\s*activeChallenge\.status\s*===\s*"COMPLETED_BY_RECEIVER"\s*\?\s*\([\s\S]*?\)\s*:\s*\(\s*(<View className="absolute top-4 left-4 bg-slate-500[\s\S]*?</View>)\s*\)\s*\)\s*:\s*activeChallenge\.sender_id\s*===\s*currentUserId\s*\?\s*\(',
    r'{activeChallenge.sender_id === currentUserId ? (',
    code
)

# Remove the alert check
code = re.sub(
    r'\{\s*activeChallenge\.sender_id\s*===\s*currentUserId\s*&&\s*\(\s*activeChallenge\.status\s*===\s*"COMPLETED_BY_RECEIVER"\s*\?\s*\([\s\S]*?\)\s*:\s*\(\s*(<View\s*style=\{\{[\s\S]*?Awaiting completion![\s\S]*?</View>)\s*\)\s*\)\}',
    r'{activeChallenge.sender_id === currentUserId && (\n                  \1\n                )}',
    code
)

# Remove the buttons check
code = re.sub(
    r'\{\s*activeChallenge\.sender_id\s*!==\s*currentUserId\s*\?\s*\(\s*activeChallenge\.status\s*===\s*"COMPLETED_BY_RECEIVER"\s*\?\s*\([\s\S]*?\)\s*:\s*\(\s*(<TouchableOpacity[\s\S]*?Complete Challenge[\s\S]*?</TouchableOpacity>)\s*\)\s*\)\s*:\s*activeChallenge\.status\s*===\s*"COMPLETED_BY_RECEIVER"\s*\?\s*\([\s\S]*?\)\s*:\s*\(\s*(<TouchableOpacity[\s\S]*?View History[\s\S]*?</TouchableOpacity>)\s*\)\s*\}',
    r'{activeChallenge.sender_id !== currentUserId ? (\n                  \1\n                ) : (\n                  \2\n                )}',
    code
)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(code)

print("Regex replaced with whitespace independence")
