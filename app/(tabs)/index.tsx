import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  Platform,
  StatusBar,
  TextInput,
  ActivityIndicator,
  Alert,
  AppState,
  useWindowDimensions,
  DeviceEventEmitter,
  KeyboardAvoidingView,
  Keyboard,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import {
  createRoom,
  joinRoom,
  getActiveRoom,
  fetchCardSends,
  acceptCardSend,
  rejectCardSend,
  completeCardSend,
  confirmCardSend,
  deflectCardSend,
  fetchDeflectCards,
  leaveRoom,
  clearRoomCache,
  Room,
  ExpiryType,
  fetchRoomHistory,
} from "@/services/roomService";
import GameSocket from "@/services/socketService";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useSidebar } from "@/context/SidebarContext";
import { useNotifications } from "@/context/NotificationContext";
import { getMyProfile, getMyProfileCached } from "@/services/authService";
import { useUserAvatar } from "@/hooks/use-user-avatar";
import { ANIMATED_AVATARS } from "@/constants/avatars";
import AsyncStorage from "@react-native-async-storage/async-storage";

import CountdownTimer from "@/components/CountdownTimer";

class ErrorBoundary extends React.Component<
  any,
  { hasError: boolean; error: Error | null }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Dashboard caught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            padding: 20,
          }}
        >
          <Text style={{ color: "red", fontWeight: "bold", fontSize: 18 }}>
            Dashboard Crashed
          </Text>
          <Text style={{ color: "black", marginTop: 10 }}>
            {this.state.error?.toString()}
          </Text>
        </View>
      );
    }
    return this.props.children;
  }
}

import {
  COUPLE_PHOTOS,
  getDailyCouplePhotoIndex,
} from "@/constants/couplePhotos";
const coupleCover = COUPLE_PHOTOS[0].source;

// Helper to normalize the card send records from the backend API
const normalizeSendRecord = (send: any) => {
  if (!send) return null;
  if (send.card && !send.cards) return send;

  const cardObj = send.cards || {};
  const rawCat = cardObj.card_categories?.name || "GENERAL";
  const cleanCategory = rawCat.split("_")[0].toUpperCase();

  const difficulty = (cardObj.attributes?.difficulty || "MEDIUM").toUpperCase();
  const timeRequirement = cardObj.attributes?.time || "30 mins";
  const description =
    cardObj.power_description ||
    cardObj.attributes?.description ||
    "No description available.";
  const title = cardObj.name || "Unnamed Challenge";

  let imageUrl = cardObj.image_url || null;
  if (!imageUrl) {
    if (
      cleanCategory.includes("ROMANCE") ||
      cleanCategory.includes("ROMANTIC")
    ) {
      imageUrl =
        "https://images.unsplash.com/photo-1518199266791-5375a83190b7?w=400&h=300&fit=crop";
    } else {
      imageUrl =
        "https://images.unsplash.com/photo-1517263904808-5dc91e3e7044?w=400&h=300&fit=crop";
    }
  }

  return {
    ...send,
    id: send.id || send.send_id,
    created_at: send.sent_at || send.created_at || new Date().toISOString(),
    card: {
      title,
      category: cleanCategory,
      difficulty,
      time_requirement: timeRequirement,
      description,
      image_url: imageUrl,
    },
  };
};

const calculateStreak = (sends: any[]) => {
  if (!sends || sends.length === 0) return 0;

  // Extract unique local YYYY-MM-DD dates for each send
  const dates = Array.from(
    new Set(
      sends
        .map((s) => {
          if (!s.created_at) return null;
          const d = new Date(s.created_at);
          if (isNaN(d.getTime())) return null;
          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        })
        .filter(Boolean) as string[],
    ),
  ).sort((a, b) => b.localeCompare(a)); // Sort descending (latest first)

  if (dates.length === 0) return 0;

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;

  // If latest activity is not today and not yesterday, the streak is broken
  if (dates[0] !== todayStr && dates[0] !== yesterdayStr) {
    return 0;
  }

  let streak = 1;
  let currentDate = new Date(dates[0]);

  for (let i = 1; i < dates.length; i++) {
    const expectedPrevDate = new Date(currentDate);
    expectedPrevDate.setDate(expectedPrevDate.getDate() - 1);
    const expectedPrevStr = `${expectedPrevDate.getFullYear()}-${String(expectedPrevDate.getMonth() + 1).padStart(2, "0")}-${String(expectedPrevDate.getDate()).padStart(2, "0")}`;

    if (dates[i] === expectedPrevStr) {
      streak++;
      currentDate = expectedPrevDate;
    } else {
      break; // streak is broken
    }
  }

  return streak;
};

