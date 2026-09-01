import os

filepath = 'constants/avatars.ts'
with open(filepath, 'r', encoding='utf-8') as f:
    code = f.read()

# Replace raw.githubusercontent.com URLs with jsDelivr CDN
code = code.replace(
    'https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/',
    'https://cdn.jsdelivr.net/gh/microsoft/fluentui-emoji@main/assets/'
)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(code)

print("Updated avatars.ts with jsDelivr CDN!")
