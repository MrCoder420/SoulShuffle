import re

with open('app/(tabs)/index.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. normalizeSendRecord fix
code = re.sub(
    r'return \{\s*\.\.\.send,\s*created_at: send\.sent_at \|\| send\.created_at \|\| new Date\(\)\.toISOString\(\),',
    'return {\n    ...send,\n    id: send.id || send.send_id,\n    created_at: send.sent_at || send.created_at || new Date().toISOString(),',
    code
)

# 2. isActioningRef fix
code = re.sub(
    r'(const handleAcceptCard = async \(sendId: string\) => \{\s*)// Optimistic update',
    r'const isActioningRef = useRef(false);\n\n  // -- Card Game Engine Handlers (Fast Local & Non-blocking Sync) --\n  \1if (isActioningRef.current) return;\n    isActioningRef.current = true;\n\n    // Optimistic update',
    code
)

code = re.sub(
    r'\} catch \(e: any\) \{\n\s+Alert\.alert\(\'Error\', e\.response\?\.data\?\.message \|\| \'Failed to accept card\'\);\n\s+refreshCardSendsOnly\(\);\n\s+\}',
    r'''} catch (e: any) {
      Alert.alert('Error', e.response?.data?.message || 'Failed to accept card');
      refreshCardSendsOnly();
    } finally {
      isActioningRef.current = false;
    }''',
    code
)

code = re.sub(
    r'(const handleRejectCard = async \(sendId: string, roomId: string\) => \{\s*)// Optimistic update',
    r'\1if (isActioningRef.current) return;\n    isActioningRef.current = true;\n\n    // Optimistic update',
    code
)

code = re.sub(
    r'\} catch \(e: any\) \{\n\s+Alert\.alert\(\'Error\', e\.response\?\.data\?\.message \|\| \'Failed to reject card\'\);\n\s+refreshCardSendsOnly\(\);\n\s+\}',
    r'''} catch (e: any) {
      Alert.alert('Error', e.response?.data?.message || 'Failed to reject card');
      refreshCardSendsOnly();
    } finally {
      isActioningRef.current = false;
    }''',
    code
)

# 3. getTargetDateStr fix
code = re.sub(
    r'const getTargetDateStr = \(sentAt: string \| undefined\) => \{.*?\n\s+\};',
    r'''const getTargetDateStr = (card: any) => {
    if (!card) return '';
    try {
      if (card.status === 'IN_PROGRESS') {
        if (card.completion_deadline) return new Date(card.completion_deadline).toISOString();
        if (card.accepted_at) {
          const d = new Date(card.accepted_at.replace(' ', 'T'));
          return new Date(d.getTime() + 48 * 60 * 60 * 1000).toISOString();
        }
      } else if (card.status === 'SENT' || card.status === 'WAITING') {
        if (card.penalty_deadline) return new Date(card.penalty_deadline).toISOString();
        const baseTime = card.created_at || card.sent_at;
        if (baseTime) {
          const d = new Date(baseTime.replace(' ', 'T'));
          return new Date(d.getTime() + 48 * 60 * 60 * 1000).toISOString();
        }
      }
      return '';
    } catch (e) {
      return '';
    }
  };''',
    code,
    flags=re.DOTALL
)

# 4. Fix usages of getTargetDateStr
code = re.sub(
    r'const targetTime = activeChallenge\.created_at \? new Date\(getTargetDateStr\(activeChallenge\.created_at\)\)\.getTime\(\) : 0;',
    r'''const targetDateStr = getTargetDateStr(activeChallenge);
                    const targetTime = targetDateStr ? new Date(targetDateStr).getTime() : 0;''',
    code
)

code = re.sub(
    r'\{activeChallenge\.created_at && \(\s*<CountdownTimer targetDate=\{getTargetDateStr\(activeChallenge\.created_at\)\} />\s*\)\}',
    r'''{getTargetDateStr(activeChallenge) ? (
                      <CountdownTimer targetDate={getTargetDateStr(activeChallenge)} />
                    ) : null}''',
    code
)

code = re.sub(
    r'\{cardSend\.created_at && \(\s*<CountdownTimer targetDate=\{getTargetDateStr\(cardSend\.created_at\)\} />\s*\)\}',
    r'''{getTargetDateStr(cardSend) ? (
                          <CountdownTimer targetDate={getTargetDateStr(cardSend)} />
                        ) : null}''',
    code
)

# 5. ReceivedCardModal UI fix
code = re.sub(
    r'(\) : \(\s*<View className="h-2" />\s*\)\s*\})\s*<View className="w-full gap-3\.5">\s*<TouchableOpacity\s*className="w-full bg-emerald-500 dark:bg-emerald-600 py-4 rounded-2xl items-center shadow-sm dark:shadow-none"\s*onPress=\{.*?\}\s*>\s*<Text className="text-white font-black text-\[15px\] tracking-wide">Accept Challenge</Text>\s*</TouchableOpacity>',
    r'''\1
              {selectedReceivedCard?.sender_id === currentUserId ? (
                <View className="w-full bg-slate-50 dark:bg-[#180D10]/50 py-6 rounded-2xl items-center border border-slate-100 dark:border-rose-950/20 px-4">
                  <Ionicons name="time-outline" size={32} color={isDark ? "#94a3b8" : "#64748b"} style={{ marginBottom: 12 }} />
                  <Text className="text-slate-700 dark:text-slate-300 font-bold text-[15px] text-center mb-1">
                    Waiting for Partner
                  </Text>
                  <Text className="text-slate-500 dark:text-slate-400 text-[13px] text-center leading-5 mb-4">
                    You sent this dare to your partner. Waiting for them to accept, reject, or deflect.
                  </Text>
                  <TouchableOpacity 
                    className="w-full bg-rose-500/10 dark:bg-rose-500/20 py-3.5 rounded-xl items-center"
                    onPress={() => {
                      setSelectedReceivedCard(null);
                      setShowDeflectDropdown(false);
                    }}
                  >
                    <Text className="text-rose-600 dark:text-rose-400 font-bold text-[14px]">Close</Text>
                  </TouchableOpacity>
                </View>
              ) : (
              <View className="w-full gap-3.5">
                <View className="w-full flex-row items-center justify-center bg-slate-50 dark:bg-[#180D10]/50 py-3 rounded-2xl border border-slate-100 dark:border-rose-950/20 mb-1">
                  <Ionicons name="time" size={14} color="#64748b" />
                  <Text className="text-slate-500 dark:text-slate-400 font-bold text-[12px] ml-1.5 mr-2">Time Left to Decide:</Text>
                  {getTargetDateStr(selectedReceivedCard) ? (
                    <CountdownTimer targetDate={getTargetDateStr(selectedReceivedCard)} />
                  ) : (
                    <Text className="text-slate-600 dark:text-slate-300 font-mono text-[12px] font-bold">48:00:00</Text>
                  )}
                </View>

                <TouchableOpacity 
                  className="w-full bg-emerald-500 dark:bg-emerald-600 py-4 rounded-2xl items-center shadow-sm dark:shadow-none"
                  onPress={() => selectedReceivedCard && handleAcceptCard(selectedReceivedCard.id)}
                >
                  <Text className="text-white font-black text-[15px] tracking-wide">Accept Challenge</Text>
                </TouchableOpacity>''',
    code
)

code = re.sub(
    r'(<Text className="text-slate-400 dark:text-slate-500 font-bold text-\[14px\]">Decide Later</Text>\s*</TouchableOpacity>\s*</View>\s*)(\s*</View>\s*</View>\s*</Modal>)',
    r'\1              )}\n\2',
    code
)

with open('app/(tabs)/index.tsx', 'w', encoding='utf-8') as f:
    f.write(code)

print("Done")
