$content = Get-Content -Path app/(tabs)/history.tsx -Raw
$content = $content -replace "type FilterType = 'ALL' \| 'SENT_BY_ME' \| 'RECEIVED' \| 'COMPLETED';", "type FilterType = 'ALL' | 'SENT_BY_ME' | 'RECEIVED' | 'COMPLETED' | 'PENALTIES';"
$content = $content -replace "const \[loading, setLoading\] = useState\(true\);", "const [loading, setLoading] = useState(true);
  const [penaltyLogs, setPenaltyLogs] = useState<any[]>([]);"
$content = $content -replace "const cacheKey = `cached_active_room_history_${activeRoomId}`;", "const cacheKey = `cached_active_room_history_${activeRoomId}`;
      try {
        const { fetchPenaltyLog } = require('@/services/cardService');
        const logs = await fetchPenaltyLog(activeRoomId);
        setPenaltyLogs(logs);
      } catch (e) { console.log('Penalty log fetch error', e); }"

$content = $content -replace "\{ label: 'Completed', value: 'COMPLETED', icon: 'checkmark-done-outline' \},", "{ label: 'Completed', value: 'COMPLETED', icon: 'checkmark-done-outline' },
    { label: 'Penalties', value: 'PENALTIES', icon: 'warning-outline' }"

$content = $content -replace "<\!loading && roomGroups\.map\(roomGroup => \{", "{!loading && activeFilter === 'PENALTIES' && penaltyLogs.length === 0 && (
          <View className="py-10 items-center justify-center">
            <Ionicons name="shield-checkmark-outline" size={48} color={isDark ? "#94a3b8" : "#cbd5e1"} />
            <Text className="text-slate-400 font-semibold text-sm mt-3">No penalties in this room. Keep it up!</Text>
          </View>
        )}

        {!loading && activeFilter === 'PENALTIES' && penaltyLogs.map((log) => (
           <View key={log.id} className="mb-4 rounded-2xl p-4 border bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/40">
             <View className="flex-row items-center gap-2 mb-2">
                <Ionicons name="warning" size={20} color="#e11d48" />
                <Text className="font-bold text-rose-600 dark:text-rose-400 uppercase text-xs tracking-wider">
                  {log.penalty_type.replace(/_/g, ' ')}
                </Text>
             </View>
             <Text className="text-slate-700 dark:text-slate-300 font-medium mb-2">{log.message}</Text>
             <Text className="text-slate-500 dark:text-slate-500 text-xs">{new Date(log.created_at).toLocaleString()}</Text>
           </View>
        ))}

        {!loading && activeFilter !== 'PENALTIES' && roomGroups.map(roomGroup => {"

Set-Content -Path app/(tabs)/history.tsx -Value $content
