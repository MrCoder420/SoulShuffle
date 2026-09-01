import os

filepath = 'app/(tabs)/index.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    code = f.read()

# 1. In activeChallenges filter:
code = code.replace(
    '''(c) => c.status === "IN_PROGRESS" || c.status === "COMPLETED_BY_RECEIVER",''',
    '''(c) => c.status === "IN_PROGRESS",'''
)

# 2. In handleCompleteCard optimistic update:
code = code.replace(
    '''s.id === sendId ? { ...s, status: "COMPLETED_BY_RECEIVER" } : s,''',
    '''s.id === sendId ? { ...s, status: "COMPLETED" } : s,'''
)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(code)

print("Updated index.tsx")
