import os

filepath = 'app/(tabs)/index.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    code = f.read()

# Replace the badge logic
old_badge = '''                {activeChallenge.status === "COMPLETED_BY_RECEIVER" ? (
                  activeChallenge.sender_id === currentUserId ? (
                    <View className="absolute top-4 left-4 bg-amber-500 dark:bg-amber-600 px-3 py-1.5 rounded-full flex-row items-center shadow-sm">
                      <Ionicons name="alert-circle" size={12} color="white" />
                      <Text className="text-white font-bold text-[10px] tracking-widest uppercase ml-1.5">
                        Needs Confirmation
                      </Text>
                    </View>
                  ) : (
                    <View className="absolute top-4 left-4 bg-slate-500 dark:bg-slate-600 px-3 py-1.5 rounded-full flex-row items-center shadow-sm">
                      <Ionicons
                        name="hourglass-outline"
                        size={12}
                        color="white"
                      />
                      <Text className="text-white font-bold text-[10px] tracking-widest uppercase ml-1.5">
                        Awaiting Partner
                      </Text>
                    </View>
                  )
                ) : activeChallenge.sender_id === currentUserId ? ('''

new_badge = '''                {activeChallenge.sender_id === currentUserId ? ('''
code = code.replace(old_badge, new_badge)

# Replace the alert message logic
old_alert = '''                {activeChallenge.sender_id === currentUserId &&
                  (activeChallenge.status === "COMPLETED_BY_RECEIVER" ? (
                    <View
                      style={{
                        backgroundColor: isDark ? "#271318" : "#fffbeb",
                        borderColor: isDark ? "rgba(245,158,11,0.2)" : "#fef3c7",
                      }}
                      className="px-4 py-3 rounded-2xl border mb-5 flex-row items-center"
                    >
                      <Ionicons
                        name="gift-outline"
                        size={16}
                        color={isDark ? "#fbbf24" : "#d97706"}
                      />
                      <Text
                        style={{ color: isDark ? "#fbbf24" : "#b45309" }}
                        className="font-semibold text-[12.5px] leading-5 ml-2.5 flex-1"
                      >
                        Your partner marked this dare as completed. Please
                        confirm!
                      </Text>
                    </View>
                  ) : (
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
                  ))}'''

new_alert = '''                {activeChallenge.sender_id === currentUserId && (
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
code = code.replace(old_alert, new_alert)

# Replace the buttons logic
old_buttons = '''                {activeChallenge.sender_id !== currentUserId ? (
                  activeChallenge.status === "COMPLETED_BY_RECEIVER" ? (
                    <View className="bg-slate-100 dark:bg-[#271318]/50 py-3.5 rounded-2xl border border-slate-200/45 dark:border-rose-950/10 items-center">
                      <Text className="text-slate-400 dark:text-slate-500 font-bold text-[12.5px]">
                        Waiting for confirmation...
                      </Text>
                    </View>
                  ) : (
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
                  )
                ) : activeChallenge.status === "COMPLETED_BY_RECEIVER" ? (
                  <TouchableOpacity
                    className="bg-emerald-500 dark:bg-emerald-600 py-3.5 rounded-full flex-row items-center justify-center shadow-md dark:shadow-none active:opacity-85"
                    onPress={() =>
                      handleConfirmCompleteCard(activeChallenge.id)
                    }
                  >
                    <Ionicons name="checkmark-circle" size={16} color="white" />
                    <Text className="text-white font-bold text-[13.5px] ml-2">
                      Confirm Completion
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

new_buttons = '''                {activeChallenge.sender_id !== currentUserId ? (
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
code = code.replace(old_buttons, new_buttons)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(code)

print("Cleaned up index.tsx UI")
