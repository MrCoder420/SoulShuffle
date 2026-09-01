import re

path = 'app/(tabs)/index.tsx'
content = open(path, 'r', encoding='utf-8').read()

start_marker = '{/* Stats Section */}'
end_section = 'COUPLE ROOM SECTION'

start_idx = content.find(start_marker)
end_idx = content.find(end_section, start_idx)
end_comment_idx = content.rfind('{/*', start_idx, end_idx)

new_stats_section = '''{/* Stats Section */}
          <View className="flex-row justify-between px-6 mt-4">
            <View
              className="rounded-2xl px-5 py-4 w-[47%] shadow-sm border"
              style={{
                backgroundColor: isDark ? "#1E1E1E" : "#F8F8F8",
                borderColor: isDark ? "#333333" : "#F0F0F0",
              }}
            >
              <View
                style={{ backgroundColor: isDark ? "#33222C" : "#FCEEF5" }}
                className="w-10 h-10 rounded-full items-center justify-center mb-3"
              >
                <Ionicons
                  name="medal"
                  size={20}
                  color={isDark ? "#D36B93" : "#481639"}
                />
              </View>
              <Text
                style={{ color: isDark ? "#FFFFFF" : "#1A1A1A" }}
                className="text-2xl font-black"
              >
                {finishedDaresCount}
              </Text>
              <Text
                style={{ color: isDark ? "#999999" : "#666666" }}
                className="text-[10px] font-semibold mt-1 tracking-wider uppercase"
              >
                Dares Finished
              </Text>
            </View>
            <View
              className="rounded-2xl px-5 py-4 w-[47%] shadow-sm border"
              style={{
                backgroundColor: isDark ? "#1E1E1E" : "#F8F8F8",
                borderColor: isDark ? "#333333" : "#F0F0F0",
              }}
            >
              <View
                style={{ backgroundColor: isDark ? "#33222C" : "#FCEEF5" }}
                className="w-10 h-10 rounded-full items-center justify-center mb-3"
              >
                <Ionicons
                  name="flame"
                  size={20}
                  color={isDark ? "#D36B93" : "#481639"}
                />
              </View>
              <Text
                style={{ color: isDark ? "#FFFFFF" : "#1A1A1A" }}
                className="text-2xl font-black"
              >
                {currentStreak}
              </Text>
              <Text
                style={{ color: isDark ? "#999999" : "#666666" }}
                className="text-[10px] font-semibold mt-1 tracking-wider uppercase"
              >
                Day Streak
              </Text>
            </View>
          </View>

          '''

content = content[:start_idx] + new_stats_section + content[end_comment_idx:]
open(path, 'w', encoding='utf-8').write(content)
