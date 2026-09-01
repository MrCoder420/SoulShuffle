import os, glob

files = glob.glob('app/**/*.tsx', recursive=True) + glob.glob('components/**/*.tsx', recursive=True)

for path in files:
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    new_content = content.replace('bg-rose-500 dark:bg-rose-600', 'bg-[#481639] dark:bg-[#D36B93]')
    new_content = new_content.replace('bg-rose-50 dark:bg-[#0F0608]', 'bg-white dark:bg-[#121212]')
    new_content = new_content.replace('text-rose-500 dark:text-rose-400', 'text-[#481639] dark:text-[#D36B93]')
    new_content = new_content.replace('color={isDark ? "#f43f5e" : "#e11d48"}', 'color={isDark ? "#D36B93" : "#481639"}')
    new_content = new_content.replace('color={isDark ? "#fda4af" : "#e11d48"}', 'color={isDark ? "#D36B93" : "#481639"}')
    new_content = new_content.replace('bg-[#241117]', 'bg-white dark:bg-[#1E1E1E]')
    new_content = new_content.replace('bg-[#e11d48]', 'bg-[#481639]')

    if new_content != content:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print('Updated', path)
