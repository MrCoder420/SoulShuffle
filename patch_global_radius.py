import os, glob, re

files = glob.glob('app/**/*.tsx', recursive=True) + glob.glob('components/**/*.tsx', recursive=True)

for path in files:
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    new_content = re.sub(r'rounded-\[36px\]', 'rounded-2xl', content)
    new_content = re.sub(r'rounded-\[32px\]', 'rounded-2xl', new_content)
    new_content = re.sub(r'rounded-\[28px\]', 'rounded-2xl', new_content)
    new_content = re.sub(r'rounded-\[24px\]', 'rounded-xl', new_content)

    if new_content != content:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print('Updated radiuses in', path)
