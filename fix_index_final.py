import os

filepath = 'app/(tabs)/index.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    text = f.read()

# Replace block 1 (badge)
start1 = '{activeChallenge.status === "COMPLETED_BY_RECEIVER" ? ('
end1 = ') : activeChallenge.sender_id === currentUserId ? ('
if start1 in text and end1 in text:
    idx1 = text.find(start1)
    idx2 = text.find(end1, idx1) + len(end1)
    text = text[:idx1] + '{activeChallenge.sender_id === currentUserId ? (' + text[idx2:]
    print("Replaced badge")

# Replace block 2 (alert)
start2 = '{activeChallenge.sender_id === currentUserId &&'
end2 = '))}'
if start2 in text:
    idx1 = text.find(start2)
    # The alert ends at You challenged your partner. Awaiting completion!
    anchor = 'You challenged your partner. Awaiting completion!'
    idx_anchor = text.find(anchor, idx1)
    idx_end = text.find('))}', idx_anchor) + 3
    
    # We want to replace this whole block with just the awaiting completion view
    replacement = '''{activeChallenge.sender_id === currentUserId && (
                  <View
                    style={{
                      backgroundColor: isDark ? "#180D10" : "#f0fdfa",
                      borderColor: isDark ? "rgba(13,148,136,0.2)" : "#ccfbf1",
                    }}
                    className="px-4 py-3 rounded-2xl border mb-5 flex-row items-center"
                  >
                    <Ionicons
                      name="paper-plane-outline"
                      size={16}
                      color={isDark ? "#2dd4bf" : "#0f766e"}
                    />
                    <Text
                      style={{ color: isDark ? "#2dd4bf" : "#0f766e" }}
                      className="font-semibold text-[12.5px] leading-5 ml-2.5 flex-1"
                    >
                      You challenged your partner. Awaiting completion!
                    </Text>
                  </View>
                )}'''
    text = text[:idx1] + replacement + text[idx_end:]
    print("Replaced alert")

# Replace block 3 (buttons)
start3 = '{activeChallenge.sender_id !== currentUserId ? ('
if start3 in text:
    idx1 = text.find(start3)
    idx_end = text.find(')}', text.find('View History', idx1)) + 2
    
    replacement = '''{activeChallenge.sender_id !== currentUserId ? (
                  <TouchableOpacity
                    className="bg-emerald-500 dark:bg-emerald-600 py-3.5 rounded-full flex-row items-center justify-center shadow-md dark:shadow-none active:opacity-85"
                    onPress={() => handleCompleteCard(activeChallenge.id)}
                  >
                    <Ionicons
                      name="checkmark-circle"
                      size={16}
                      color="white"
                    />
                    <Text className="text-white font-bold text-[13.5px] ml-2">
                      Complete Challenge
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    className="bg-rose-50 dark:bg-slate-800/60 py-3.5 rounded-full border border-rose-100 dark:border-slate-700/40 items-center justify-center"
                    onPress={() => navigateTo("/history")}
                  >
                    <Text className="text-[#b91c1c] dark:text-rose-400 font-bold text-[13.5px]">
                      View History
                    </Text>
                  </TouchableOpacity>
                )}'''
    text = text[:idx1] + replacement + text[idx_end:]
    print("Replaced buttons")

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(text)

