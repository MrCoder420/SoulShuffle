import os
import re

filepath = 'app/(tabs)/index.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    text = f.read()

text = re.sub(
    r'return new Date\(d\.getTime\(\) \+ 48 \* 60 \* 60 \* 1000\)\.toISOString\(\);',
    r'return new Date(d.getTime() + 2 * 60 * 60 * 1000).toISOString();',
    text
)
text = re.sub(
    r'return new Date\(d\.getTime\(\) \+ 24 \* 60 \* 60 \* 1000\)\.toISOString\(\);',
    r'return new Date(d.getTime() + 2 * 60 * 60 * 1000).toISOString();',
    text
)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(text)

print("Updated frontend deadlines correctly")
