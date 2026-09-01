import re

path = 'app/(tabs)/index.tsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

def replace_between(start_str, end_str, replace_fn, text):
    start = text.find(start_str)
    if start == -1: return text
    end = text.find(end_str, start)
    if end == -1: return text
    
    sub_text = text[start:end]
    new_sub = replace_fn(sub_text)
    return text[:start] + new_sub + text[end:]

def clean_modal_colors(text):
    # Backgrounds
    text = re.sub(r'bg-white dark:bg-\[#(180D10|1f0f13|241117)\]', 'bg-white dark:bg-[#1E1E1E]', text)
    text = re.sub(r'bg-slate-50 dark:bg-\[#0f0608\]', 'bg-gray-50 dark:bg-[#121212]', text)
    text = re.sub(r'bg-slate-50 dark:bg-\[#271318\]/50', 'bg-gray-50 dark:bg-[#2A2A2A]/50', text)
    text = re.sub(r'bg-\[#180D10\]/90', 'bg-black/60', text)
    
    # Borders
    text = re.sub(r'border-rose-100 dark:border-rose-900/40', 'border-gray-200 dark:border-[#333333]', text)
    text = re.sub(r'border-slate-200 dark:border-rose-950/40', 'border-gray-200 dark:border-[#333333]', text)
    text = re.sub(r'border-slate-200 dark:border-rose-950/30', 'border-gray-200 dark:border-[#333333]', text)
    text = re.sub(r'dark:border dark:border-rose-950/40', 'dark:border dark:border-[#333333]', text)
    text = re.sub(r'border border-rose-950/40 shadow-rose-900/20', 'border border-gray-200 dark:border-[#333333] shadow-sm', text)
    text = re.sub(r'border-4 border-white dark:border-\[#1f0f13\]', 'border-4 border-white dark:border-[#1E1E1E]', text)
    
    # Text colors
    text = re.sub(r'color: isDark \? \"#fda4af\" : \"#e11d48\"', 'color: isDark ? \"#D36B93\" : \"#481639\"', text)
    text = text.replace('color={isDark ? "#fda4af" : "#e11d48"}', 'color={isDark ? "#D36B93" : "#481639"}')
    text = text.replace('text-rose-500', 'text-[#481639] dark:text-[#D36B93]')
    text = text.replace('color="#e11d48"', 'color="#481639"')
    text = text.replace('text-rose-400/80', 'text-gray-500 dark:text-gray-400')

    # Buttons & Icons containers
    text = text.replace('bg-rose-50 dark:bg-rose-900/30', 'bg-[#FCEEF5] dark:bg-[#33222C]')
    text = text.replace('bg-rose-100 dark:bg-rose-950/40', 'bg-[#FCEEF5] dark:bg-[#33222C]')
    text = re.sub(r'bg-rose-500(?:\s+)dark:bg-rose-600', 'bg-[#481639] dark:bg-[#D36B93]', text)
    text = text.replace('bg-[#e11d48] dark:bg-[#be123c]', 'bg-[#481639] dark:bg-[#D36B93]')
    text = text.replace('bg-[#241117]', 'bg-white dark:bg-[#1E1E1E]')

    return text

# Apply to CARD RECEIVED MODAL
content = replace_between('CARD RECEIVED POPUP MODAL', 'Penalty Gift Modal', clean_modal_colors, content)

# Apply to Penalty Gift Modal
content = replace_between('Penalty Gift Modal', '</SafeAreaView>', clean_modal_colors, content)

# Apply to FULL-SCREEN LOADING SPINNER
content = replace_between('FULL-SCREEN LOADING SPINNER', 'CARD RECEIVED POPUP', clean_modal_colors, content)

# Apply to ROOM CREATE / JOIN OVERLAY
content = replace_between('ROOM CREATE / JOIN OVERLAY', 'showsVerticalScrollIndicator={false}', clean_modal_colors, content)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
