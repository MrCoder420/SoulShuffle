import re

with open('app/(tabs)/index.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

start_idx = text.find('{/* Active Challenge Section */}')
if start_idx == -1:
    print('Start not found')
    exit(1)

start_match = text.find('{activeChallenge && (', start_idx)
if start_match == -1:
    print('Start block not found')
    exit(1)

brace_count = 0
end_idx = -1
for i in range(start_match, len(text)):
    if text[i] == '{':
        brace_count += 1
    elif text[i] == '}':
        brace_count -= 1
        if brace_count == 0:
            end_idx = i + 1
            break

if end_idx == -1:
    print('End not found')
    exit(1)

block = text[start_match:end_idx]

inner_block = block[21:-2] 
inner_block = re.sub(r'\bactiveChallenge\b', 'challenge', inner_block)

new_block = '''{activeChallenges.length > 0 && (
            <View>
              <ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                snapToInterval={width}
                decelerationRate="fast"
                contentContainerStyle={{ paddingBottom: 16 }}
              >
                {activeChallenges.map((challenge, index) => (
                  <View key={challenge.id} style={{ width }}>
                    <View
                      className="mx-6 mt-6 rounded-[32px] overflow-hidden shadow-lg border"
                      style={{
                        backgroundColor: isDark ? "#271318" : "#ffffff",
                        borderColor: isDark ? "rgba(225,29,72,0.2)" : "rgba(225,29,72,0.15)",
                      }}
                    >
'''

inner_start = inner_block.find('<View className="h-40 relative">')
if inner_start == -1:
    print('Inner start not found')
    exit(1)

new_block += inner_block[inner_start:]
new_block += '''
                  </View>
                ))}
              </ScrollView>
              
              {activeChallenges.length > 1 && (
                <View className="flex-row justify-center mt-2 mb-2 gap-1.5">
                  {activeChallenges.map((_, idx) => (
                    <View 
                      key={idx} 
                      className="w-1.5 h-1.5 rounded-full" 
                      style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.2)' }}
                    />
                  ))}
                </View>
              )}
            </View>
          )}'''

new_text = text[:start_match] + new_block + text[end_idx:]

with open('app/(tabs)/index.tsx', 'w', encoding='utf-8') as f:
    f.write(new_text)

print('Success')
