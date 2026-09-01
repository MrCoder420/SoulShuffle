import os

filepath = 'app/(tabs)/index.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = []
skip = False
open_braces = 0

i = 0
while i < len(lines):
    line = lines[i]
    
    # 1. The Badge
    if '{activeChallenge.status === "COMPLETED_BY_RECEIVER" ? (' in line:
        # It's an inline block, let's just replace this specific line with the alternative
        # We know it goes: 
        # {activeChallenge.status === "COMPLETED_BY_RECEIVER" ? (
        # ... 16 lines ...
        # ) : activeChallenge.sender_id === currentUserId ? (
        if lines[i+17].strip() == ') : activeChallenge.sender_id === currentUserId ? (':
            new_lines.append('                {activeChallenge.sender_id === currentUserId ? (\n')
            i += 18
            continue

    # 2. The Alert
    if '{activeChallenge.sender_id === currentUserId &&' in line and '(activeChallenge.status === "COMPLETED_BY_RECEIVER" ? (' in lines[i+1]:
        # Block is ~34 lines
        # Ends with: ))}
        j = i
        while j < len(lines) and not lines[j].strip() == '))}':
            j += 1
        if j < len(lines):
            # Replace the whole block with just the 'Awaiting completion!' view
            new_lines.append('                {activeChallenge.sender_id === currentUserId && (\n')
            new_lines.append('                  <View\n')
            new_lines.append('                    style={{\n')
            new_lines.append('                      backgroundColor: isDark ? "#180D10" : "#f0fdfa",\n')
            new_lines.append('                      borderColor: isDark ? "rgba(13,148,136,0.2)" : "#ccfbf1",\n')
            new_lines.append('                    }}\n')
            new_lines.append('                    className="px-4 py-3 rounded-2xl border mb-5 flex-row items-center"\n')
            new_lines.append('                  >\n')
            new_lines.append('                    <Ionicons\n')
            new_lines.append('                      name="paper-plane-outline"\n')
            new_lines.append('                      size={16}\n')
            new_lines.append('                      color={isDark ? "#2dd4bf" : "#0f766e"}\n')
            new_lines.append('                    />\n')
            new_lines.append('                    <Text\n')
            new_lines.append('                      style={{ color: isDark ? "#2dd4bf" : "#0f766e" }}\n')
            new_lines.append('                      className="font-semibold text-[12.5px] leading-5 ml-2.5 flex-1"\n')
            new_lines.append('                    >\n')
            new_lines.append('                      You challenged your partner. Awaiting completion!\n')
            new_lines.append('                    </Text>\n')
            new_lines.append('                  </View>\n')
            new_lines.append('                )}\n')
            i = j + 1
            continue

    # 3. The Buttons
    if '{activeChallenge.sender_id !== currentUserId ? (' in line and 'activeChallenge.status === "COMPLETED_BY_RECEIVER" ? (' in lines[i+1]:
        j = i
        while j < len(lines) and not lines[j].strip() == ')}':
            j += 1
        if j < len(lines):
            new_lines.append('                {activeChallenge.sender_id !== currentUserId ? (\n')
            new_lines.append('                  <TouchableOpacity\n')
            new_lines.append('                    className="bg-emerald-500 dark:bg-emerald-600 py-3.5 rounded-full flex-row items-center justify-center shadow-md dark:shadow-none active:opacity-85"\n')
            new_lines.append('                    onPress={() => handleCompleteCard(activeChallenge.id)}\n')
            new_lines.append('                  >\n')
            new_lines.append('                    <Ionicons\n')
            new_lines.append('                      name="checkmark-circle"\n')
            new_lines.append('                      size={16}\n')
            new_lines.append('                      color="white"\n')
            new_lines.append('                    />\n')
            new_lines.append('                    <Text className="text-white font-bold text-[13.5px] ml-2">\n')
            new_lines.append('                      Complete Challenge\n')
            new_lines.append('                    </Text>\n')
            new_lines.append('                  </TouchableOpacity>\n')
            new_lines.append('                ) : (\n')
            new_lines.append('                  <TouchableOpacity\n')
            new_lines.append('                    className="bg-rose-50 dark:bg-slate-800/60 py-3.5 rounded-full border border-rose-100 dark:border-slate-700/40 items-center justify-center"\n')
            new_lines.append('                    onPress={() => navigateTo("/history")}\n')
            new_lines.append('                  >\n')
            new_lines.append('                    <Text className="text-[#b91c1c] dark:text-rose-400 font-bold text-[13.5px]">\n')
            new_lines.append('                      View History\n')
            new_lines.append('                    </Text>\n')
            new_lines.append('                  </TouchableOpacity>\n')
            new_lines.append('                )}\n')
            i = j + 1
            continue

    new_lines.append(line)
    i += 1

with open(filepath, 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print("Parsed and replaced line by line!")
