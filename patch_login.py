import re

def update_file(path):
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Generic button background
    content = re.sub(r'bg-rose-500(?:\s+)dark:bg-rose-[56]00', 'bg-[#481639] dark:bg-[#D36B93]', content)
    
    # Generic text colors
    content = re.sub(r'text-rose-[56]00(?:\s+)dark:text-rose-[45]00', 'text-[#481639] dark:text-[#D36B93]', content)

    # Generic border colors
    content = re.sub(r'border-rose-\d+(?:\s+)dark:border-rose-950/\d+', 'border-gray-200 dark:border-[#333333]', content)

    # Input backgrounds
    content = re.sub(r'bg-slate-50(?:\s+)dark:bg-\[#0F0608\]', 'bg-gray-50 dark:bg-[#1E1E1E]', content)

    # Input icons
    content = content.replace('color={isDark ? "#f43f5e" : "#94a3b8"}', 'color={isDark ? "#D36B93" : "#666666"}')
    
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)

update_file('components/signinForm.tsx')
try:
    update_file('components/signupForm.tsx')
except:
    pass
