import re

path = 'app/(tabs)/index.tsx'
content = open(path, 'r', encoding='utf-8').read()

start_marker = '{/* Card History Section */}'
end_marker = '{/* FULL-SCREEN LOADING SPINNER */}'

start_idx = content.find(start_marker)
end_idx = content.find(end_marker, start_idx)

new_history_section = '''{/* Friendzy Style Card History Section */}
            <View className="mt-8 mb-8 px-6">
              <View className="flex-row items-center justify-between mb-4">
                <View className="flex-row items-center">
                  <Text
                    style={{ color: isDark ? "#FFFFFF" : "#1A1A1A" }}
                    className="text-xl font-black tracking-tight"
                  >
                    Recent History
                  </Text>
                </View>
                <TouchableOpacity onPress={() => navigateTo("/history")}>
                  <Text
                    style={{ color: isDark ? "#D36B93" : "#481639" }}
                    className="text-[12px] font-bold uppercase tracking-widest"
                  >
                    View All
                  </Text>
                </TouchableOpacity>
              </View>
  
              {cardHistoryList.length > 0 ? (
                <View className="flex-col gap-4">
                  {cardHistoryList.slice(0, 4).map((item: any, idx: number) => {
                    const title =
                      item.title ||
                      item.card?.title ||
                      item.cards?.name ||
                      "Completed Challenge";
                    const category =
                      item.category ||
                      item.card?.category ||
                      item.cards?.card_categories?.name?.split("_")[0] ||
                      "DARE";
                    const dateStr =
                      item.sent_at || item.created_at || item.updated_at;
                    const formattedDate = dateStr
                      ? new Date(dateStr).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })
                      : "Recently";
                    const isCompleted =
                      item.status === "COMPLETED" || item.status === "CONFIRMED";
                    const isDeflected = item.status === "DEFLECTED";
                    const isExpired = item.status === "EXPIRED";
  
                    const statusBg = isCompleted
                      ? "bg-[#481639]/90"
                      : isDeflected
                        ? "bg-indigo-500/90"
                        : isExpired
                          ? "bg-slate-500/90"
                          : "bg-[#D36B93]/90";
  
                    const statusLabel = isCompleted
                      ? "Completed"
                      : isDeflected
                        ? "Deflected"
                        : isExpired
                          ? "Expired"
                          : "Sent";
                    const imageUrl =
                      item.image ||
                      item.card?.image_url ||
                      "https://images.unsplash.com/photo-1518199266791-5375a83190b7?w=600&h=400&fit=crop";
  
                    return (
                      <TouchableOpacity
                        key={item.id || idx}
                        activeOpacity={0.88}
                        onPress={() => navigateTo("/history")}
                        style={{
                          backgroundColor: isDark ? "#1E1E1E" : "#F8F8F8",
                          borderColor: isDark ? "#333333" : "#F0F0F0",
                        }}
                        className="w-full rounded-2xl overflow-hidden border shadow-sm mb-3 flex-row"
                      >
                        <View className="w-24 h-24 relative">
                          <Image
                            source={{ uri: imageUrl }}
                            className="w-full h-full"
                            resizeMode="cover"
                          />
                          <View className="absolute inset-0 bg-black/10" />
                        </View>
  
                        <View className="flex-1 p-3 justify-center">
                          <View className="flex-row items-center justify-between mb-1">
                            <Text
                              style={{ color: isDark ? "#D36B93" : "#481639" }}
                              className="text-[9px] font-bold tracking-widest uppercase"
                            >
                              {category}
                            </Text>
                            <Text className="text-[10px] font-semibold text-gray-400">
                              {formattedDate}
                            </Text>
                          </View>
                          <Text
                            style={{ color: isDark ? "#FFFFFF" : "#1A1A1A" }}
                            className="text-base font-black tracking-tight mb-2"
                            numberOfLines={1}
                          >
                            {title}
                          </Text>
                          <View className={`self-start ${statusBg} px-2 py-0.5 rounded flex-row items-center`}>
                            <Text className="text-white font-bold text-[9px] uppercase tracking-wider">
                              {statusLabel}
                            </Text>
                          </View>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : (
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => navigateTo("/dares")}
                  style={{
                    backgroundColor: isDark ? "#1E1E1E" : "#F8F8F8",
                    borderColor: isDark ? "#333333" : "#F0F0F0",
                  }}
                  className="border border-dashed rounded-2xl p-6 items-center justify-center shadow-sm"
                >
                  <View
                    style={{ backgroundColor: isDark ? "#33222C" : "#FCEEF5" }}
                    className="w-12 h-12 rounded-full items-center justify-center mb-3"
                  >
                    <Ionicons
                      name="card"
                      size={22}
                      color={isDark ? "#D36B93" : "#481639"}
                    />
                  </View>
                  <Text
                    style={{ color: isDark ? "#FFFFFF" : "#1A1A1A" }}
                    className="text-base font-bold mb-1 text-center"
                  >
                    No Card History Yet
                  </Text>
                  <Text
                    style={{ color: isDark ? "#999999" : "#666666" }}
                    className="text-xs font-medium text-center mb-4 leading-4 px-4"
                  >
                    Send your first card to your partner to start creating
                    history together!
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </ScrollView>
  
          '''

content = content[:start_idx] + new_history_section + content[end_idx:]
open(path, 'w', encoding='utf-8').write(content)