export default function Dashboard() {
  const { openSidebar } = useSidebar();
  const { unreadCount, registerPushTokenWithBackend } = useNotifications();
  const userAvatar = useUserAvatar();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const { width } = useWindowDimensions();

  // ── Room State ─────────────────────────────────────────
  const [activeRoom, setActiveRoom] = useState<Room | null>(null);
  const [roomLoading, setRoomLoading] = useState(true);
  const [localPendingChallenges, setLocalPendingChallenges] = useState<any[]>(
    [],
  );
  const [roomModalVisible, setRoomModalVisible] = useState(false);
  const [roomModalTab, setRoomModalTab] = useState<"create" | "join">("create");
  const [selectedExpiry, setSelectedExpiry] = useState<ExpiryType>("7_DAYS");
  const [joinCode, setJoinCode] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState("");
  const [copiedCode, setCopiedCode] = useState(false);
  const [isLeavingRoom, setIsLeavingRoom] = useState(false);
  const [cardSends, setCardSends] = useState<any[]>([]);

  // ── Modals & UI State ──
  const [penaltyGiftModalVisible, setPenaltyGiftModalVisible] = useState(false);
  const [penaltyGiftCard, setPenaltyGiftCard] = useState<any>(null);

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState("");
  const [partnerName, setPartnerName] = useState("Partner");
  const [partnerAvatar, setPartnerAvatar] = useState<string | null>(
    ANIMATED_AVATARS[1].url,
  );

  // ── Load cached profile & active room instantly on mount ───────────────────
  useEffect(() => {
    registerPushTokenWithBackend();
    const loadCachedState = async () => {
      try {
        const cached = await getMyProfileCached();
        if (cached?.firstName) {
          setUserName(cached.firstName);
        }
        const cachedRoomStr = await AsyncStorage.getItem("cachedActiveRoom");
        if (cachedRoomStr) {
          const cachedRoom = JSON.parse(cachedRoomStr);
          if (cachedRoom && cachedRoom.id) {
            setActiveRoom(cachedRoom);
            setRoomLoading(false);
          }
        }
      } catch (e) {
        console.log("Failed to load cached profile or room in dashboard:", e);
      }
    };
    loadCachedState();
  }, []);
  const [deflectCardsCount, setDeflectCardsCount] = useState(0);
  const [deflectCards, setDeflectCards] = useState<any[]>([]);
  const [selectedReceivedCard, setSelectedReceivedCard] = useState<any | null>(
    null,
  );
  const [showDeflectDropdown, setShowDeflectDropdown] = useState(false);
  const [dismissedCardIds, setDismissedCardIds] = useState<string[]>([]);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(() =>
    getDailyCouplePhotoIndex(),
  );
  const [roomHistoryData, setRoomHistoryData] = useState<any[]>([]);
  const [heroHeartFilled, setHeroHeartFilled] = useState(false);
  const [likedMoments, setLikedMoments] = useState<Record<string, boolean>>({});

  const toggleHeroHeart = () => {
    setHeroHeartFilled((prev) => !prev);
  };

  const toggleMomentHeart = (id: string) => {
    setLikedMoments((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const getGreetingTime = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning,';
    if (hour < 18) return 'Good afternoon,';
    return 'Good evening,';
  };

  const handleNextCouplePhoto = useCallback(() => {
    setCurrentPhotoIndex((prev) => (prev + 1) % COUPLE_PHOTOS.length);
  }, []);

  // Automatically open received cards popup from cardSends state or instant notification tap
  useEffect(() => {
    // 1. Instant popup trigger from notification tap event
    const tapSub = DeviceEventEmitter.addListener(
      "app:openCardSend",
      (data: any) => {
        if (data?.card_id || data?.send_id) {
          // Attempt to find full card record in cardSends or construct instant payload
          const match = cardSends.find(
            (c) => c.id === data.send_id || c.card_id === data.card_id,
          );
          if (match) {
            setSelectedReceivedCard(match);
          } else if (data?.title || data?.cards) {
            setSelectedReceivedCard(normalizeSendRecord(data));
          }
        }
      },
    );

    // 2. Normal check when cardSends changes
    if (currentUserId && !selectedReceivedCard) {
      const unhandledReceivedCards = cardSends.filter(
        (c) =>
          c.status === "SENT" &&
          c.sender_id !== currentUserId &&
          !c.id.toString().startsWith("dummy"),
      );

      const firstNewCard = unhandledReceivedCards.find(
        (c) => !dismissedCardIds.includes(c.id),
      );
      if (firstNewCard) {
        setSelectedReceivedCard(firstNewCard);
      }
    }

    return () => {
      tapSub.remove();
    };
  }, [cardSends, currentUserId, selectedReceivedCard, dismissedCardIds]);

  // Load cached partner name & avatar when activeRoom changes
  useEffect(() => {
    const loadCachedPartnerDetails = async () => {
      if (activeRoom) {
        // 1. Partner Name
        const cachedName = await AsyncStorage.getItem(
          `partnerName_${activeRoom.id}`,
        );
        if (cachedName) {
          setPartnerName(cachedName);
        } else {
          const resolved =
            currentUserId === activeRoom.host_id
              ? activeRoom.partner_name
              : activeRoom.host_name;
          if (resolved) {
            setPartnerName(resolved);
            await AsyncStorage.setItem(
              `partnerName_${activeRoom.id}`,
              resolved,
            );
          } else {
            setPartnerName("Partner");
          }
        }

        // 2. Partner Avatar
        let resolvedAvatar =
          currentUserId === activeRoom.host_id
            ? activeRoom.partner_avatar
            : activeRoom.host_avatar;
            
        if (resolvedAvatar?.includes("dicebear")) resolvedAvatar = null;

        if (resolvedAvatar) {
          setPartnerAvatar(resolvedAvatar);
          await AsyncStorage.setItem(
            `partnerAvatar_${activeRoom.id}`,
            resolvedAvatar,
          );
        } else {
          let cachedAvatar = await AsyncStorage.getItem(
            `partnerAvatar_${activeRoom.id}`,
          );
          if (cachedAvatar?.includes("dicebear")) cachedAvatar = null;
          
          if (cachedAvatar) {
            setPartnerAvatar(cachedAvatar);
          } else {
            setPartnerAvatar(ANIMATED_AVATARS[1].url);
          }
        }
      }
    };
    loadCachedPartnerDetails();
  }, [
    activeRoom?.id,
    activeRoom?.status,
    activeRoom?.partner_id,
    activeRoom?.host_avatar,
    activeRoom?.partner_avatar,
    currentUserId,
  ]);

  // Share name & avatar callback
  const shareInfoWithPartner = useCallback(() => {
    if (
      activeRoom &&
      activeRoom.status === "ACTIVE" &&
      (userName || userAvatar)
    ) {
      console.log("Broadcasting partner info to partner:", {
        userName,
        userAvatar,
      });
      GameSocket.sendGameEvent(activeRoom.code, "PARTNER_INFO", {
        first_name: userName,
        avatar_url: userAvatar,
      });
    }
  }, [activeRoom?.code, activeRoom?.status, userName, userAvatar]);

  // Trigger name & avatar share after room loads or joins
  useEffect(() => {
    if (
      activeRoom &&
      activeRoom.status === "ACTIVE" &&
      (userName || userAvatar)
    ) {
      const timer = setTimeout(() => {
        shareInfoWithPartner();
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [
    activeRoom?.code,
    activeRoom?.status,
    userName,
    userAvatar,
    shareInfoWithPartner,
  ]);

  // Find pending challenges
  const pendingChallenges = cardSends.filter((c) => c.status === "SENT") || [];
  const activeChallenges =
    cardSends.filter(
      (c) => c.status === "IN_PROGRESS",
    ) || [];
  const activeChallenge =
    activeChallenges.length > 0 ? activeChallenges[0] : null;
  const completedChallenges =
    cardSends.filter(
      (c) =>
        c.status === "COMPLETED" ||
        c.status === "DEFLECTED" ||
        c.status === "EXPIRED",
    ) || [];

  const finishedDaresCount = cardSends.filter(
    (c) => c.status === "COMPLETED",
  ).length;
  const currentStreak = calculateStreak(cardSends);

  const displayPendingChallenges = pendingChallenges;
  const cardHistoryList =
    roomHistoryData.length > 0
      ? roomHistoryData
      : completedChallenges.length > 0
        ? completedChallenges
        : cardSends;

  // ── Fast Refresh Card Sends Only (Zero Room Overhead) ───
  const refreshCardSendsOnly = useCallback(
    async (roomId?: string) => {
      const targetRoomId = roomId || activeRoom?.id;
      if (!targetRoomId) return;
      try {
        const sends = await fetchCardSends(targetRoomId);
        const rawSends = sends?.sends || sends || [];
        setCardSends(rawSends.map(normalizeSendRecord).filter(Boolean));
      } catch (e) {
        // silently fail
      }
    },
    [activeRoom?.id],
  );

  // ── Fetch Active Room on Mount & Full Sync ─────────────
  const isFetchingRoomRef = useRef(false);

  const fetchActiveRoom = useCallback(async (silent = false) => {
    if (isFetchingRoomRef.current) return;
    isFetchingRoomRef.current = true;

    try {
      if (!silent) {
        setRoomLoading(true);
      }

      // Fast cached profile lookup (zero extra HTTP requests)
      try {
        const profile = await getMyProfileCached();
        if (profile?.id) setCurrentUserId(profile.id);
        if (profile?.firstName) setUserName(profile.firstName);
      } catch (err) {
        // silently fallback
      }

      let room: Room | null = null;
      try {
        room = await getActiveRoom();
      } catch (apiErr: any) {
        // Do NOT wipe active room on network failure/timeout!
        return;
      }

      setActiveRoom(room);

      if (room) {
        await AsyncStorage.setItem("cachedActiveRoom", JSON.stringify(room));
        await AsyncStorage.setItem("activeRoomId", room.id);

        try {
          const sends = await fetchCardSends(room.id);
          const rawSends = sends?.sends || sends || [];
          setCardSends(rawSends.map(normalizeSendRecord).filter(Boolean));
        } catch (e) {
          // silently fail
        }

        try {
          const historyData = await fetchRoomHistory(room.id);
          setRoomHistoryData(Array.isArray(historyData) ? historyData : []);
        } catch (e) {
          // silently fail
        }

        if (room.expiry_type === "30_DAYS") {
          try {
            const deflectRes = await fetchDeflectCards(room.id);
            setDeflectCardsCount(deflectRes?.total || 0);
            setDeflectCards(deflectRes?.deflect_cards || []);
          } catch (e) {
            // silently fail
          }
        } else {
          setDeflectCardsCount(0);
          setDeflectCards([]);
        }
      } else {
        // Explicitly no room from server
        await AsyncStorage.removeItem("cachedActiveRoom");
        await AsyncStorage.removeItem("activeRoomId");
        setCardSends([]);
        setDeflectCardsCount(0);
        setDeflectCards([]);
      }
    } catch (err) {
      // silently handle
    } finally {
      isFetchingRoomRef.current = false;
      if (!silent) {
        setRoomLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchActiveRoom();
    const sub = DeviceEventEmitter.addListener("app:refreshDashboard", () => {
      fetchActiveRoom(true);
    });
    const clearRoomSub = DeviceEventEmitter.addListener("app:clearRoom", () => {
      // Immediately reset all room state so UI shows 'No Room' card right away
      setActiveRoom(null);
      setCardSends([]);
      setDeflectCardsCount(0);
      setDeflectCards([]);
      setLocalPendingChallenges([]);
      setRoomHistoryData([]);
      setPartnerName("Partner");
      setPartnerAvatar(ANIMATED_AVATARS[1].url);
      setRoomLoading(false);
    });
    const penaltyGiftSub = DeviceEventEmitter.addListener(
      "app:showPenaltyGift",
      (cardData: any) => {
        setPenaltyGiftCard(cardData);
        setPenaltyGiftModalVisible(true);
      },
    );
    return () => {
      sub.remove();
      clearRoomSub.remove();
      penaltyGiftSub.remove();
    };
  }, [fetchActiveRoom]);

  // ── Socket Initialization & Lifecycle ───────────────────
  useEffect(() => {
    const setupSocket = async () => {
      if (activeRoom) {
        await GameSocket.initialize();
        GameSocket.joinRoom(activeRoom.code);
      }
    };
    setupSocket();
  }, [activeRoom?.code]);

  useEffect(() => {
    const handlePartnerJoined = (payload: any) => {
      fetchActiveRoom(true);
      if (payload?.partnerName) setPartnerName(payload.partnerName);
      if (payload?.partnerAvatar) {
        if (!payload.partnerAvatar.includes("dicebear")) {
          setPartnerAvatar(payload.partnerAvatar);
        }
      }
      // Share our own info back to partner
      shareInfoWithPartner();
    };

    const handleRoomLeft = async (payload: any) => {
      setActiveRoom(null);
      setCardSends([]);
      setDeflectCardsCount(0);
      setDeflectCards([]);
      setLocalPendingChallenges([]);
      setRoomHistoryData([]);
      setPartnerName("Partner");
      setPartnerAvatar(ANIMATED_AVATARS[1].url);
      setRoomLoading(false);

      await clearRoomCache(payload?.room_id || activeRoom?.id);
      DeviceEventEmitter.emit("app:clearRoom");
      DeviceEventEmitter.emit("room:updated");

      if (payload?.left_by && payload.left_by !== currentUserId) {
        Alert.alert(
          "Room Closed",
          "Your partner has left the room. You can now create or join a new room.",
          [{ text: "OK" }],
        );
      }
    };

    const handleGameEvent = async (payload: any) => {
      if (payload.eventType === "PARTNER_INFO") {
        const { first_name, avatar_url } = payload.data || {};
        if (first_name) {
          setPartnerName(first_name);
          if (activeRoom) {
            await AsyncStorage.setItem(
              `partnerName_${activeRoom.id}`,
              first_name,
            );
          }
        }
        if (avatar_url) {
          setPartnerAvatar(avatar_url);
          if (activeRoom) {
            await AsyncStorage.setItem(
              `partnerAvatar_${activeRoom.id}`,
              avatar_url,
            );
          }
        }
      } else if (
        payload.eventType === "CARD_RECEIVED" ||
        payload.eventType === "CARD_ACCEPTED" ||
        payload.eventType === "CARD_DEFLECTED" ||
        payload.eventType === "CARD_COMPLETED" ||
        payload.eventType === "CARD_CONFIRMED" ||
        payload.eventType === "CARD_REJECTED"
      ) {
        refreshCardSendsOnly();
      } else {
        fetchActiveRoom(true);
      }
    };

    const handlePartnerAvatarUpdated = async (data: any) => {
      if (data && data.avatar_url) {
        if (data.avatar_url.includes("dicebear")) return;
        setPartnerAvatar(data.avatar_url);
        if (activeRoom) {
          await AsyncStorage.setItem(`partnerAvatar_${activeRoom.id}`, data.avatar_url);
        }
      }
    };

    GameSocket.on("partner_joined", handlePartnerJoined);
    GameSocket.on("room_updated", handlePartnerJoined);
    GameSocket.on("game_event", handleGameEvent);
    GameSocket.on("partner_left", handleRoomLeft);
    GameSocket.on("room_left", handleRoomLeft);
    GameSocket.on("room_closed", handleRoomLeft);
    GameSocket.on("partner_avatar_updated", handlePartnerAvatarUpdated);

    return () => {
      GameSocket.off("partner_joined", handlePartnerJoined);
      GameSocket.off("room_updated", handlePartnerJoined);
      GameSocket.off("game_event", handleGameEvent);
      GameSocket.off("partner_left", handleRoomLeft);
      GameSocket.off("room_left", handleRoomLeft);
      GameSocket.off("room_closed", handleRoomLeft);
      GameSocket.off("partner_avatar_updated", handlePartnerAvatarUpdated);
    };
  }, [
    fetchActiveRoom,
    activeRoom?.id,
    currentUserId,
    shareInfoWithPartner,
    refreshCardSendsOnly,
  ]);

  // ── Automatic Polling when Waiting for Partner ────────────────
  useEffect(() => {
    if (!activeRoom || activeRoom.status !== "WAITING") return;

    const pollInterval = setInterval(() => {
      fetchActiveRoom(true);
    }, 4000);

    return () => {
      clearInterval(pollInterval);
    };
  }, [activeRoom?.status, activeRoom?.id, fetchActiveRoom]);

  useEffect(() => {
    const subscription = AppState.addEventListener(
      "change",
      async (nextAppState) => {
        if (nextAppState === "active") {
          fetchActiveRoom(true);
          if (activeRoom?.code) {
            await GameSocket.initialize();
            GameSocket.joinRoom(activeRoom.code);
          }
        }
      },
    );

    return () => subscription.remove();
  }, [fetchActiveRoom, activeRoom?.code]);

  // ── Create Room Handler ────────────────────────────────
  const handleCreateRoom = async () => {
    try {
      setActionLoading(true);
      setActionError("");
      const room = await createRoom(selectedExpiry);
      setActiveRoom(room);
      setRoomModalVisible(false);
    } catch (err: any) {
      setActionError(
        err.response?.data?.message || err.message || "Failed to create room",
      );
    } finally {
      setActionLoading(false);
    }
  };

  // ── Join Room Handler ───────────────────────────────
  const handleJoinRoom = async () => {
    if (!joinCode.trim()) {
      setActionError("Please enter a room code");
      return;
    }
    try {
      setActionLoading(true);
      setActionError("");
      const codeToSend = joinCode.trim().toUpperCase();
      const room = await joinRoom(codeToSend);
      setActiveRoom(room);
      if (room) {
        const sends = await fetchCardSends(room.id);
        const rawSends = sends?.sends || sends || [];
        setCardSends(rawSends.map(normalizeSendRecord).filter(Boolean));
      }
      setRoomModalVisible(false);
      setJoinCode("");
    } catch (err: any) {
      const status = err.response?.status;
      const serverMsg = err.response?.data?.message;

      // Give meaningful error messages based on HTTP status
      if (status === 401) {
        setActionError("Session expired. Please log out and log in again.");
      } else if (status === 404) {
        setActionError("Room not found. Check the code and try again.");
      } else if (status === 400) {
        setActionError(serverMsg || "Cannot join this room.");
      } else if (!status) {
        setActionError("Network error. Check your internet connection.");
      } else {
        setActionError(serverMsg || err.message || "Failed to join room");
      }
    } finally {
      setActionLoading(false);
    }
  };

  // ── Card Game Engine Handlers (Fast Local & Non-blocking Sync) ──
  const isActioningRef = useRef(false);

  // -- Card Game Engine Handlers (Fast Local & Non-blocking Sync) --
  const handleAcceptCard = async (sendId: string) => {
    if (isActioningRef.current) return;
    isActioningRef.current = true;

    // Optimistic update
    setSelectedReceivedCard(null);
    setCardSends((prev) =>
      prev.map((s) => (s.id === sendId ? { ...s, status: "IN_PROGRESS" } : s)),
    );

    try {
      await acceptCardSend(sendId);
      refreshCardSendsOnly();
    } catch (e: any) {
      Alert.alert(
        "Error",
        e.response?.data?.message || "Failed to accept card",
      );
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
    setCardSends((prev) =>
      prev.map((s) => (s.id === sendId ? { ...s, status: "REJECTED" } : s)),
    );

    try {
      await rejectCardSend(sendId, roomId);
      if (activeRoom) {
        GameSocket.sendGameEvent(activeRoom.code, "CARD_REJECTED", { sendId });
      }
      refreshCardSendsOnly();
    } catch (e: any) {
      Alert.alert(
        "Error",
        e.response?.data?.message || "Failed to reject card",
      );
      refreshCardSendsOnly();
    } finally {
      isActioningRef.current = false;
    }
  };

  const handleDeflectCard = async (sendId: string, deflectCardId?: string) => {
    if (deflectCardsCount <= 0 || deflectCards.length === 0) {
      Alert.alert(
        "No Deflect Cards",
        "You do not have any deflect cards available.",
      );
      return;
    }

    const deflectCardToUse = deflectCardId
      ? deflectCards.find((c) => c.id === deflectCardId)
      : deflectCards[0];
    if (!deflectCardToUse) return;

    // Optimistic update
    setSelectedReceivedCard(null);
    setShowDeflectDropdown(false);
    setCardSends((prev) =>
      prev.map((s) => (s.id === sendId ? { ...s, status: "DEFLECTED" } : s)),
    );
    setDeflectCardsCount((prev) => Math.max(0, prev - 1));
    setDeflectCards((prev) => prev.filter((c) => c.id !== deflectCardToUse.id));

    try {
      await deflectCardSend(sendId, deflectCardToUse.id);
      refreshCardSendsOnly();
    } catch (e: any) {
      Alert.alert(
        "Error",
        e.response?.data?.message || "Failed to deflect card",
      );
      refreshCardSendsOnly();
    }
  };

  const handleCompleteCard = async (sendId: string) => {
    // Optimistic update
    setCardSends((prev) =>
      prev.map((s) =>
        s.id === sendId ? { ...s, status: "COMPLETED" } : s,
      ),
    );

    try {
      await completeCardSend(sendId);
      Alert.alert(
        "Challenge Completed!",
        "Well done! You have completed this dare.",
      );
      refreshCardSendsOnly();
    } catch (e: any) {
      Alert.alert(
        "Error",
        e.response?.data?.message || "Failed to complete card",
      );
      refreshCardSendsOnly();
    }
  };

  const handleConfirmCompleteCard = async (sendId: string) => {
    // Optimistic update
    setCardSends((prev) =>
      prev.map((s) => (s.id === sendId ? { ...s, status: "COMPLETED" } : s)),
    );

    try {
      await confirmCardSend(sendId);
      Alert.alert(
        "Challenge Confirmed!",
        "Thank you! You have confirmed the challenge completion.",
      );
      refreshCardSendsOnly();
    } catch (e: any) {
      Alert.alert(
        "Error",
        e.response?.data?.message || "Failed to confirm challenge",
      );
      refreshCardSendsOnly();
    }
  };

  // ── Copy Code to Clipboard ─────────────────────────────
  const handleCopyCode = async (code: string) => {
    try {
      await Clipboard.setStringAsync(code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      Alert.alert("Copied!", `Room code: ${code}`);
    }
  };

  // ── Leave Room (Dashboard) ─────────────────────────────
  const handleLeaveRoom = () => {
    Alert.alert(
      "Leave Room",
      "Are you sure you want to leave this room? You will lose access to all current challenges.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Leave",
          style: "destructive",
          onPress: async () => {
            setIsLeavingRoom(true);
            try {
              const currentRoomId = activeRoom?.id;
              const currentRoomCode = activeRoom?.code;

              // Immediately leave socket room
              if (currentRoomCode) {
                GameSocket.leaveRoom(currentRoomCode);
              }

              // Optimistically update UI immediately so 'No Room' card appears right away
              setActiveRoom(null);
              setCardSends([]);
              setDeflectCardsCount(0);
              setDeflectCards([]);
              setLocalPendingChallenges([]);
              setRoomHistoryData([]);
              setPartnerName("Partner");
              setPartnerAvatar(ANIMATED_AVATARS[1].url);

              DeviceEventEmitter.emit("app:clearRoom");

              // Thoroughly clear cache from storage
              if (currentRoomId) {
                await clearRoomCache(currentRoomId);
                await leaveRoom(currentRoomId);
              } else {
                await clearRoomCache();
              }

              // Delay refresh slightly to ensure backend is fully updated
              setTimeout(() => {
                DeviceEventEmitter.emit("app:refreshDashboard");
              }, 500);
            } catch (error) {
              console.error("API Error during leaveRoom:", error);
            } finally {
              setIsLeavingRoom(false);
              setRoomLoading(false);
            }
          },
        },
      ],
    );
  };

  // ── Open Modal ─────────────────────────────────────────
  const openRoomModal = (tab: "create" | "join") => {
    setRoomModalTab(tab);
    setActionError("");
    setJoinCode("");
    setRoomModalVisible(true);
  };

  const switchRoomModalTab = (tab: "create" | "join") => {
    setRoomModalTab(tab);
    setActionError("");
    setActionLoading(false);
    if (tab === "create") {
      setJoinCode("");
    }
  };

  const navigateTo = (path: string) => {
    router.push(path as any);
  };

  const formatRoomCodeForDisplay = (code: string | undefined | null) => {
    if (!code) return "";
    return code.replace(/^ELV-/i, "SSF-");
  };

  // ── Format Join Code Input (auto-inserts dash after 3 chars) ────
  const formatJoinCode = (text: string) => {
    // Strip everything except letters and digits
    const stripped = text.toUpperCase().replace(/[^A-Z0-9]/g, "");
    // Auto-format as XXX-XXXXXX
    if (stripped.length <= 3) {
      setJoinCode(stripped);
    } else {
      setJoinCode(stripped.slice(0, 3) + "-" + stripped.slice(3, 9));
    }
  };

  // ── Expiry Label Helper ────────────────────────────────
  const expiryLabel = (type: ExpiryType) => {
    switch (type) {
      case "7_DAYS":
        return "7 Days";
      case "30_DAYS":
        return "30 Days";
    }
  };

  // ── Safe Target Date Parser for older JSC engines ───────
  const getTargetDateStr = (card: any) => {
    if (!card) return "";
    try {
      if (card.status === "IN_PROGRESS") {
        if (card.completion_deadline)
          return new Date(card.completion_deadline).toISOString();
        if (card.accepted_at) {
          const d = new Date(card.accepted_at.replace(" ", "T"));
          return new Date(d.getTime() + 48 * 60 * 60 * 1000).toISOString();
        }
      } else if (card.status === "SENT") {
        if (card.respond_deadline)
          return new Date(card.respond_deadline).toISOString();
        const baseTime = card.created_at || card.sent_at;
        if (baseTime) {
          const d = new Date(baseTime.replace(" ", "T"));
          return new Date(d.getTime() + 24 * 60 * 60 * 1000).toISOString();
        }
      } else if (card.status === "WAITING") {
        if (card.penalty_deadline)
          return new Date(card.penalty_deadline).toISOString();
        const baseTime = card.created_at || card.sent_at;
        if (baseTime) {
          const d = new Date(baseTime.replace(" ", "T"));
          return new Date(d.getTime() + 48 * 60 * 60 * 1000).toISOString();
        }
      }
      return "";
    } catch (e) {
      return "";
    }
  };

  return (
    <ErrorBoundary>
      <SafeAreaView
        className="flex-1 bg-[#0e0609]"
        edges={["top", "left", "right"]}
      >
        {/* Status bar configuration */}
        <StatusBar
          barStyle="light-content"
          backgroundColor="#0e0609"
        />

        {/* ═══════════════════════════════════════════════════════
          ROOM CREATE / JOIN OVERLAY
          ═══════════════════════════════════════════════════════ */}
        <Modal
          visible={roomModalVisible}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setRoomModalVisible(false)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={{ flex: 1, justifyContent: "flex-end" }}
          >
            {/* Backdrop */}
            <TouchableOpacity
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
              }}
              className="bg-black/40 dark:bg-black/60"
              activeOpacity={1}
              onPress={() => setRoomModalVisible(false)}
            />

            {/* Bottom Sheet */}
            <ScrollView
              bounces={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{
                flexGrow: 1,
                justifyContent: "flex-end",
              }}
              style={{ zIndex: 201 }}
            >
              <TouchableOpacity
                style={{ flex: 1 }}
                activeOpacity={1}
                onPress={() => setRoomModalVisible(false)}
              />
              <View className="bg-[#fff8f7] dark:bg-[#180D10] rounded-t-[36px] pt-4 pb-10 px-6 border-t border-[#ffeceb] dark:border-rose-950/20">
                {/* Handle Bar */}
                <View className="w-10 h-1 bg-slate-300 dark:bg-slate-700 rounded-full self-center mb-6" />

                <View className="flex-row bg-[#f5eeed] dark:bg-rose-950/40 rounded-2xl p-1.5 mb-7">
                  <TouchableOpacity
                    className={`flex-1 py-3.5 rounded-xl items-center ${roomModalTab === "create" ? "bg-white dark:bg-[#271318] shadow-sm dark:shadow-none" : ""}`}
                    onPress={() => switchRoomModalTab("create")}
                  >
                    <Text
                      className={`font-bold text-[14px] ${roomModalTab === "create" ? "text-[#af2c3b] dark:text-white" : "text-slate-400 dark:text-slate-500"}`}
                    >
                      Create Room
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    className={`flex-1 py-3.5 rounded-xl items-center ${roomModalTab === "join" ? "bg-white dark:bg-[#271318] shadow-sm dark:shadow-none" : ""}`}
                    onPress={() => switchRoomModalTab("join")}
                  >
                    <Text
                      className={`font-bold text-[14px] ${roomModalTab === "join" ? "text-[#af2c3b] dark:text-white" : "text-slate-400 dark:text-slate-500"}`}
                    >
                      Join Room
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* ── CREATE TAB ─────────────────────────────── */}
                {roomModalTab === "create" && (
                  <View>
                    <Text className="text-xl font-black text-slate-900 dark:text-white tracking-tight mb-2">
                      Create a Love Room
                    </Text>
                    <Text className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-6 leading-5">
                      Start a private room and share the code with your partner
                      to connect.
                    </Text>

                    {/* Expiry Selection */}
                    <Text className="text-[10px] font-bold text-slate-400 dark:text-slate-500 tracking-widest uppercase mb-3">
                      Room Duration
                    </Text>
                    <View className="flex-row gap-3 mb-8">
                      {(["7_DAYS", "30_DAYS"] as ExpiryType[]).map(
                        (type) => (
                          <TouchableOpacity
                            key={type}
                            className={`flex-1 py-4 rounded-2xl items-center border-2 ${
                              selectedExpiry === type
                                ? "bg-[#af2c3b] border-[#af2c3b] dark:bg-rose-500 dark:border-rose-500"
                                : "bg-white border-slate-100 dark:bg-[#271318] dark:border-rose-950/40"
                            }`}
                            onPress={() => setSelectedExpiry(type)}
                          >
                            <Text
                              className={`font-bold text-[13px] ${selectedExpiry === type ? (isDark ? "text-white" : "text-white") : "text-slate-700 dark:text-slate-100"}`}
                            >
                              {expiryLabel(type)}
                            </Text>
                          </TouchableOpacity>
                        ),
                      )}
                    </View>

                    {/* Error */}
                    {actionError ? (
                      <View className="bg-red-50 dark:bg-red-950/20 rounded-2xl p-4 mb-4 flex-row items-center">
                        <Ionicons
                          name="alert-circle"
                          size={18}
                          color="#dc2626"
                        />
                        <Text className="text-red-600 dark:text-red-400 font-semibold text-[13px] ml-2 flex-1">
                          {actionError}
                        </Text>
                      </View>
                    ) : null}

                    <TouchableOpacity
                      className="bg-[#af2c3b] dark:bg-rose-600 rounded-full py-[18px] items-center shadow-lg dark:shadow-none flex-row justify-center"
                      activeOpacity={0.8}
                      onPress={handleCreateRoom}
                      disabled={actionLoading}
                    >
                      {actionLoading ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <>
                          <Ionicons name="add-circle" size={20} color="white" />
                          <Text className="text-white font-bold text-[15px] ml-2">
                            Create Room
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                )}

                {/* ── JOIN TAB ───────────────────────────────── */}
                {roomModalTab === "join" && (
                  <View>
                    <Text className="text-xl font-black text-slate-900 dark:text-white tracking-tight mb-2">
                      Join Your Partner
                    </Text>
                    <Text className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-6 leading-5">
                      Enter the room code your partner shared with you.
                    </Text>

                    {/* Code Input */}
                    <View className="bg-white dark:bg-[#271318] rounded-2xl border-2 border-slate-100 dark:border-rose-950/40 px-5 py-1 mb-4">
                      <TextInput
                        placeholder="SSF-A9B3C1"
                        placeholderTextColor={
                          isDark ? "rgba(255, 255, 255, 0.2)" : "#cbd5e1"
                        }
                        value={joinCode}
                        onChangeText={formatJoinCode}
                        className="text-center text-2xl font-black text-slate-900 dark:text-white py-4"
                        style={{ letterSpacing: 8 }}
                        maxLength={10}
                        autoCapitalize="characters"
                        keyboardType="default"
                        returnKeyType="done"
                        onSubmitEditing={Keyboard.dismiss}
                        autoCorrect={false}
                        autoFocus={roomModalTab === "join"}
                      />
                    </View>

                    {/* Error */}
                    {actionError ? (
                      <View className="bg-red-50 dark:bg-red-950/20 rounded-2xl p-4 mb-4 flex-row items-center">
                        <Ionicons
                          name="alert-circle"
                          size={18}
                          color="#dc2626"
                        />
                        <Text className="text-red-600 dark:text-red-400 font-semibold text-[13px] ml-2 flex-1">
                          {actionError}
                        </Text>
                      </View>
                    ) : null}

                    <TouchableOpacity
                      className={`rounded-full py-[18px] items-center shadow-lg flex-row justify-center mt-2 ${
                        joinCode.trim().length >= 5
                          ? "bg-[#0d5f5a] dark:bg-teal-600 shadow dark:shadow-none"
                          : "bg-slate-300 dark:bg-slate-800 shadow-sm dark:shadow-none"
                      }`}
                      activeOpacity={0.8}
                      onPress={handleJoinRoom}
                      disabled={actionLoading || joinCode.trim().length < 5}
                    >
                      {actionLoading ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <>
                          <Ionicons name="enter" size={20} color="white" />
                          <Text className="text-white font-bold text-[15px] ml-2">
                            Join Room
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                )}

                {/* Cancel */}
                <TouchableOpacity
                  className="mt-4 py-3 items-center"
                  onPress={() => {
                    setRoomModalVisible(false);
                    Keyboard.dismiss();
                  }}
                >
                  <Text className="text-slate-400 dark:text-slate-500 font-bold text-[14px]">
                    Cancel
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </Modal>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 110 }}
          style={{ flex: 1, backgroundColor: "#0e0609" }}
        >
          {/* ── 1. Top Header ── */}
          <View className="flex-row items-center justify-between px-5 pt-3 pb-2">
            {/* Hamburger Menu */}
            <TouchableOpacity
              onPress={openSidebar}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="menu-outline" size={28} color="#ffffff" />
            </TouchableOpacity>

            {/* SoulShuffle Pink Logo */}
            <View className="flex-row items-center gap-1.5">
              <Ionicons
                name="infinite"
                size={26}
                color="#ff2d55"
                style={{ transform: [{ rotate: "-15deg" }] }}
              />
              <Text style={{ color: "#ff2d55", fontWeight: "900", fontSize: 21, letterSpacing: -0.5 }}>
                SoulShuffle
              </Text>
            </View>

            {/* Notifications & Avatar */}
            <View className="flex-row items-center gap-3">
              <TouchableOpacity
                onPress={() => navigateTo("/notifications")}
                style={{ position: "relative", padding: 2 }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="notifications-outline" size={24} color="#ffffff" />
                {unreadCount > 0 && (
                  <View
                    style={{
                      position: "absolute",
                      top: 1,
                      right: 1,
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: "#ff2d55",
                    }}
                  />
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  if (activeRoom && activeRoom.status === "ACTIVE") {
                    navigateTo("/profile");
                  } else {
                    openRoomModal("create");
                  }
                }}
              >
                <Image
                  source={{
                    uri:
                      (activeRoom?.status === "ACTIVE" && partnerAvatar) ||
                      userAvatar ||
                      ANIMATED_AVATARS[0].url,
                  }}
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 17,
                    borderWidth: 1.5,
                    borderColor: "#ff2d55",
                  }}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* ── 2. Greeting Row ── */}
          <View className="px-5 mt-3 flex-row items-start justify-between">
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => {
                if (!activeRoom || activeRoom.status !== "ACTIVE") {
                  openRoomModal("create");
                }
              }}
              style={{ flex: 1, paddingRight: 8 }}
            >
              <Text style={{ color: "#94a3b8", fontSize: 13, fontWeight: "500", letterSpacing: 0.2 }}>
                {getGreetingTime()}
              </Text>
              <Text
                style={{
                  color: "#ffffff",
                  fontSize: 22,
                  fontWeight: "800",
                  letterSpacing: -0.3,
                  marginTop: 2,
                }}
                numberOfLines={1}
              >
                {activeRoom?.status === "ACTIVE"
                  ? `${userName || "Anurag"} & ${partnerName || "Partner"} 💕`
                  : `${userName || "Anurag"} & ${partnerName || "Nikhil"} 💕`}
              </Text>
            </TouchableOpacity>

            {/* Script cursive quote: Same team Always ♡ */}
            <View style={{ alignItems: "flex-end", paddingTop: 2 }}>
              <Text
                style={{
                  color: "#fb7185",
                  fontSize: 13,
                  fontStyle: "italic",
                  fontFamily: Platform.select({ ios: "Snell Roundhand", android: "serif", default: "serif" }),
                  lineHeight: 16,
                }}
              >
                Same team
              </Text>
              <Text
                style={{
                  color: "#fb7185",
                  fontSize: 12,
                  fontStyle: "italic",
                  fontFamily: Platform.select({ ios: "Snell Roundhand", android: "serif", default: "serif" }),
                  lineHeight: 16,
                }}
              >
                Always ♡
              </Text>
            </View>
          </View>

          {/* ── Partner Connection Status Bar (if waiting/not connected) ── */}
          
          {activeRoom && activeRoom.status === 'ACTIVE' ? (
            <>
              {false && (
            <TouchableOpacity
              activeOpacity={0.88}
              onPress={() => openRoomModal("create")}
              style={{
                marginHorizontal: 20,
                marginTop: 12,
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: 14,
                backgroundColor: "rgba(255,45,85,0.08)",
                borderWidth: 1,
                borderColor: "rgba(255,45,85,0.25)",
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <View className="flex-row items-center flex-1 mr-2">
                <Ionicons name="link" size={14} color="#ff2d55" style={{ marginRight: 6 }} />
                <Text style={{ color: "#fce7f3", fontSize: 11, fontWeight: "600" }}>
                  {activeRoom?.status === "WAITING"
                    ? `Room Code: ${formatRoomCodeForDisplay(activeRoom.code)} • Tap to share`
                    : "Connect with your partner to play together"}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={14} color="#ff2d55" />
            </TouchableOpacity>
          )}

          {/* ── Active Confirmation Banner (if partner marked dare completed) ── */}
          {activeChallenges.some(
            (c) => c.sender_id === currentUserId && c.status === "COMPLETED_BY_RECEIVER"
          ) && (
            <View
              style={{
                marginHorizontal: 20,
                marginTop: 12,
                padding: 12,
                borderRadius: 16,
                backgroundColor: "rgba(245,158,11,0.12)",
                borderWidth: 1,
                borderColor: "rgba(245,158,11,0.3)",
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={{ color: "#fbbf24", fontWeight: "800", fontSize: 11 }}>
                  DARE COMPLETED BY PARTNER
                </Text>
                <Text style={{ color: "#ffffff", fontSize: 12, fontWeight: "600", marginTop: 2 }}>
                  Please confirm to reward your streak!
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  const toConfirm = activeChallenges.find(
                    (c) => c.sender_id === currentUserId && c.status === "COMPLETED_BY_RECEIVER"
                  );
                  if (toConfirm) handleConfirmCompleteCard(toConfirm.id);
                }}
                style={{
                  backgroundColor: "#f59e0b",
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 12,
                }}
              >
                <Text style={{ color: "#000000", fontWeight: "800", fontSize: 11 }}>
                  Confirm
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── 3. Hero Card: TODAY'S DARE ── */}
          <View className="mx-5 mt-4">
            <View
              style={{
                height: 240,
                borderRadius: 28,
                overflow: "hidden",
                position: "relative",
                backgroundColor: "#1c0d14",
              }}
            >
              <Image
                source={require("@/assets/images/couple_cover.jpeg")}
                style={{
                  width: "100%",
                  height: "100%",
                  position: "absolute",
                  top: 0,
                  left: 0,
                }}
                resizeMode="cover"
              />

              {/* Dark Gradient Overlay */}
              <View
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: "rgba(10, 3, 6, 0.45)",
                }}
              />

              {/* Top Row inside Hero Card: Tag & Heart */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: 16,
                  zIndex: 2,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    backgroundColor: "rgba(0,0,0,0.5)",
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 20,
                    borderWidth: 1,
                    borderColor: "rgba(255,255,255,0.12)",
                  }}
                >
                  <Ionicons name="flash" size={13} color="#f59e0b" style={{ marginRight: 5 }} />
                  <Text
                    style={{
                      color: "#fbcfe8",
                      fontSize: 10,
                      fontWeight: "800",
                      letterSpacing: 0.8,
                      textTransform: "uppercase",
                    }}
                  >
                    Today's Dare
                  </Text>
                </View>

                <TouchableOpacity
                  onPress={toggleHeroHeart}
                  activeOpacity={0.8}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: "rgba(0,0,0,0.4)",
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: 1,
                    borderColor: "rgba(255,255,255,0.12)",
                  }}
                >
                  <Ionicons
                    name={heroHeartFilled ? "heart" : "heart-outline"}
                    size={18}
                    color={heroHeartFilled ? "#ff2d55" : "#ffffff"}
                  />
                </TouchableOpacity>
              </View>

              {/* Center Title */}
              <View style={{ paddingHorizontal: 18, marginTop: 4, zIndex: 2 }}>
                <Text
                  style={{
                    color: "#ffffff",
                    fontSize: 26,
                    fontWeight: "800",
                    letterSpacing: -0.4,
                    lineHeight: 31,
                  }}
                >
                  {activeChallenges.length > 0 && activeChallenges[0]?.card?.title
                    ? activeChallenges[0].card.title
                    : `A new side\nof you  ♡`}
                </Text>
              </View>

              {/* Bottom Row: CTA Button & Script Quote */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "flex-end",
                  justifyContent: "space-between",
                  paddingHorizontal: 16,
                  paddingBottom: 16,
                  marginTop: "auto",
                  zIndex: 2,
                }}
              >
                <TouchableOpacity
                  activeOpacity={0.88}
                  onPress={() => {
                    if (activeChallenges.length > 0) {
                      navigateTo("/(tabs)/dares");
                    } else if (activeRoom && activeRoom.status === "ACTIVE") {
                      navigateTo("/(tabs)/dares");
                    } else {
                      openRoomModal("create");
                    }
                  }}
                  style={{
                    backgroundColor: "#ff2d55",
                    paddingHorizontal: 18,
                    paddingVertical: 10,
                    borderRadius: 24,
                    flexDirection: "row",
                    alignItems: "center",
                    shadowColor: "#ff2d55",
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.4,
                    shadowRadius: 8,
                    elevation: 5,
                  }}
                >
                  <Text style={{ color: "#ffffff", fontWeight: "800", fontSize: 14 }}>
                    Start Dare
                  </Text>
                  <Ionicons name="arrow-forward" size={15} color="#ffffff" style={{ marginLeft: 6 }} />
                </TouchableOpacity>

                <View style={{ alignItems: "flex-end" }}>
                  <Text
                    style={{
                      color: "#fbcfe8",
                      fontSize: 12,
                      fontStyle: "italic",
                      fontFamily: Platform.select({ ios: "Snell Roundhand", android: "serif", default: "serif" }),
                      lineHeight: 15,
                    }}
                  >
                    Small dares
                  </Text>
                  <Text
                    style={{
                      color: "#fbcfe8",
                      fontSize: 11,
                      fontStyle: "italic",
                      fontFamily: Platform.select({ ios: "Snell Roundhand", android: "serif", default: "serif" }),
                      lineHeight: 15,
                    }}
                  >
                    Big connections ♡
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* ── 4. Section: Continue Together ── */}
          <View className="mt-6 px-5">
            <View className="flex-row items-center justify-between mb-3">
              <Text style={{ color: "#ffffff", fontSize: 18, fontWeight: "800", letterSpacing: -0.3 }}>
                Continue Together
              </Text>
              <TouchableOpacity
                onPress={() => navigateTo("/history")}
                className="flex-row items-center"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={{ color: "#ff2d55", fontSize: 13, fontWeight: "700", marginRight: 2 }}>
                  See all
                </Text>
                <Ionicons name="chevron-forward" size={13} color="#ff2d55" />
              </TouchableOpacity>
            </View>

            <View
              style={{
                backgroundColor: "#160a10",
                borderWidth: 1,
                borderColor: "#2c121d",
                borderRadius: 22,
                padding: 14,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              {/* Left: Thumbnail */}
              <Image
                source={require("@/assets/images/bundle_cozy.jpg")}
                style={{
                  width: 60,
                  height: 60,
                  borderRadius: 14,
                  marginRight: 14,
                }}
                resizeMode="cover"
              />

              {/* Center: Details & Progress */}
              <View style={{ flex: 1, marginRight: 10 }}>
                <Text
                  style={{ color: "#ffffff", fontSize: 14, fontWeight: "700", letterSpacing: -0.2 }}
                  numberOfLines={1}
                >
                  30-Day Connection Jour...
                </Text>
                <Text style={{ color: "#94a3b8", fontSize: 11, fontWeight: "500", marginTop: 2 }}>
                  Day {currentStreak > 0 ? Math.min(currentStreak, 30) : 12} of 30
                </Text>

                {/* Progress Bar Row */}
                <View style={{ flexDirection: "row", alignItems: "center", marginTop: 8 }}>
                  <View
                    style={{
                      flex: 1,
                      height: 5,
                      backgroundColor: "#2a121c",
                      borderRadius: 3,
                      overflow: "hidden",
                      marginRight: 8,
                    }}
                  >
                    <View
                      style={{
                        width: "40%",
                        height: "100%",
                        backgroundColor: "#ff2d55",
                        borderRadius: 3,
                      }}
                    />
                  </View>
                  <Text style={{ color: "#94a3b8", fontSize: 10, fontWeight: "600" }}>40%</Text>
                </View>
              </View>

              {/* Right: Continue Button */}
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => navigateTo("/(tabs)/dares")}
                style={{
                  backgroundColor: "#35101a",
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderRadius: 20,
                  flexDirection: "row",
                  alignItems: "center",
                  borderWidth: 1,
                  borderColor: "rgba(255,45,85,0.2)",
                }}
              >
                <Text style={{ color: "#ffffff", fontSize: 12, fontWeight: "700" }}>Continue</Text>
                <Ionicons name="arrow-forward" size={12} color="#ffffff" style={{ marginLeft: 4 }} />
              </TouchableOpacity>
            </View>
          </View>

          {/* ── 5. Section: Recent Moments ── */}
          <View className="mt-6">
            <View className="flex-row items-center justify-between px-5 mb-3">
              <Text style={{ color: "#ffffff", fontSize: 18, fontWeight: "800", letterSpacing: -0.3 }}>
                Recent Moments
              </Text>
              <TouchableOpacity
                onPress={() => navigateTo("/history")}
                className="flex-row items-center"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={{ color: "#ff2d55", fontSize: 13, fontWeight: "700", marginRight: 2 }}>
                  See all
                </Text>
                <Ionicons name="chevron-forward" size={13} color="#ff2d55" />
              </TouchableOpacity>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}
            >
              {/* Moment 1 */}
              <View
                style={{
                  width: 130,
                  height: 175,
                  borderRadius: 22,
                  overflow: "hidden",
                  position: "relative",
                  backgroundColor: "#1b0d14",
                }}
              >
                <Image
                  source={require("@/assets/images/couple_beach_sunset.jpg")}
                  style={{ width: "100%", height: "100%" }}
                  resizeMode="cover"
                />
                <View
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: "rgba(0,0,0,0.3)",
                  }}
                />
                <TouchableOpacity
                  onPress={() => toggleMomentHeart("m1")}
                  style={{
                    position: "absolute",
                    top: 10,
                    right: 10,
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    backgroundColor: "rgba(0,0,0,0.4)",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons
                    name={likedMoments["m1"] ? "heart" : "heart-outline"}
                    size={14}
                    color={likedMoments["m1"] ? "#ff2d55" : "#ffffff"}
                  />
                </TouchableOpacity>
                <View style={{ position: "absolute", bottom: 12, left: 12, right: 12 }}>
                  <Text style={{ color: "#ffffff", fontSize: 13, fontWeight: "800" }}>Sunset Walk</Text>
                  <Text style={{ color: "#cbd5e1", fontSize: 10, fontWeight: "500", marginTop: 1 }}>
                    2 days ago
                  </Text>
                </View>
              </View>

              {/* Moment 2 */}
              <View
                style={{
                  width: 130,
                  height: 175,
                  borderRadius: 22,
                  overflow: "hidden",
                  position: "relative",
                  backgroundColor: "#1b0d14",
                }}
              >
                <Image
                  source={require("@/assets/images/couple_cafe_morning.jpg")}
                  style={{ width: "100%", height: "100%" }}
                  resizeMode="cover"
                />
                <View
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: "rgba(0,0,0,0.3)",
                  }}
                />
                <TouchableOpacity
                  onPress={() => toggleMomentHeart("m2")}
                  style={{
                    position: "absolute",
                    top: 10,
                    right: 10,
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    backgroundColor: "rgba(0,0,0,0.4)",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons
                    name={likedMoments["m2"] ? "heart" : "heart-outline"}
                    size={14}
                    color={likedMoments["m2"] ? "#ff2d55" : "#ffffff"}
                  />
                </TouchableOpacity>
                <View style={{ position: "absolute", bottom: 12, left: 12, right: 12 }}>
                  <Text style={{ color: "#ffffff", fontSize: 13, fontWeight: "800" }}>Coffee Date</Text>
                  <Text style={{ color: "#cbd5e1", fontSize: 10, fontWeight: "500", marginTop: 1 }}>
                    4 days ago
                  </Text>
                </View>
              </View>

              {/* Moment 3 */}
              <View
                style={{
                  width: 130,
                  height: 175,
                  borderRadius: 22,
                  overflow: "hidden",
                  position: "relative",
                  backgroundColor: "#1b0d14",
                }}
              >
                <Image
                  source={require("@/assets/images/couple_cooking_dinner.jpg")}
                  style={{ width: "100%", height: "100%" }}
                  resizeMode="cover"
                />
                <View
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: "rgba(0,0,0,0.3)",
                  }}
                />
                <TouchableOpacity
                  onPress={() => toggleMomentHeart("m3")}
                  style={{
                    position: "absolute",
                    top: 10,
                    right: 10,
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    backgroundColor: "rgba(0,0,0,0.4)",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons
                    name={likedMoments["m3"] ? "heart" : "heart-outline"}
                    size={14}
                    color={likedMoments["m3"] ? "#ff2d55" : "#ffffff"}
                  />
                </TouchableOpacity>
                <View style={{ position: "absolute", bottom: 12, left: 12, right: 12 }}>
                  <Text style={{ color: "#ffffff", fontSize: 13, fontWeight: "800" }}>Late Night Talk</Text>
                  <Text style={{ color: "#cbd5e1", fontSize: 10, fontWeight: "500", marginTop: 1 }}>
                    1 week ago
                  </Text>
                </View>
              </View>
            
            </>
          ) : (
            <View className="px-5 mt-8 pb-10">
              {activeRoom?.status === 'WAITING' ? (
                <View className="bg-white dark:bg-[#1a0c10] rounded-3xl p-6 border border-rose-100 dark:border-rose-950/40 shadow-sm relative overflow-hidden">
                  <View className="absolute -top-4 -right-4 opacity-10">
                    <Ionicons name="time" size={100} color={isDark ? "#f43f5e" : "#af2c3b"} />
                  </View>
                  <Text className="text-xl font-black text-slate-900 dark:text-white tracking-tight mb-2">
                    Waiting for Partner...
                  </Text>
                  <Text className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-6 leading-5">
                    Share the room code below with your partner so they can join your Love Room.
                  </Text>

                  <Text className="text-[10px] font-bold text-slate-400 dark:text-slate-500 tracking-widest uppercase mb-1.5">
                    Room Code
                  </Text>
                  <View className="flex-row items-center justify-between mb-6 bg-slate-50 dark:bg-[#200e14] p-4 rounded-xl border border-slate-100 dark:border-rose-950/20">
                    <Text className="text-2xl font-black text-[#af2c3b] dark:text-rose-400 tracking-widest">{activeRoom.code}</Text>
                    <TouchableOpacity onPress={async () => {
                      if (activeRoom?.code) {
                        await Clipboard.setStringAsync(activeRoom.code);
                        Alert.alert("Copied!", "Room code copied to clipboard.");
                      }
                    }} className="bg-rose-100 dark:bg-rose-900/40 px-4 py-2 rounded-full flex-row items-center">
                      <Ionicons name="copy-outline" size={16} color={isDark ? "#fda4af" : "#be123c"} />
                      <Text className="text-sm font-bold text-[#be123c] dark:text-rose-300 ml-1.5">Copy</Text>
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity onPress={handleLeaveRoom} className="py-4 flex-row items-center justify-center border-2 border-red-100 dark:border-red-900/30 rounded-xl bg-red-50 dark:bg-red-950/10">
                    <Ionicons name="log-out-outline" size={18} color="#ef4444" />
                    <Text className="text-sm font-bold text-red-500 ml-2">Cancel / Leave Room</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View className="bg-white dark:bg-[#1a0c10] rounded-3xl p-6 border border-rose-100 dark:border-rose-950/40 shadow-sm">
                  <View className="flex-row bg-[#f5eeed] dark:bg-rose-950/40 rounded-xl p-1.5 mb-6">
                    <TouchableOpacity
                      className={lex-1 py-3.5 rounded-lg items-center }
                      onPress={() => switchRoomModalTab("create")}
                    >
                      <Text className={ont-bold text-[13px] }>
                        Create Room
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      className={lex-1 py-3.5 rounded-lg items-center }
                      onPress={() => switchRoomModalTab("join")}
                    >
                      <Text className={ont-bold text-[13px] }>
                        Join Room
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {roomModalTab === "create" && (
                    <View>
                      <Text className="text-xl font-black text-slate-900 dark:text-white tracking-tight mb-2">
                        Create a Love Room
                      </Text>
                      <Text className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-6 leading-5">
                        Start a private room and share the code with your partner to connect.
                      </Text>

                      <Text className="text-[10px] font-bold text-slate-400 dark:text-slate-500 tracking-widest uppercase mb-3">
                        Room Duration
                      </Text>
                      <View className="flex-row gap-3 mb-6">
                        {(["7_DAYS", "30_DAYS"] as ExpiryType[]).map((type) => (
                          <TouchableOpacity
                            key={type}
                            className={lex-1 py-3.5 rounded-xl items-center border-2 }
                            onPress={() => setSelectedExpiry(type)}
                          >
                            <Text className={ont-bold text-[12px] }>
                              {expiryLabel(type)}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>

                      {actionError ? <Text className="text-red-500 font-medium text-[11px] mb-3">{actionError}</Text> : null}

                      <TouchableOpacity
                        onPress={handleCreateRoom}
                        disabled={actionLoading}
                        className={w-full py-4 rounded-xl items-center flex-row justify-center shadow-md dark:shadow-none }
                      >
                        {actionLoading ? (
                          <ActivityIndicator color="#fff" size="small" />
                        ) : (
                          <>
                            <Ionicons name="add-circle" size={18} color="white" />
                            <Text className="text-white font-bold text-[14px] ml-2 tracking-wide">Create Room</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </View>
                  )}

                  {roomModalTab === "join" && (
                    <View>
                      <Text className="text-xl font-black text-slate-900 dark:text-white tracking-tight mb-2">
                        Join Your Partner
                      </Text>
                      <Text className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-6 leading-5">
                        Enter the room code your partner shared with you.
                      </Text>

                      <View className="bg-white dark:bg-[#271318] rounded-xl border-2 border-slate-100 dark:border-rose-950/40 px-4 py-1 mb-4">
                        <TextInput
                          value={joinCode}
                          onChangeText={(text) => setJoinCode(text.toUpperCase())}
                          placeholder="e.g. SOU-L123"
                          placeholderTextColor={isDark ? "rgba(255,255,255,0.2)" : "#94a3b8"}
                          autoCapitalize="characters"
                          maxLength={8}
                          className="h-12 font-black text-center text-xl tracking-widest text-[#af2c3b] dark:text-rose-400"
                        />
                      </View>

                      {actionError ? <Text className="text-red-500 font-medium text-[11px] mb-3 text-center">{actionError}</Text> : null}

                      <TouchableOpacity
                        onPress={handleJoinRoom}
                        disabled={actionLoading}
                        className={w-full py-4 rounded-xl items-center flex-row justify-center shadow-md dark:shadow-none }
                      >
                        {actionLoading ? (
                          <ActivityIndicator color="#fff" size="small" />
                        ) : (
                          <>
                            <Ionicons name="log-in" size={18} color="white" />
                            <Text className="text-white font-bold text-[14px] ml-2 tracking-wide">Join Room</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              )}
            </View>
          )}
</ScrollView>
          </View>

          {/* ── 6. Section: Picked for You 💕 ── */}
          <View className="mt-6 mb-8">
            <View className="flex-row items-center justify-between px-5 mb-3">
              <Text style={{ color: "#ffffff", fontSize: 18, fontWeight: "800", letterSpacing: -0.3 }}>
                Picked for You 💕
              </Text>
              <TouchableOpacity
                onPress={() => navigateTo("/(tabs)/dares")}
                className="flex-row items-center"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={{ color: "#ff2d55", fontSize: 13, fontWeight: "700", marginRight: 2 }}>
                  See all
                </Text>
                <Ionicons name="chevron-forward" size={13} color="#ff2d55" />
              </TouchableOpacity>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}
            >
              {/* Pick 1: Romance */}
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => navigateTo("/(tabs)/dares")}
                style={{
                  width: 145,
                  height: 195,
                  borderRadius: 22,
                  overflow: "hidden",
                  position: "relative",
                  backgroundColor: "#1b0d14",
                }}
              >
                <Image
                  source={require("@/assets/images/couple_wildflower_sunset.jpg")}
                  style={{ width: "100%", height: "100%" }}
                  resizeMode="cover"
                />
                <View
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: "rgba(0,0,0,0.35)",
                  }}
                />
                {/* Badge Top Left */}
                <View
                  style={{
                    position: "absolute",
                    top: 10,
                    left: 10,
                    backgroundColor: "#ff2d55",
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: 6,
                  }}
                >
                  <Text style={{ color: "#ffffff", fontSize: 9, fontWeight: "900", letterSpacing: 0.5 }}>
                    ROMANCE
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => toggleMomentHeart("p1")}
                  style={{
                    position: "absolute",
                    top: 10,
                    right: 10,
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    backgroundColor: "rgba(0,0,0,0.4)",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons
                    name={likedMoments["p1"] ? "heart" : "heart-outline"}
                    size={14}
                    color={likedMoments["p1"] ? "#ff2d55" : "#ffffff"}
                  />
                </TouchableOpacity>
                <View style={{ position: "absolute", bottom: 12, left: 12, right: 12 }}>
                  <Text style={{ color: "#ffffff", fontSize: 13, fontWeight: "800", lineHeight: 16 }}>
                    {`Handwritten\nCompliments`}
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Pick 2: Deep */}
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => navigateTo("/(tabs)/dares")}
                style={{
                  width: 145,
                  height: 195,
                  borderRadius: 22,
                  overflow: "hidden",
                  position: "relative",
                  backgroundColor: "#1b0d14",
                }}
              >
                <Image
                  source={{ uri: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=600&auto=format&fit=crop&q=80" }}
                  style={{ width: "100%", height: "100%" }}
                  resizeMode="cover"
                />
                <View
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: "rgba(0,0,0,0.35)",
                  }}
                />
                {/* Badge Top Left */}
                <View
                  style={{
                    position: "absolute",
                    top: 10,
                    left: 10,
                    backgroundColor: "#2563eb",
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: 6,
                  }}
                >
                  <Text style={{ color: "#ffffff", fontSize: 9, fontWeight: "900", letterSpacing: 0.5 }}>
                    DEEP
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => toggleMomentHeart("p2")}
                  style={{
                    position: "absolute",
                    top: 10,
                    right: 10,
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    backgroundColor: "rgba(0,0,0,0.4)",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons
                    name={likedMoments["p2"] ? "heart" : "heart-outline"}
                    size={14}
                    color={likedMoments["p2"] ? "#ff2d55" : "#ffffff"}
                  />
                </TouchableOpacity>
                <View style={{ position: "absolute", bottom: 12, left: 12, right: 12 }}>
                  <Text style={{ color: "#ffffff", fontSize: 13, fontWeight: "800", lineHeight: 16 }}>
                    {`Our Dream\nSomeday`}
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Pick 3: Fun */}
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => navigateTo("/(tabs)/dares")}
                style={{
                  width: 145,
                  height: 195,
                  borderRadius: 22,
                  overflow: "hidden",
                  position: "relative",
                  backgroundColor: "#1b0d14",
                }}
              >
                <Image
                  source={{ uri: "https://images.unsplash.com/photo-1513297887119-d46091b24bfa?w=600&auto=format&fit=crop&q=80" }}
                  style={{ width: "100%", height: "100%" }}
                  resizeMode="cover"
                />
                <View
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: "rgba(0,0,0,0.35)",
                  }}
                />
                {/* Badge Top Left */}
                <View
                  style={{
                    position: "absolute",
                    top: 10,
                    left: 10,
                    backgroundColor: "#8b5cf6",
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: 6,
                  }}
                >
                  <Text style={{ color: "#ffffff", fontSize: 9, fontWeight: "900", letterSpacing: 0.5 }}>
                    FUN
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => toggleMomentHeart("p3")}
                  style={{
                    position: "absolute",
                    top: 10,
                    right: 10,
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    backgroundColor: "rgba(0,0,0,0.4)",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons
                    name={likedMoments["p3"] ? "heart" : "heart-outline"}
                    size={14}
                    color={likedMoments["p3"] ? "#ff2d55" : "#ffffff"}
                  />
                </TouchableOpacity>
                <View style={{ position: "absolute", bottom: 12, left: 12, right: 12 }}>
                  <Text style={{ color: "#ffffff", fontSize: 13, fontWeight: "800", lineHeight: 16 }}>
                    Yes or No
                  </Text>
                </View>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </ScrollView>

        {/* FULL-SCREEN LOADING SPINNER */}
        {isLeavingRoom && (
          <View
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 9999,
            }}
            className="bg-[#180D10]/90 items-center justify-center"
          >
            <View className="bg-[#241117] p-8 rounded-[32px] items-center border border-rose-950/40 shadow-rose-900/20">
              <ActivityIndicator size="large" color="#e11d48" />
              <Text className="text-white font-bold mt-6 text-lg tracking-wide">
                Leaving Room...
              </Text>
              <Text className="text-rose-400/80 text-xs font-medium mt-2">
                Disconnecting from partner
              </Text>
            </View>
          </View>
        )}

        {/* ═══════════════════════════════════════════════════════
          CARD RECEIVED POPUP MODAL
          ═══════════════════════════════════════════════════════ */}
        <Modal
          visible={!!selectedReceivedCard}
          transparent={true}
          animationType="fade"
          onRequestClose={() => {
            if (selectedReceivedCard)
              setDismissedCardIds((prev) => [...prev, selectedReceivedCard.id]);
            setSelectedReceivedCard(null);
            setShowDeflectDropdown(false);
          }}
        >
          <View
            style={{
              flex: 1,
              backgroundColor: "rgba(0,0,0,0.65)",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <View className="bg-white dark:bg-[#180D10] w-[85%] rounded-[32px] p-7 items-center shadow-2xl border border-rose-100 dark:border-rose-900/40">
              {selectedReceivedCard?.card?.image_url ? (
                <View className="w-full h-56 rounded-[20px] mb-5 overflow-hidden shadow-sm bg-slate-50 dark:bg-[#0f0608] dark:border dark:border-rose-950/40 relative">
                  <Image
                    source={{ uri: selectedReceivedCard.card.image_url }}
                    className="w-full h-full"
                    resizeMode="contain"
                  />
                  <View className="absolute inset-0 bg-black/10" />
                  <View className="absolute top-3 left-3 bg-white/95 dark:bg-black/70 px-3 py-1.5 rounded-full flex-row items-center shadow-sm">
                    <Ionicons
                      name={selectedReceivedCard.sender_id === currentUserId ? "paper-plane" : "mail-unread"}
                      size={12}
                      color={selectedReceivedCard.sender_id === currentUserId 
                        ? (isDark ? "#2dd4bf" : "#0d5f5a") 
                        : (isDark ? "#fda4af" : "#e11d48")}
                    />
                    <Text 
                      className="font-bold text-[9px] tracking-widest uppercase ml-1.5"
                      style={{
                        color: selectedReceivedCard.sender_id === currentUserId 
                          ? (isDark ? "#2dd4bf" : "#0d5f5a") 
                          : (isDark ? "#fda4af" : "#e11d48")
                      }}
                    >
                      {selectedReceivedCard.sender_id === currentUserId ? "Sent Dare" : "New Dare"}
                    </Text>
                  </View>
                </View>
              ) : (
                <View className="w-16 h-16 rounded-full bg-rose-50 dark:bg-rose-900/30 items-center justify-center mb-5 shadow-sm dark:shadow-none border border-rose-100 dark:border-rose-900/20">
                  <Ionicons 
                    name={selectedReceivedCard?.sender_id === currentUserId ? "paper-plane" : "mail-unread"} 
                    size={32} 
                    color={selectedReceivedCard?.sender_id === currentUserId ? "#0d5f5a" : "#e11d48"} 
                  />
                </View>
              )}

              <Text className="text-2xl font-black text-slate-900 dark:text-white mb-2 text-center tracking-tight px-2">
                {selectedReceivedCard?.card?.title || (selectedReceivedCard?.sender_id === currentUserId ? "Sent Challenge" : "New Challenge!")}
              </Text>

              <Text className="text-slate-500 dark:text-slate-400 text-center mb-4 font-medium leading-5 px-3 text-[14px]">
                {selectedReceivedCard?.card?.description ||
                  (selectedReceivedCard?.sender_id === currentUserId 
                    ? "You sent this dare to your partner. Waiting for them to complete it!" 
                    : "Your partner has sent you a new intimacy dare. What would you like to do?")}
              </Text>

              {selectedReceivedCard?.message ? (
                <View className="bg-rose-50/50 dark:bg-rose-950/20 px-4 py-3.5 rounded-xl border border-rose-100/30 dark:border-rose-950/40 mb-6 w-full shadow-sm dark:shadow-none">
                  <Text className="text-[#a12338] dark:text-rose-400 font-bold text-[10px] uppercase tracking-wider mb-1">
                    {selectedReceivedCard.sender_id === currentUserId ? "Your Note" : "Note from partner"}
                  </Text>
                  <Text className="text-slate-700 dark:text-slate-300 text-[13px] italic font-medium leading-5">
                    &quot;{selectedReceivedCard.message}&quot;
                  </Text>
                </View>
              ) : (
                <View className="h-2" />
              )}
              {selectedReceivedCard?.sender_id === currentUserId ? (
                <View className="w-full bg-slate-50 dark:bg-[#180D10]/50 py-6 rounded-2xl items-center border border-slate-100 dark:border-rose-950/20 px-4">
                  <Ionicons
                    name="time-outline"
                    size={32}
                    color={isDark ? "#94a3b8" : "#64748b"}
                    style={{ marginBottom: 12 }}
                  />
                  <Text className="text-slate-700 dark:text-slate-300 font-bold text-[15px] text-center mb-1">
                    Waiting for Partner
                  </Text>
                  <Text className="text-slate-500 dark:text-slate-400 text-[13px] text-center leading-5 mb-4">
                    You sent this dare to your partner. Waiting for them to
                    accept, reject, or deflect.
                  </Text>
                  <TouchableOpacity
                    className="w-full bg-rose-500/10 dark:bg-rose-500/20 py-3.5 rounded-xl items-center"
                    onPress={() => {
                      setSelectedReceivedCard(null);
                      setShowDeflectDropdown(false);
                    }}
                  >
                    <Text className="text-rose-600 dark:text-rose-400 font-bold text-[14px]">
                      Close
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View className="w-full gap-3.5">
                  <View className="w-full flex-row items-center justify-center bg-slate-50 dark:bg-[#180D10]/50 py-3 rounded-2xl border border-slate-100 dark:border-rose-950/20 mb-1">
                    <Ionicons name="time" size={14} color="#64748b" />
                    <Text className="text-slate-500 dark:text-slate-400 font-bold text-[12px] ml-1.5 mr-2">
                      Time Left to Decide:
                    </Text>
                    {getTargetDateStr(selectedReceivedCard) ? (
                      <CountdownTimer
                        targetDate={getTargetDateStr(selectedReceivedCard)}
                      />
                    ) : (
                      <Text className="text-slate-600 dark:text-slate-300 font-mono text-[12px] font-bold">
                        24:00:00
                      </Text>
                    )}
                  </View>

                  <TouchableOpacity
                    className="w-full bg-emerald-500 dark:bg-emerald-600 py-4 rounded-2xl items-center shadow-sm dark:shadow-none"
                    onPress={() =>
                      selectedReceivedCard &&
                      handleAcceptCard(selectedReceivedCard.id)
                    }
                  >
                    <Text className="text-white font-black text-[15px] tracking-wide">
                      Accept Challenge
                    </Text>
                  </TouchableOpacity>

                  {activeRoom?.expiry_type === "30_DAYS" && (
                    <View className="w-full">
                      <TouchableOpacity
                        className={`w-full bg-indigo-500 dark:bg-indigo-600 py-4 items-center shadow-sm dark:shadow-none flex-row justify-center ${showDeflectDropdown ? "rounded-t-2xl" : "rounded-2xl"}`}
                        onPress={() => {
                          if (deflectCardsCount > 0) {
                            setShowDeflectDropdown(!showDeflectDropdown);
                          } else {
                            Alert.alert(
                              "No Deflect Cards",
                              "You do not have any deflect cards available.",
                            );
                          }
                        }}
                      >
                        <Ionicons
                          name="return-up-back"
                          size={18}
                          color="white"
                          style={{ marginRight: 8 }}
                        />
                        <Text className="text-white font-bold text-[15px] tracking-wide">
                          Deflect ({deflectCardsCount} left)
                        </Text>
                        {deflectCardsCount > 0 && (
                          <Ionicons
                            name={
                              showDeflectDropdown
                                ? "chevron-up"
                                : "chevron-down"
                            }
                            size={16}
                            color="white"
                            style={{ marginLeft: 8 }}
                          />
                        )}
                      </TouchableOpacity>

                      {showDeflectDropdown && deflectCards.length > 0 && (
                        <View className="w-full bg-indigo-50/80 dark:bg-indigo-950/30 rounded-b-2xl border-x border-b border-indigo-100 dark:border-indigo-900/40 overflow-hidden">
                          {deflectCards.slice(0, 5).map((deflectCard, idx) => (
                            <TouchableOpacity
                              key={deflectCard.id}
                              className={`w-full p-4 flex-row justify-between items-center ${idx !== 0 ? "border-t border-indigo-100 dark:border-indigo-900/30" : ""}`}
                              onPress={() => {
                                if (selectedReceivedCard) {
                                  handleDeflectCard(
                                    selectedReceivedCard.id,
                                    deflectCard.id,
                                  );
                                }
                              }}
                            >
                              <View className="flex-1 pr-3">
                                <Text className="text-indigo-900 dark:text-indigo-100 font-bold text-[14px] mb-0.5">
                                  {deflectCard.cards?.name ||
                                    deflectCard.card?.title ||
                                    deflectCard.card?.name ||
                                    deflectCard.deflect_card?.title ||
                                    deflectCard.deflect_card?.name ||
                                    deflectCard.title ||
                                    deflectCard.name ||
                                    "Deflect Card"}
                                </Text>
                                <Text
                                  className="text-indigo-600 dark:text-indigo-400 text-[11px] font-medium"
                                  numberOfLines={1}
                                >
                                  {deflectCard.cards?.power_description ||
                                    deflectCard.cards?.description ||
                                    deflectCard.card?.description ||
                                    deflectCard.card?.power_description ||
                                    deflectCard.deflect_card?.description ||
                                    deflectCard.deflect_card
                                      ?.power_description ||
                                    deflectCard.description ||
                                    deflectCard.power_description ||
                                    "Send this challenge back!"}
                                </Text>
                              </View>
                              <View className="w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-900/50 items-center justify-center">
                                <Ionicons
                                  name="send"
                                  size={12}
                                  color="#4f46e5"
                                />
                              </View>
                            </TouchableOpacity>
                          ))}
                        </View>
                      )}
                    </View>
                  )}

                  <TouchableOpacity
                    className="w-full bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 py-4 rounded-2xl items-center flex-row justify-center"
                    onPress={() =>
                      selectedReceivedCard &&
                      handleRejectCard(
                        selectedReceivedCard.id,
                        selectedReceivedCard.room_id || activeRoom?.id || "",
                      )
                    }
                  >
                    <Ionicons
                      name="warning-outline"
                      size={16}
                      color={isDark ? "#f87171" : "#dc2626"}
                      style={{ marginRight: 6 }}
                    />
                    <Text className="text-red-600 dark:text-red-400 font-bold text-[14px]">
                      Reject (Penalty: 1 Card)
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    className="w-full py-2 items-center mt-1"
                    onPress={() => {
                      if (selectedReceivedCard)
                        setDismissedCardIds((prev) => [
                          ...prev,
                          selectedReceivedCard.id,
                        ]);
                      setSelectedReceivedCard(null);
                      setShowDeflectDropdown(false);
                    }}
                  >
                    <Text className="text-slate-400 dark:text-slate-500 font-bold text-[14px]">
                      Decide Later
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </Modal>

        {/* ── Penalty Gift Modal (When Partner Rejects) ── */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={penaltyGiftModalVisible}
          onRequestClose={() => setPenaltyGiftModalVisible(false)}
        >
          <View className="flex-1 justify-center items-center bg-black/60 px-4">
            <View className="w-full bg-white dark:bg-[#1f0f13] rounded-[32px] overflow-hidden items-center p-6 border border-slate-200 dark:border-rose-950/40 shadow-xl shadow-rose-900/20">
              <View className="w-20 h-20 rounded-full bg-rose-100 dark:bg-rose-950/40 items-center justify-center mb-5 border-4 border-white dark:border-[#1f0f13] -mt-12">
                <Ionicons
                  name="gift"
                  size={32}
                  color={isDark ? "#fda4af" : "#e11d48"}
                />
              </View>
              <Text className="text-2xl font-black text-slate-900 dark:text-white text-center mb-2 tracking-tight">
                Penalty Gift Received!
              </Text>
              <Text className="text-[13px] text-slate-500 dark:text-slate-400 text-center mb-6 px-2 font-medium leading-5">
                Your partner rejected your dare! As a penalty, one of their
                cards has been transferred to your deck:
              </Text>

              {penaltyGiftCard && (
                <View className="w-full bg-slate-50 dark:bg-[#271318]/50 rounded-2xl p-4 border border-slate-200 dark:border-rose-950/30 mb-6 flex-row items-center">
                  {penaltyGiftCard.image_url ? (
                    <Image
                      source={{ uri: penaltyGiftCard.image_url }}
                      className="w-14 h-14 rounded-xl mr-4"
                    />
                  ) : (
                    <View className="w-14 h-14 rounded-xl bg-rose-100 dark:bg-rose-950/40 items-center justify-center mr-4">
                      <Ionicons
                        name="card"
                        size={24}
                        color={isDark ? "#fda4af" : "#e11d48"}
                      />
                    </View>
                  )}
                  <View className="flex-1">
                    <Text className="text-[10px] font-bold text-rose-500 uppercase tracking-widest mb-1">
                      {penaltyGiftCard.category || "REWARD CARD"}
                    </Text>
                    <Text className="text-[15px] font-bold text-slate-800 dark:text-white leading-tight">
                      {penaltyGiftCard.name ||
                        penaltyGiftCard.title ||
                        "Mystery Card"}
                    </Text>
                  </View>
                </View>
              )}

              <TouchableOpacity
                className="w-full bg-rose-500 dark:bg-rose-600 py-4 rounded-2xl items-center"
                onPress={() => setPenaltyGiftModalVisible(false)}
              >
                <Text className="text-white font-bold text-[15px] tracking-wide">
                  Awesome!
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </ErrorBoundary>
  );
}
