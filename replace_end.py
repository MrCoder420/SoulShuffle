with open('app/(tabs)/index.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

old_text = '''                  </View>
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
              )}'''

new_text = '''                  </View>
                ))}
              </View>'''

if old_text in content:
    content = content.replace(old_text, new_text)
    with open('app/(tabs)/index.tsx', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Replaced!")
else:
    print("Not found!")
