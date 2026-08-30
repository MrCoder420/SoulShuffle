import re

with open('app/(tabs)/index.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. normalizeSendRecord fix
code = code.replace(
'''  return {
    ...send,
    created_at: send.sent_at || send.created_at || new Date().toISOString(),''',
'''  return {
    ...send,
    id: send.id || send.send_id,
    created_at: send.sent_at || send.created_at || new Date().toISOString(),'''
)

# 2. isActioningRef fix
code = code.replace(
'''  // -- Card Game Engine Handlers (Fast Local & Non-blocking Sync) --
  const handleAcceptCard = async (sendId: string) => {
    // Optimistic update
    setSelectedReceivedCard(null);
    setCardSends(prev => prev.map(s => s.id === sendId ? { ...s, status: 'IN_PROGRESS' } : s));
    
    try {
      await acceptCardSend(sendId);
      refreshCardSendsOnly();
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.message || 'Failed to accept card');
      refreshCardSendsOnly();
    }
  };

  const handleRejectCard = async (sendId: string, roomId: string) => {
    // Optimistic update
    setSelectedReceivedCard(null);
    setCardSends(prev => prev.map(s => s.id === sendId ? { ...s, status: 'REJECTED' } : s));
    
    try {
      await rejectCardSend(sendId, roomId);
      if (activeRoom) {
        GameSocket.sendGameEvent(activeRoom.code, 'CARD_REJECTED', { sendId });
      }
      refreshCardSendsOnly();
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.message || 'Failed to reject card');
      refreshCardSendsOnly();
    }
  };''',
'''  const isActioningRef = useRef(false);

  // -- Card Game Engine Handlers (Fast Local & Non-blocking Sync) --
  const handleAcceptCard = async (sendId: string) => {
    if (isActioningRef.current) return;
    isActioningRef.current = true;

    // Optimistic update
    setSelectedReceivedCard(null);
    setCardSends(prev => prev.map(s => s.id === sendId ? { ...s, status: 'IN_PROGRESS' } : s));
    
    try {
      await acceptCardSend(sendId);
      refreshCardSendsOnly();
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.message || 'Failed to accept card');
      refreshCardSendsOnly();
    } finally {
      isActioningRef.current = false;
    }
  };

  const handleRejectCard = async (sendId: string, roomId: string) => {
    if (isActioningRef.current) return;
    isActioningRef.current = true;

    // Optimistic update
    setSelectedReceivedCard(null);
    setCardSends(prev => prev.map(s => s.id === sendId ? { ...s, status: 'REJECTED' } : s));
    
    try {
      await rejectCardSend(sendId, roomId);
      if (activeRoom) {
        GameSocket.sendGameEvent(activeRoom.code, 'CARD_REJECTED', { sendId });
      }
      refreshCardSendsOnly();
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.message || 'Failed to reject card');
      refreshCardSendsOnly();
    } finally {
      isActioningRef.current = false;
    }
  };'''
)

# 3. getTargetDateStr fix
code = code.replace(
'''  const getTargetDateStr = (sentAt: string | undefined) => {
    if (!sentAt) return '';
    try {
      const formattedDate = sentAt.replace(' ', 'T');
      const d = new Date(formattedDate);
      const time = d.getTime();
      if (isNaN(time)) return '';
      return new Date(time + 24 * 60 * 60 * 1000).toISOString();
    } catch (e) {
      return '';
    }
  };''',
'''  const getTargetDateStr = (card: any) => {
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
  };'''
)

# 4. Fix usages of getTargetDateStr
code = code.replace(
'''                  (() => {
                    const targetTime = activeChallenge.created_at ? new Date(getTargetDateStr(activeChallenge.created_at)).getTime() : 0;
                    const isExpired = targetTime > 0 && targetTime <= new Date().getTime();''',
'''                  (() => {
                    const targetDateStr = getTargetDateStr(activeChallenge);
                    const targetTime = targetDateStr ? new Date(targetDateStr).getTime() : 0;
                    const isExpired = targetTime > 0 && targetTime <= new Date().getTime();'''
)
code = code.replace(
'''                    {activeChallenge.created_at && (
                      <CountdownTimer targetDate={getTargetDateStr(activeChallenge.created_at)} />
                    )}''',
'''                    {getTargetDateStr(activeChallenge) ? (
                      <CountdownTimer targetDate={getTargetDateStr(activeChallenge)} />
                    ) : null}'''
)
code = code.replace(
'''                      <View className="flex-row items-center mb-5 mt-1">
                        {cardSend.created_at && (
                          <CountdownTimer targetDate={getTargetDateStr(cardSend.created_at)} />
                        )}
                      </View>''',
'''                      <View className="flex-row items-center mb-5 mt-1">
                        {getTargetDateStr(cardSend) ? (
                          <CountdownTimer targetDate={getTargetDateStr(cardSend)} />
                        ) : null}
                      </View>'''
)

# 5. ReceivedCardModal UI fix
code = code.replace(
'''              {selectedReceivedCard?.message ? (
                <View className="bg-rose-50/50 dark:bg-rose-950/20 px-4 py-3.5 rounded-xl border border-rose-100/30 dark:border-rose-950/40 mb-6 w-full shadow-sm dark:shadow-none">
                  <Text className="text-[#a12338] dark:text-rose-400 font-bold text-[10px] uppercase tracking-wider mb-1">Note from partner</Text>
                  <Text className="text-slate-700 dark:text-slate-300 text-[13px] italic font-medium leading-5">
                    &quot;{selectedReceivedCard.message}&quot;
                  </Text>
                </View>
              ) : (
                <View className="h-2" />
              )}
              
              <View className="w-full gap-3.5">
                <TouchableOpacity 
                  className="w-full bg-emerald-500 dark:bg-emerald-600 py-4 rounded-2xl items-center shadow-sm dark:shadow-none"
                  onPress={() => selectedReceivedCard && handleAcceptCard(selectedReceivedCard.id)}
                >
                  <Text className="text-white font-black text-[15px] tracking-wide">Accept Challenge</Text>
                </TouchableOpacity>''',
'''              {selectedReceivedCard?.message ? (
                <View className="bg-rose-50/50 dark:bg-rose-950/20 px-4 py-3.5 rounded-xl border border-rose-100/30 dark:border-rose-950/40 mb-6 w-full shadow-sm dark:shadow-none">
                  <Text className="text-[#a12338] dark:text-rose-400 font-bold text-[10px] uppercase tracking-wider mb-1">Note from partner</Text>
                  <Text className="text-slate-700 dark:text-slate-300 text-[13px] italic font-medium leading-5">
                    &quot;{selectedReceivedCard.message}&quot;
                  </Text>
                </View>
              ) : (
                <View className="h-2" />
              )}
              
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
                  </TouchableOpacity>'''
)

code = code.replace(
'''                  <Text className="text-slate-400 dark:text-slate-500 font-bold text-[14px]">Decide Later</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>''',
'''                  <Text className="text-slate-400 dark:text-slate-500 font-bold text-[14px]">Decide Later</Text>
                </TouchableOpacity>
              </View>
              )}
            </View>
          </View>
        </Modal>'''
)

with open('app/(tabs)/index.tsx', 'w', encoding='utf-8') as f:
    f.write(code)

print("Done")
