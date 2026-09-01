import re

filepath = 'app/(tabs)/index.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    code = f.read()

# Let's just do a blunt replace for the specific badge code block we know exists
badge_block = '''                {activeChallenge.status === "COMPLETED_BY_RECEIVER" ? (
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
code = code.replace(badge_block, '''                {activeChallenge.sender_id === currentUserId ? (''')


alert_block = '''                {activeChallenge.sender_id === currentUserId &&
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
code = code.replace(alert_block, new_alert)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(code)

print("Regex replaced")
