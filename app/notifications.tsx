import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useNotifications, AppNotification } from '@/context/NotificationContext';

const formatDistanceToNow = (date: Date) => {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

export default function NotificationCenter() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const router = useRouter();
  
  const {
    notifications,
    isLoading,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  } = useNotifications();

  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);

  // Initial fetch and mark all as read (Instagram style)
  useEffect(() => {
    fetchNotifications(1).then(() => {
      markAllAsRead();
    });
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setPage(1);
    await fetchNotifications(1);
    setRefreshing(false);
  }, [fetchNotifications]);

  const loadMore = () => {
    if (!isLoading && notifications.length >= page * 20) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchNotifications(nextPage);
    }
  };

  const handleNotificationClick = async (notification: AppNotification) => {
    // 1. Mark as read in the background if it's not already read
    if (!notification.is_read) {
      markAsRead(notification.id);
    }

    // 2. Navigate dynamically based on TYPE
    const { type, data } = notification;

    switch (type) {
      // ── Cards & Dares ──
      case 'CARD_RECEIVED':
      case 'CARD_ACCEPTED':
      case 'CARD_COMPLETED':
      case 'CARD_CONFIRMED':
      case 'CARD_REMINDER':
      case 'CARD_DEADLINE_WARN':
      case 'CARD_DEFLECTED':
      case 'DARE_EXPIRED_FAILED':
      case 'PARTNER_REQUESTED_HINT':
      case 'HINT_PROVIDED':
      case 'DARE_ABANDONED':
      case 'REVENGE_DARE_UNLOCKED':
      case 'MYSTERY_CARD_RECEIVED':
      case 'PHOTO_PROOF_UPLOADED':
      case 'PHOTO_PROOF_REJECTED':
        router.push('/(tabs)'); 
        break;

      // ── Penalties & History ──
      case 'PENALTY_RECEIVED':
      case 'CARD_REJECTED':
      case 'PENALTY_CARD_STOLEN':
      case 'DEFLECT_CARD_EARNED':
        router.push('/(tabs)/history');
        break;
        
      // ── Store & Decks ──
      case 'SEND_BAN_RECEIVED':
      case 'SEND_BAN_LIFTED':
      case 'NEW_BUNDLE_AVAILABLE':
      case 'BUNDLE_GIFT_RECEIVED':
      case 'FLASH_SALE_STARTED':
      case 'FREE_CARD_READY':
        router.push('/(tabs)/store');
        break;

      // ── Room & Session ──
      case 'PARTNER_JOINED':
      case 'ROOM_EXPIRING_SOON':
      case 'ROOM_EXPIRED':
      case 'ROOM_EXTENDED':
      case 'PARTNER_LEFT_ROOM':
      case 'PARTNER_JOIN_INVITE':
      case 'PARTNER_INACTIVE':
      case 'NUDGE_RECEIVED':
        router.push('/(tabs)');
        break;

      // ── Coin Toss ──
      case 'COIN_TOSS_INVITE':
      case 'COIN_TOSS_WON':
      case 'COIN_TOSS_LOST':
        router.push('/(tabs)/coin-toss');
        break;

      // ── Profile & Stats ──
      case 'DAILY_STREAK_MILESTONE':
      case 'STREAK_AT_RISK':
      case 'STREAK_LOST':
      case 'WEEKLY_RECAP':
      case 'MONTHLY_ANNIVERSARY':
      case 'PROFILE_UPDATED':
      case 'RELATIONSHIP_MILESTONE':
      case 'COMPLETION_RATE_MILESTONE':
      case 'LEVEL_UP':
      case 'FAVORITE_CATEGORY_IDENTIFIED':
        router.push('/(tabs)/profile'); // Or history, profile is good
        break;

      case 'MANUAL_BROADCAST':
      case 'MANUAL_SINGLE':
        // These are admin custom messages
        Alert.alert(notification.title, notification.body);
        break;

      default:
        // No specific route
        break;
    }
  };

  const confirmDelete = (id: string) => {
    Alert.alert(
      "Delete Notification",
      "Are you sure you want to delete this notification?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive",
          onPress: () => deleteNotification(id)
        }
      ]
    );
  };

  const renderItem = ({ item }: { item: AppNotification }) => (
    <TouchableOpacity
      className={`px-4 py-4 border-b ${isDark ? 'border-rose-950/40 bg-[#180D10]' : 'border-rose-100 bg-white'} ${!item.is_read ? (isDark ? 'bg-[#271318]' : 'bg-rose-50/50') : ''}`}
      onPress={() => handleNotificationClick(item)}
      onLongPress={() => confirmDelete(item.id)}
      activeOpacity={0.7}
    >
      <View className="flex-row items-start">
        <View className="mr-3 mt-1">
           {/* Dynamic icon based on type could be added here, for now using a default */}
          <View className={`w-10 h-10 rounded-full items-center justify-center ${!item.is_read ? 'bg-rose-100 dark:bg-rose-500/20' : 'bg-slate-100 dark:bg-slate-800'}`}>
            <Ionicons 
              name={
                item.type.includes('CARD') || item.type.includes('DARE') ? "card-outline" : 
                item.type.includes('PENALTY') || item.type.includes('BAN') ? "warning-outline" : 
                item.type.includes('PARTNER') || item.type.includes('RELATIONSHIP') ? "heart-outline" : 
                item.type.includes('COIN_TOSS') ? "aperture-outline" : 
                item.type.includes('BUNDLE') || item.type.includes('SALE') ? "cart-outline" : 
                item.type.includes('ROOM') ? "home-outline" : 
                item.type.includes('STREAK') || item.type.includes('LEVEL') ? "flame-outline" : 
                "notifications-outline"
              } 
              size={20} 
              color={!item.is_read ? (isDark ? "#fda4af" : "#e11d48") : (isDark ? "#94a3b8" : "#64748b")} 
            />
          </View>
        </View>
        <View className="flex-1">
          <View className="flex-row justify-between items-start mb-1">
            <Text className={`font-bold flex-1 mr-2 text-[15px] ${isDark ? 'text-white' : 'text-slate-900'}`} numberOfLines={1}>
              {item.title}
            </Text>
            {item.created_at && (
              <Text className={`text-[11px] font-medium ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                {(() => {
                    try {
                        return formatDistanceToNow(new Date(item.created_at));
                    } catch (e) {
                        return '';
                    }
                })()}
              </Text>
            )}
          </View>
          <Text className={`text-[13px] leading-5 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
            {item.body}
          </Text>
        </View>
        {!item.is_read && (
          <View className="w-2.5 h-2.5 rounded-full bg-rose-500 ml-2 mt-2" />
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView className="flex-1 bg-rose-50 dark:bg-[#0F0608]" edges={['top']}>
      {/* Header */}
      <View className={`flex-row items-center justify-between px-4 py-3 border-b ${isDark ? 'border-rose-950/20' : 'border-rose-100/50'}`}>
        <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2 rounded-full" style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }}>
          <Ionicons name="arrow-back" size={22} color={isDark ? "#fff" : "#1e293b"} />
        </TouchableOpacity>
        <Text className={`text-lg font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
          Notifications
        </Text>
        <TouchableOpacity onPress={markAllAsRead} className="p-2 -mr-2">
           <Ionicons name="checkmark-done" size={22} color={isDark ? "#fda4af" : "#e11d48"} />
        </TouchableOpacity>
      </View>

      {/* List */}
      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ paddingBottom: 100, flexGrow: 1 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={isDark ? "#fda4af" : "#e11d48"}
            colors={["#e11d48"]}
          />
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        ListEmptyComponent={
          !isLoading ? (
            <View className="flex-1 items-center justify-center p-8 mt-20">
              <View className="w-20 h-20 rounded-full bg-rose-100 dark:bg-rose-950/40 items-center justify-center mb-4">
                <Ionicons name="notifications-off-outline" size={32} color={isDark ? "#fda4af" : "#e11d48"} />
              </View>
              <Text className={`text-lg font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-800'}`}>No notifications yet</Text>
              <Text className={`text-center text-[13px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                When your partner sends you a card or completes a dare, it will show up here.
              </Text>
            </View>
          ) : null
        }
        ListFooterComponent={
          isLoading && notifications.length > 0 ? (
            <View className="py-6 items-center">
              <ActivityIndicator size="small" color={isDark ? "#fda4af" : "#e11d48"} />
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

