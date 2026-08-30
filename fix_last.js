const fs = require('fs');
let code = fs.readFileSync('app/(tabs)/index.tsx', 'utf-8');

code = code.replace(
  '{cardSend.created_at && (\\n                          <CountdownTimer targetDate={getTargetDateStr(cardSend.created_at)} />\\n                        )}',
  '{getTargetDateStr(cardSend) ? (\\n                          <CountdownTimer targetDate={getTargetDateStr(cardSend)} />\\n                        ) : null}'
);

const old_modal = \              <View className="w-full gap-3.5">
                <TouchableOpacity 
                  className="w-full bg-emerald-500 dark:bg-emerald-600 py-4 rounded-2xl items-center shadow-sm dark:shadow-none"
                  onPress={() => selectedReceivedCard && handleAcceptCard(selectedReceivedCard.id)}
                >
                  <Text className="text-white font-black text-[15px] tracking-wide">Accept Challenge</Text>
                </TouchableOpacity>\;

const new_modal = \              {selectedReceivedCard?.sender_id === currentUserId ? (
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
                </TouchableOpacity>\;

code = code.replace(old_modal.replace(/\r\n/g, '\\n'), new_modal.replace(/\r\n/g, '\\n'));

const old_modal_end = \                  <Text className="text-slate-400 dark:text-slate-500 font-bold text-[14px]">Decide Later</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>\;

const new_modal_end = \                  <Text className="text-slate-400 dark:text-slate-500 font-bold text-[14px]">Decide Later</Text>
                </TouchableOpacity>
              </View>
              )}
            </View>
          </View>
        </Modal>\;

code = code.replace(old_modal_end.replace(/\r\n/g, '\\n'), new_modal_end.replace(/\r\n/g, '\\n'));

fs.writeFileSync('app/(tabs)/index.tsx', code);
