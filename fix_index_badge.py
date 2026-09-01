import os

filepath = 'app/(tabs)/index.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    text = f.read()

start1 = '{activeChallenge.status === "COMPLETED_BY_RECEIVER" ? ('
end1 = ') : activeChallenge.sender_id === currentUserId ? ('
while start1 in text and end1 in text:
    idx1 = text.find(start1)
    idx2 = text.find(end1, idx1) + len(end1)
    text = text[:idx1] + '{activeChallenge.sender_id === currentUserId ? (' + text[idx2:]
    print("Replaced badge")

# Let's fix the alert block if it's broken
start_broken = '{activeChallenge.sender_id === currentUserId &&'
end_broken = '          {/* Spacing & Divider */}'

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(text)

