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
        const resolvedAvatar =
          currentUserId === activeRoom.host_id
            ? activeRoom.partner_avatar
            : activeRoom.host_avatar;
        if (resolvedAvatar) {
          setPartnerAvatar(resolvedAvatar);
          await AsyncStorage.setItem(
            `partnerAvatar_${activeRoom.id}`,
            resolvedAvatar,
          );
        } else {
          const cachedAvatar = await AsyncStorage.getItem(
            `partnerAvatar_${activeRoom.id}`,
          );
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
      (c) => c.status === "IN_PROGRESS" || c.status === "COMPLETED_BY_RECEIVER",
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
      setPartnerAvatar(null);
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
      if (payload?.partnerAvatar) setPartnerAvatar(payload.partnerAvatar);
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
      setPartnerAvatar(null);
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

    GameSocket.on("partner_joined", handlePartnerJoined);
    GameSocket.on("room_updated", handlePartnerJoined);
    GameSocket.on("game_event", handleGameEvent);
    GameSocket.on("partner_left", handleRoomLeft);
    GameSocket.on("room_left", handleRoomLeft);
    GameSocket.on("room_closed", handleRoomLeft);

    return () => {
      GameSocket.off("partner_joined", handlePartnerJoined);
      GameSocket.off("room_updated", handlePartnerJoined);
      GameSocket.off("game_event", handleGameEvent);
      GameSocket.off("partner_left", handleRoomLeft);
      GameSocket.off("room_left", handleRoomLeft);
      GameSocket.off("room_closed", handleRoomLeft);
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
        s.id === sendId ? { ...s, status: "COMPLETED_BY_RECEIVER" } : s,
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
              setPartnerAvatar(null);

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

  const navigateTo = async (path: string) => {
    const { router } = await import("expo-router");
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
      case "1_YEAR":
        return "1 Year";
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
      } else if (card.status === "SENT" || card.status === "WAITING") {
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
        className="flex-1 bg-rose-50 dark:bg-[#0F0608]"
        edges={["top", "left", "right"]}
      >
        {/* Status bar configuration if needed */}
        <StatusBar
          barStyle={isDark ? "light-content" : "dark-content"}
          backgroundColor={isDark ? "#0F0608" : "#fff1f2"}
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
                      {(["7_DAYS", "30_DAYS", "1_YEAR"] as ExpiryType[]).map(
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
          contentContainerStyle={{ paddingBottom: 160 }}
        >
          {/* Header */}
          <View className="flex-row items-center justify-between px-6 pt-5 pb-3">
            <TouchableOpacity onPress={openSidebar}>
              <Ionicons
                name="menu-outline"
                size={30}
                color={isDark ? "#fff" : "#9f1239"}
              />
            </TouchableOpacity>
            <View className="flex-row items-center gap-1.5">
              <Ionicons
                name="infinite"
                size={28}
                color={isDark ? "#fda4af" : "#be123c"}
                style={{ transform: [{ rotate: "-15deg" }] }}
              />
              <Text className="text-red-700 dark:text-rose-400 font-black text-xl tracking-tight">
                SoulShuffle
              </Text>
            </View>
            <View className="flex-row items-center gap-3">
              <TouchableOpacity
                onPress={() => navigateTo("/notifications")}
                style={{ position: "relative" }}
              >
                <Ionicons
                  name="notifications-outline"
                  size={26}
                  color={isDark ? "#fff" : "#9f1239"}
                />
                {unreadCount > 0 && (
                  <View
                    style={{
                      position: "absolute",
                      top: -4,
                      right: -4,
                      backgroundColor: "#e11d48",
                      borderRadius: 10,
                      minWidth: 18,
                      height: 18,
                      alignItems: "center",
                      justifyContent: "center",
                      borderWidth: 2,
                      borderColor: isDark ? "#0F0608" : "#fff1f2",
                    }}
                  >
                    <Text
                      style={{ color: "#fff", fontSize: 10, fontWeight: "800" }}
                    >
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => navigateTo("/profile")}>
                <Image
                  source={{ uri: userAvatar }}
                  className="w-8 h-8 rounded-full border border-rose-200 dark:border-slate-800"
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Welcome Section */}
          <View className="px-6 mt-4 items-center justify-center">
            <Text
              style={{
                fontFamily: Platform.select({
                  ios: "Georgia",
                  android: "serif",
                  default: "serif",
                }),
              }}
              className="text-[34px] leading-[42px] font-semibold italic text-center text-[#9f1239] dark:text-rose-300 tracking-wide"
            >
              Welcome back{userName ? `, ${userName}` : ""}
              {activeRoom?.status === "ACTIVE" ? `\n& ${partnerName}` : ""} 💕
            </Text>
          </View>

          {/* Couple Image with Daily Rotation */}
          <View className="px-6 mt-6">
            <TouchableOpacity
              activeOpacity={0.92}
              onPress={handleNextCouplePhoto}
              className="relative overflow-hidden rounded-[36px] shadow-sm bg-rose-100 dark:bg-rose-950/20"
            >
              <Image
                source={COUPLE_PHOTOS[currentPhotoIndex].source}
                className="w-full h-56 rounded-[36px]"
                resizeMode="cover"
              />
              {/* Bottom dots indicator */}
              <View className="absolute bottom-3.5 right-4 bg-black/30 backdrop-blur-md px-2.5 py-1.5 rounded-full flex-row items-center space-x-1">
                {COUPLE_PHOTOS.map((_, idx) => (
                  <View
                    key={idx}
                    className={`h-1.5 rounded-full ${idx === currentPhotoIndex ? "w-3.5 bg-rose-400" : "w-1.5 bg-white/40"}`}
                  />
                ))}
              </View>
            </TouchableOpacity>
          </View>

          {/* Stats Section */}
          <View className="flex-row justify-between px-6 mt-5">
            <View
              className="rounded-[24px] px-5 py-4 w-[47%] shadow-sm border"
              style={{
                backgroundColor: isDark ? "#271318" : "#ffffff",
                borderColor: isDark ? "rgba(225,29,72,0.3)" : "rgba(225,29,72,0.15)",
              }}
            >
              <View
                style={{ backgroundColor: isDark ? "rgba(244,63,94,0.15)" : "#ffe4e6" }}
                className="w-8 h-8 rounded-full items-center justify-center mb-3"
              >
                <Ionicons
                  name="medal"
                  size={17}
                  color={isDark ? "#f43f5e" : "#e11d48"}
                />
              </View>
              <Text
                style={{ color: isDark ? "#fb7185" : "#0f172a" }}
                className="text-[26px] leading-8 font-black"
              >
                {finishedDaresCount}
              </Text>
              <Text
                style={{ color: isDark ? "#94a3b8" : "#64748b" }}
                className="text-[9px] font-bold mt-1 tracking-widest uppercase"
              >
                Dares Finished
              </Text>
            </View>
            <View
              className="rounded-[24px] px-5 py-4 w-[47%] shadow-sm border"
              style={{
                backgroundColor: isDark ? "#122220" : "#ffffff",
                borderColor: isDark ? "rgba(13,148,136,0.3)" : "rgba(13,148,136,0.15)",
              }}
            >
              <View
                style={{ backgroundColor: isDark ? "rgba(45,212,191,0.15)" : "#ccfbf1" }}
                className="w-8 h-8 rounded-full items-center justify-center mb-3"
              >
                <Ionicons
                  name="flame"
                  size={17}
                  color={isDark ? "#2dd4bf" : "#0d9488"}
                />
              </View>
              <Text
                style={{ color: isDark ? "#2dd4bf" : "#0f172a" }}
                className="text-[26px] leading-8 font-black"
              >
                {currentStreak}
              </Text>
              <Text
                style={{ color: isDark ? "#94a3b8" : "#64748b" }}
                className="text-[9px] font-bold mt-1 tracking-widest uppercase"
              >
                Day Streak
              </Text>
            </View>
          </View>

          {/* ═══════════════════════════════════════════════════
            COUPLE ROOM SECTION
            ═══════════════════════════════════════════════════ */}
          <View className="mx-6 mt-6">
            {roomLoading ? (
              /* Loading State */
              <View
                className="rounded-[28px] p-8 items-center shadow-sm border"
                style={{
                  backgroundColor: isDark ? "#271318" : "#ffffff",
                  borderColor: isDark ? "rgba(225,29,72,0.2)" : "rgba(225,29,72,0.15)",
                }}
              >
                <ActivityIndicator
                  size="large"
                  color={isDark ? "#f43f5e" : "#e11d48"}
                />
                <Text
                  style={{ color: isDark ? "#fda4af" : "#64748b" }}
                  className="font-semibold text-sm mt-3"
                >
                  Checking room status...
                </Text>
              </View>
            ) : activeRoom &&
              (activeRoom.status === "ACTIVE" ||
                activeRoom.status === "WAITING") ? (
              <View
                key="active-room-card"
                className="rounded-[28px] overflow-hidden shadow-lg border"
                style={{
                  backgroundColor: isDark ? "#271318" : "#ffffff",
                  borderColor: isDark ? "rgba(225,29,72,0.2)" : "rgba(225,29,72,0.15)",
                  borderLeftWidth: activeRoom.status === "ACTIVE" ? 5 : 1,
                  borderLeftColor: activeRoom.status === "ACTIVE" ? "#0d9488" : (isDark ? "rgba(225,29,72,0.2)" : "rgba(225,29,72,0.15)"),
                }}
              >
                {/* Room Header Strip Redesigned */}
                <View
                  style={{
                    backgroundColor: isDark ? "rgba(244,63,94,0.08)" : "#fff1f2",
                    borderBottomColor: isDark ? "rgba(225,29,72,0.15)" : "#fce7f3",
                  }}
                  className="px-5 py-3 flex-row items-center justify-between border-b"
                >
                  <View className="flex-row items-center">
                    <View
                      className={`w-2 h-2 rounded-full mr-2 ${activeRoom.status === "ACTIVE" ? "bg-teal-500 shadow-sm" : "bg-amber-500"}`}
                    />
                    <Text
                      style={{
                        color: activeRoom.status === "ACTIVE"
                          ? (isDark ? "#2dd4bf" : "#0d9488")
                          : (isDark ? "#fbbf24" : "#d97706"),
                      }}
                      className="font-bold text-[10px] tracking-widest uppercase"
                    >
                      {activeRoom.status === "ACTIVE"
                        ? "Room Active"
                        : "Waiting for Partner"}
                    </Text>
                  </View>
                  <View
                    style={{ backgroundColor: isDark ? "rgba(225,29,72,0.2)" : "#ffe4e6" }}
                    className="px-2.5 py-0.5 rounded-full"
                  >
                    <Text
                      style={{ color: isDark ? "#fda4af" : "#be123c" }}
                      className="font-bold text-[9px] tracking-wider uppercase"
                    >
                      {expiryLabel(activeRoom.expiry_type)}
                    </Text>
                  </View>
                </View>

                <View className="p-5">
                  {/* Room Code Display */}
                  <Text
                    style={{ color: isDark ? "#94a3b8" : "#64748b" }}
                    className="text-[9px] font-bold tracking-widest uppercase mb-1.5"
                  >
                    Room Code
                  </Text>
                  <View
                    style={{
                      backgroundColor: isDark ? "#180D10" : "#f8fafc",
                      borderColor: isDark ? "rgba(225,29,72,0.2)" : "#e2e8f0",
                    }}
                    className="flex-row items-center justify-between border rounded-2xl px-4 py-3 mb-4"
                  >
                    <Text
                      style={{ color: isDark ? "#fda4af" : "#be123c" }}
                      className="text-lg font-black tracking-widest flex-1 mr-2"
                    >
                      {formatRoomCodeForDisplay(activeRoom.code)}
                    </Text>
                    <TouchableOpacity
                      style={{ backgroundColor: copiedCode ? "#0d5f5a" : (isDark ? "#e11d48" : "#af2c3b") }}
                      className="px-3 py-2 rounded-xl flex-row items-center"
                      onPress={() =>
                        handleCopyCode(
                          formatRoomCodeForDisplay(activeRoom.code),
                        )
                      }
                    >
                      <Ionicons
                        name={copiedCode ? "checkmark" : "copy"}
                        size={13}
                        color="white"
                      />
                      <Text className="text-white font-bold text-[10px] ml-1">
                        {copiedCode ? "Copied!" : "Copy"}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Status Info Redesigned */}
                  <View
                    style={{
                      backgroundColor: isDark ? "#180D10" : "#fdf2f4",
                      borderColor: isDark ? "rgba(225,29,72,0.2)" : "#fce7f3",
                    }}
                    className="border rounded-[20px] p-3.5 mb-4 items-center justify-center"
                  >
                    <View className="flex-row items-center justify-center mb-3">
                      {/* User Avatar */}
                      <View
                        className={`w-10 h-10 rounded-full border-2 overflow-hidden shadow-sm ${
                          activeRoom.status === "ACTIVE"
                            ? "border-teal-500"
                            : "border-rose-500"
                        }`}
                      >
                        <Image
                          source={{ uri: userAvatar }}
                          className="w-full h-full"
                        />
                      </View>

                      {/* Connection Line & Heart Indicator */}
                      <View className="flex-row items-center mx-3">
                        <View
                          className={`w-4 h-[2px] ${activeRoom.status === "ACTIVE" ? "bg-teal-500/50" : "bg-rose-300 dark:bg-rose-950/40"}`}
                        />
                        <View
                          className={`w-8 h-8 rounded-full items-center justify-center shadow-sm ${
                            activeRoom.status === "ACTIVE"
                              ? "bg-teal-500"
                              : "bg-amber-500"
                          }`}
                        >
                          <Ionicons
                            name={
                              activeRoom.status === "ACTIVE"
                                ? "heart"
                                : "hourglass-outline"
                            }
                            size={14}
                            color="white"
                          />
                        </View>
                        <View
                          className={`w-4 h-[2px] ${activeRoom.status === "ACTIVE" ? "bg-teal-500/50" : "bg-rose-300 dark:bg-rose-950/40"}`}
                        />
                      </View>

                      {/* Partner Avatar / Placeholder */}
                      {activeRoom.status === "ACTIVE" ? (
                        <View className="w-10 h-10 rounded-full border-2 border-teal-500 overflow-hidden shadow-sm">
                          <Image
                            source={{
                              uri: partnerAvatar || ANIMATED_AVATARS[1].url,
                            }}
                            className="w-full h-full"
                          />
                        </View>
                      ) : (
                        <View
                          style={{
                            borderColor: isDark ? "rgba(225,29,72,0.3)" : "#cbd5e1",
                            backgroundColor: isDark ? "#0F0608" : "#f1f5f9",
                          }}
                          className="w-10 h-10 rounded-full border-2 border-dashed items-center justify-center shadow-sm"
                        >
                          <Ionicons
                            name="person-add"
                            size={14}
                            color={isDark ? "#fda4af" : "#94a3b8"}
                          />
                        </View>
                      )}
                    </View>

                    <View className="items-center">
                      {activeRoom.status === "ACTIVE" ? (
                        <>
                          <Text
                            style={{ color: isDark ? "#ffffff" : "#0f172a" }}
                            className="font-extrabold text-[13px] text-center mb-0.5"
                          >
                            Connected with{" "}
                            <Text className="text-teal-600 dark:text-teal-400 font-black">
                              {partnerName}
                            </Text>{" "}
                            💕
                          </Text>
                          <Text
                            style={{ color: isDark ? "#94a3b8" : "#64748b" }}
                            className="font-semibold text-[10px] text-center px-2 leading-3.5"
                          >
                            {partnerName} is online and connected! Ready to swap
                            spicy and sweet dares together.
                          </Text>
                        </>
                      ) : (
                        <>
                          <Text
                            style={{ color: isDark ? "#ffffff" : "#0f172a" }}
                            className="font-extrabold text-[13px] text-center mb-0.5"
                          >
                            Waiting for Partner...
                          </Text>
                          <Text
                            style={{ color: isDark ? "#94a3b8" : "#64748b" }}
                            className="font-semibold text-[10px] text-center px-2 leading-3.5"
                          >
                            Share the room code above with your partner so they
                            can join your Love Room.
                          </Text>
                        </>
                      )}
                    </View>
                  </View>

                  {activeRoom.status === "ACTIVE" && (
                    <TouchableOpacity
                      style={{ backgroundColor: isDark ? "#e11d48" : "#af2c3b" }}
                      className="rounded-full py-[12px] items-center shadow flex-row justify-center mb-2"
                      activeOpacity={0.8}
                      onPress={() => navigateTo("/dares")}
                    >
                      <Ionicons name="flash" size={16} color="white" />
                      <Text className="text-white font-bold text-[13px] ml-2">
                        Send Challenge
                      </Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    className="py-2 items-center flex-row justify-center mt-1"
                    onPress={handleLeaveRoom}
                  >
                    <Ionicons
                      name="exit-outline"
                      size={13}
                      color={isDark ? "#f87171" : "#ef4444"}
                    />
                    <Text className="text-red-500 dark:text-red-400 font-bold text-[11px] tracking-wide ml-1.5">
                      Leave Room
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              /* ── NO ROOM CARD ────────────────────────────── */
              <View
                key="no-room-card"
                className="rounded-[28px] p-5 shadow-lg relative overflow-hidden border"
                style={{
                  minHeight: 200,
                  justifyContent: "center",
                  backgroundColor: isDark ? "#271318" : "#ffffff",
                  borderColor: isDark ? "rgba(225,29,72,0.2)" : "rgba(225,29,72,0.15)",
                }}
              >
                {/* Background decorative elements */}
                <View
                  style={{ top: -30, right: -20, backgroundColor: isDark ? "rgba(244,63,94,0.1)" : "#ffe4e6" }}
                  className="absolute w-28 h-28 rounded-full"
                />
                <View
                  style={{ bottom: -20, left: -15, backgroundColor: isDark ? "rgba(45,212,191,0.1)" : "#ccfbf1" }}
                  className="absolute w-20 h-20 rounded-full"
                />

                <View className="flex-row items-center mb-1.5">
                  <View
                    style={{ backgroundColor: isDark ? "rgba(244,63,94,0.15)" : "#ffe4e6" }}
                    className="w-8 h-8 rounded-full items-center justify-center mr-2.5"
                  >
                    <Ionicons
                      name="people"
                      size={16}
                      color={isDark ? "#f43f5e" : "#af2c3b"}
                    />
                  </View>
                  <Text style={{ color: isDark ? "#fda4af" : "#be123c" }} className="text-[10px] font-bold tracking-widest uppercase">
                    Couple Room
                  </Text>
                </View>

                <Text style={{ color: isDark ? "#ffffff" : "#0f172a" }} className="text-xl font-black tracking-tight mt-1 mb-1 leading-6">
                  Connect with{"\n"}Your Partner
                </Text>
                <Text style={{ color: isDark ? "#94a3b8" : "#64748b" }} className="font-medium text-[12px] leading-5 mb-5 pr-8">
                  Create or join a private room to start playing together.
                </Text>

                <View className="flex-row gap-3">
                  <TouchableOpacity
                    style={{ backgroundColor: isDark ? "#e11d48" : "#af2c3b" }}
                    className="flex-1 rounded-2xl py-4 items-center shadow-md flex-row justify-center"
                    activeOpacity={0.8}
                    onPress={() => openRoomModal("create")}
                  >
                    <Ionicons name="add-circle" size={18} color="white" />
                    <Text className="text-white font-bold text-[13px] ml-2">
                      Create
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={{ backgroundColor: isDark ? "#0d9488" : "#0d5f5a" }}
                    className="flex-1 rounded-2xl py-4 items-center shadow-md flex-row justify-center"
                    activeOpacity={0.8}
                    onPress={() => openRoomModal("join")}
                  >
                    <Ionicons name="enter" size={18} color="white" />
                    <Text className="text-white font-bold text-[13px] ml-2">
                      Join
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>

          {/* Active Challenge Section */}
          {activeChallenge && (
            <View
              className="mx-6 mt-6 rounded-[32px] overflow-hidden shadow-lg border"
              style={{
                backgroundColor: isDark ? "#271318" : "#ffffff",
                borderColor: isDark ? "rgba(225,29,72,0.2)" : "rgba(225,29,72,0.15)",
              }}
            >
              <View className="h-40 relative">
                <Image
                  source={{ uri: activeChallenge.card.image_url }}
                  className="w-full h-full"
                  resizeMode="cover"
                />
                <View className="absolute inset-0 bg-black/25" />
                {activeChallenge.status === "COMPLETED_BY_RECEIVER" ? (
                  activeChallenge.sender_id === currentUserId ? (
                    <View className="absolute top-4 left-4 bg-amber-500 dark:bg-amber-600 px-3 py-1.5 rounded-full flex-row items-center shadow-sm">
                      <Ionicons name="alert-circle" size={12} color="white" />
                      <Text className="text-white font-bold text-[10px] tracking-widest uppercase ml-1.5">
                        Needs Confirmation
                      </Text>
                    </View>
                  ) : (
                    <View className="absolute top-4 left-4 bg-slate-400 dark:bg-slate-500 px-3 py-1.5 rounded-full flex-row items-center shadow-sm">
                      <Ionicons name="time" size={12} color="white" />
                      <Text className="text-white font-bold text-[10px] tracking-widest uppercase ml-1.5">
                        Waiting for Partner
                      </Text>
                    </View>
                  )
                ) : (
                  (() => {
                    const targetDateStr = getTargetDateStr(activeChallenge);
                    const targetTime = targetDateStr
                      ? new Date(targetDateStr).getTime()
                      : 0;
                    const isExpired =
                      targetTime > 0 && targetTime <= new Date().getTime();

                    if (isExpired) {
                      return (
                        <View className="absolute top-4 left-4 bg-slate-500 dark:bg-slate-600 px-3 py-1.5 rounded-full flex-row items-center">
                          <Ionicons name="time" size={12} color="white" />
                          <Text className="text-white font-bold text-[10px] tracking-widest uppercase ml-1.5">
                            Expired
                          </Text>
                        </View>
                      );
                    }

                    return activeChallenge.sender_id === currentUserId ? (
                      <View className="absolute top-4 left-4 bg-teal-500 dark:bg-teal-600 px-3 py-1.5 rounded-full flex-row items-center">
                        <Ionicons name="paper-plane" size={12} color="white" />
                        <Text className="text-white font-bold text-[10px] tracking-widest uppercase ml-1.5">
                          Sent Dare (In Progress)
                        </Text>
                      </View>
                    ) : (
                      <View className="absolute top-4 left-4 bg-[#fde047] px-3 py-1.5 rounded-full flex-row items-center shadow-sm">
                        <Ionicons name="flash" size={12} color="#854d0e" />
                        <Text className="text-[#854d0e] font-bold text-[10px] tracking-widest uppercase ml-1.5">
                          My Active Challenge
                        </Text>
                      </View>
                    );
                  })()
                )}
              </View>
              <View className="p-6">
                <Text
                  style={{ color: isDark ? "#fda4af" : "#be123c" }}
                  className="text-[10px] font-bold tracking-widest uppercase mb-2"
                >
                  {activeChallenge.card.category}
                </Text>
                <Text
                  style={{ color: isDark ? "#ffffff" : "#0f172a" }}
                  className="text-2xl font-black tracking-tight mb-3"
                >
                  {activeChallenge.card.title}
                </Text>

                {activeChallenge.sender_id === currentUserId &&
                  (activeChallenge.status === "COMPLETED_BY_RECEIVER" ? (
                    <View
                      style={{
                        backgroundColor: isDark ? "#271318" : "#fffbeb",
                        borderColor: isDark ? "rgba(245,158,11,0.2)" : "#fef3c7",
                      }}
                      className="px-4 py-3 rounded-2xl border mb-5 flex-row items-center"
                    >
                      <Ionicons
                        name="gift-outline"
                        size={16}
                        color={isDark ? "#fbbf24" : "#d97706"}
                      />
                      <Text
                        style={{ color: isDark ? "#fbbf24" : "#b45309" }}
                        className="font-semibold text-[12.5px] leading-5 ml-2.5 flex-1"
                      >
                        Your partner marked this dare as completed. Please
                        confirm!
                      </Text>
                    </View>
                  ) : (
                    <View
                      style={{
                        backgroundColor: isDark ? "#180D10" : "#f0fdfa",
                        borderColor: isDark ? "rgba(13,148,136,0.2)" : "#ccfbf1",
                      }}
                      className="px-4 py-3 rounded-2xl border mb-5 flex-row items-center"
                    >
                      <Ionicons
                        name="hourglass-outline"
                        size={16}
                        color={isDark ? "#2dd4bf" : "#0d5f5a"}
                      />
                      <Text
                        style={{ color: isDark ? "#2dd4bf" : "#0d5f5a" }}
                        className="font-semibold text-[12.5px] leading-5 ml-2.5 flex-1"
                      >
                        Your partner accepted this dare and is completing it.
                      </Text>
                    </View>
                  ))}

                <Text
                  style={{ color: isDark ? "#cbd5e1" : "#475569" }}
                  className="text-[14px] leading-6 font-medium mb-5"
                >
                  {activeChallenge.card.description}
                </Text>

                {activeChallenge.message ? (
                  <View
                    style={{
                      backgroundColor: isDark ? "rgba(244,63,94,0.08)" : "#fff1f2",
                      borderColor: isDark ? "rgba(244,63,94,0.2)" : "#fce7f3",
                    }}
                    className="px-4 py-3 rounded-2xl border mb-5"
                  >
                    <Text
                      style={{ color: isDark ? "#fda4af" : "#be123c" }}
                      className="font-bold text-[10px] uppercase tracking-wider mb-1"
                    >
                      {activeChallenge.sender_id === currentUserId
                        ? "Your note to partner"
                        : "Note from partner"}
                    </Text>
                    <Text
                      style={{ color: isDark ? "#cbd5e1" : "#475569" }}
                      className="text-[13px] italic font-medium leading-5"
                    >
                      &quot;{activeChallenge.message}&quot;
                    </Text>
                  </View>
                ) : null}

                {/* Spacing & Divider */}
                <View className="h-[1px] bg-slate-100 dark:bg-rose-950/20 my-4" />

                <View className="flex-row items-center justify-between mb-4 mt-2">
                  <View className="flex-row items-center">
                    <Ionicons name="time" size={14} color="#64748b" />
                    <Text className="text-slate-500 dark:text-slate-400 font-bold text-[12.5px] ml-2 mr-2">
                      Time Left:
                    </Text>
                    {getTargetDateStr(activeChallenge) ? (
                      <CountdownTimer
                        targetDate={getTargetDateStr(activeChallenge)}
                      />
                    ) : null}
                  </View>
                </View>

                {activeChallenge.sender_id !== currentUserId ? (
                  activeChallenge.status === "COMPLETED_BY_RECEIVER" ? (
                    <View className="bg-slate-100 dark:bg-[#271318]/50 py-3.5 rounded-2xl border border-slate-200/45 dark:border-rose-950/10 items-center">
                      <Text className="text-slate-400 dark:text-slate-500 font-bold text-[12.5px]">
                        Waiting for confirmation...
                      </Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      className="bg-emerald-500 dark:bg-emerald-600 py-3.5 rounded-full flex-row items-center justify-center shadow-md dark:shadow-none active:opacity-85"
                      onPress={() => handleCompleteCard(activeChallenge.id)}
                    >
                      <Ionicons
                        name="checkmark-circle"
                        size={16}
                        color="white"
                      />
                      <Text className="text-white font-bold text-[13.5px] ml-2">
                        Complete Challenge
                      </Text>
                    </TouchableOpacity>
                  )
                ) : activeChallenge.status === "COMPLETED_BY_RECEIVER" ? (
                  <TouchableOpacity
                    className="bg-emerald-500 dark:bg-emerald-600 py-3.5 rounded-full flex-row items-center justify-center shadow-md dark:shadow-none active:opacity-85"
                    onPress={() =>
                      handleConfirmCompleteCard(activeChallenge.id)
                    }
                  >
                    <Ionicons name="checkmark-circle" size={16} color="white" />
                    <Text className="text-white font-bold text-[13.5px] ml-2">
                      Confirm Completion
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    className="bg-rose-50 dark:bg-slate-800/60 py-3.5 rounded-full border border-rose-100 dark:border-slate-700/40 items-center justify-center"
                    onPress={() => navigateTo("/history")}
                  >
                    <Text className="text-[#b91c1c] dark:text-rose-400 font-bold text-[13.5px]">
                      View History
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}

          {/* Pending Challenges Section */}
          {displayPendingChallenges.length > 0 && (
            <View className="mt-8 mb-2">
              <View className="flex-row items-center justify-between px-6 mb-4">
                <Text className="text-xl font-black text-slate-900 dark:text-rose-100 tracking-tight">
                  Pending Dares
                </Text>
                <View className="bg-amber-100 dark:bg-amber-500/20 px-2 py-0.5 rounded-full">
                  <Text className="text-amber-600 dark:text-amber-400 font-bold text-[10px] uppercase tracking-wider">
                    {displayPendingChallenges.length} waiting
                  </Text>
                </View>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 24, gap: 16 }}
              >
                {displayPendingChallenges.map((cardSend) => (
                  <View
                    key={cardSend.id}
                    style={{
                      width: width - 48,
                      backgroundColor: isDark ? "#271318" : "#ffffff",
                      borderColor: isDark ? "rgba(225,29,72,0.2)" : "rgba(225,29,72,0.15)",
                    }}
                    className="rounded-[28px] overflow-hidden shadow-lg border"
                  >
                    <View className="h-32 relative">
                      <Image
                        source={{ uri: cardSend.card?.image_url }}
                        className="w-full h-full"
                        resizeMode="cover"
                      />
                      <View className="absolute inset-0 bg-black/40" />
                      <View className="absolute top-3 left-3 bg-white/90 dark:bg-black/70 px-2.5 py-1 rounded-full flex-row items-center">
                        <Ionicons
                          name={
                            cardSend.sender_id === currentUserId
                              ? "paper-plane"
                              : "mail-unread"
                          }
                          size={12}
                          color={
                            cardSend.sender_id === currentUserId
                              ? isDark
                                ? "#2dd4bf"
                                : "#0d5f5a"
                              : isDark
                                ? "#fda4af"
                                : "#e11d48"
                          }
                        />
                        <Text
                          className={`font-bold text-[9px] tracking-widest uppercase ml-1.5 ${cardSend.sender_id === currentUserId ? "text-teal-600 dark:text-teal-400" : "text-rose-600 dark:text-rose-400"}`}
                        >
                          {cardSend.sender_id === currentUserId
                            ? "Sent"
                            : "Received"}
                        </Text>
                      </View>
                      {activeRoom?.expiry_type === "30_DAYS" &&
                        cardSend.sender_id !== currentUserId && (
                          <View className="absolute top-3 right-3 bg-indigo-500/90 px-2.5 py-1 rounded-full flex-row items-center">
                            <Ionicons
                              name="shield-checkmark"
                              size={11}
                              color="white"
                            />
                            <Text className="text-white font-bold text-[9px] uppercase tracking-wider ml-1">
                              Deflect Available ({deflectCardsCount})
                            </Text>
                          </View>
                        )}
                    </View>
                    <View className="p-5">
                      <Text
                        style={{ color: isDark ? "#fda4af" : "#be123c" }}
                        className="text-[9px] font-bold tracking-widest uppercase mb-1"
                      >
                        {cardSend.card.category}
                      </Text>
                      <Text
                        style={{ color: isDark ? "#ffffff" : "#0f172a" }}
                        className="text-lg font-black tracking-tight mb-2"
                        numberOfLines={1}
                      >
                        {cardSend.card.title}
                      </Text>

                      <View className="flex-row items-center mb-5 mt-1">
                        {getTargetDateStr(cardSend) ? (
                          <CountdownTimer
                            targetDate={getTargetDateStr(cardSend)}
                          />
                        ) : null}
                      </View>
                      {cardSend.message ? (
                        <View className="bg-rose-50/50 dark:bg-rose-950/10 px-4 py-3 rounded-2xl border border-rose-100/30 dark:border-rose-950/25 mb-4">
                          <Text className="text-[#a12338] dark:text-rose-400 font-bold text-[10px] uppercase tracking-wider mb-1">
                            Note from partner
                          </Text>
                          <Text className="text-slate-600 dark:text-slate-300 text-[13px] italic font-medium leading-5">
                            &quot;{cardSend.message}&quot;
                          </Text>
                        </View>
                      ) : null}

                      {cardSend.id?.toString().startsWith("dummy") ? (
                        <View className="bg-rose-50/50 dark:bg-rose-950/10 py-3.5 rounded-xl items-center border border-rose-100/30 dark:border-rose-950/20">
                          <Text className="text-[#a12338] dark:text-rose-400 font-bold text-[12px] uppercase tracking-wider">
                            Placeholder (Send a real dare to start)
                          </Text>
                        </View>
                      ) : cardSend.sender_id === cardSend.receiver_id ? (
                        <View className="w-full items-center">
                          <Text className="text-amber-600 dark:text-amber-400 font-bold text-[10px] text-center mb-2 uppercase tracking-wider">
                            ⚠️ Bugged Card (Sent to yourself)
                          </Text>
                          <TouchableOpacity
                            className="w-full bg-amber-500 dark:bg-amber-600 py-3 rounded-xl items-center shadow-md dark:shadow-none"
                            onPress={async () => {
                              try {
                                await rejectCardSend(
                                  cardSend.id,
                                  cardSend.room_id || activeRoom?.id || "",
                                );
                                Alert.alert(
                                  "Cleared",
                                  "Bugged card cleared! You can now send a new dare.",
                                );
                                fetchActiveRoom(true);
                              } catch (e: any) {
                                Alert.alert(
                                  "Error",
                                  e.response?.data?.message ||
                                    "Failed to clear card",
                                );
                              }
                            }}
                          >
                            <Text className="text-white font-bold text-[13px]">
                              Clear Bugged Card
                            </Text>
                          </TouchableOpacity>
                        </View>
                      ) : cardSend.sender_id === currentUserId ? (
                        <View className="bg-slate-100 dark:bg-[#180D10]/50 py-3.5 rounded-xl items-center border border-slate-200/50 dark:border-rose-950/20">
                          <Text className="text-slate-500 dark:text-slate-400 font-bold text-[12px] uppercase tracking-wider">
                            Waiting for partner...
                          </Text>
                        </View>
                      ) : (
                        <View className="flex-row gap-1.5">
                          <TouchableOpacity
                            className="flex-1 bg-gradient-to-r from-[#0d5f5a] to-teal-600 bg-teal-600 dark:bg-teal-700 py-3.5 rounded-xl items-center shadow-md dark:shadow-none"
                            onPress={() => setSelectedReceivedCard(cardSend)}
                          >
                            <Text className="text-white font-bold text-[13px] tracking-wide">
                              Open Challenge
                            </Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Coin Toss Decision Maker Section */}
          <View
            className="mx-6 mt-6 rounded-[36px] p-7 shadow-lg relative overflow-hidden border"
            style={{
              backgroundColor: isDark ? "#271318" : "#ffffff",
              borderColor: isDark ? "rgba(245,158,11,0.25)" : "rgba(245,158,11,0.2)",
            }}
          >
            {/* Background gold decoration */}
            <View
              style={{ top: -20, right: -25, backgroundColor: isDark ? "rgba(245,158,11,0.12)" : "#fef3c7" }}
              className="absolute w-24 h-24 rounded-full"
            />

            <View className="flex-row items-center mb-2">
              <View
                style={{ backgroundColor: isDark ? "rgba(245,158,11,0.15)" : "#fef3c7" }}
                className="w-9 h-9 rounded-full items-center justify-center mr-3"
              >
                <Ionicons
                  name="pricetag"
                  size={16}
                  color={isDark ? "#fbbf24" : "#d97706"}
                />
              </View>
              <Text
                style={{ color: isDark ? "#fbbf24" : "#d97706" }}
                className="text-[11px] font-bold tracking-widest uppercase"
              >
                Decision Maker
              </Text>
            </View>

            <Text
              style={{ color: isDark ? "#ffffff" : "#0f172a" }}
              className="text-2xl font-black mt-4 pr-12 leading-8"
            >
              Can&apos;t agree on something?
            </Text>
            <Text
              style={{ color: isDark ? "#cbd5e1" : "#475569" }}
              className="mt-3 leading-6 text-[14px] font-medium"
            >
              Toss a virtual coin to decide who washes the dishes, picks the
              movie, or gets their way today!
            </Text>

            <TouchableOpacity
              style={{ backgroundColor: isDark ? "#d97706" : "#f59e0b" }}
              className="rounded-full py-[16px] items-center mt-6 flex-row justify-center shadow-md"
              activeOpacity={0.8}
              onPress={() => navigateTo("/coin-toss")}
            >
              <Text className="text-white font-bold text-[15px] mr-2">
                Toss a Coin
              </Text>
              <Ionicons name="reload" size={16} color="white" />
            </TouchableOpacity>
          </View>

          {/* Card History Section */}
          <View className="mt-10 mb-8 px-6">
            <View className="flex-row items-center justify-between mb-4">
              <View className="flex-row items-center">
                <View
                  style={{ backgroundColor: isDark ? "rgba(244,63,94,0.15)" : "#ffe4e6" }}
                  className="w-8 h-8 rounded-full items-center justify-center mr-2.5"
                >
                  <Ionicons
                    name="time"
                    size={16}
                    color={isDark ? "#f43f5e" : "#e11d48"}
                  />
                </View>
                <Text
                  style={{ color: isDark ? "#fda4af" : "#0f172a" }}
                  className="text-xl font-black tracking-tight"
                >
                  Card History
                </Text>
              </View>
              <TouchableOpacity onPress={() => navigateTo("/history")}>
                <Text
                  style={{ color: isDark ? "#fda4af" : "#be123c" }}
                  className="text-[11px] font-bold uppercase tracking-widest"
                >
                  View All →
                </Text>
              </TouchableOpacity>
            </View>

            {cardHistoryList.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                className="-mx-6 px-6 pb-2"
                contentContainerStyle={{ paddingRight: 48, gap: 14 }}
              >
                {cardHistoryList.slice(0, 6).map((item: any, idx: number) => {
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
                    ? "bg-emerald-500/90"
                    : isDeflected
                      ? "bg-indigo-500/90"
                      : isExpired
                        ? "bg-slate-500/90"
                        : "bg-rose-500/90";

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
                        backgroundColor: isDark ? "#271318" : "#ffffff",
                        borderColor: isDark ? "rgba(225,29,72,0.2)" : "rgba(225,29,72,0.15)",
                      }}
                      className="w-[240px] rounded-[28px] overflow-hidden border shadow-md"
                    >
                      <View className="h-32 relative">
                        <Image
                          source={{ uri: imageUrl }}
                          className="w-full h-full"
                          resizeMode="cover"
                        />
                        <View className="absolute inset-0 bg-black/30" />

                        {/* Top Status Tag */}
                        <View
                          className={`absolute top-3 left-3 ${statusBg} px-2.5 py-1 rounded-full flex-row items-center`}
                        >
                          <Ionicons
                            name={
                              isCompleted
                                ? "checkmark-circle"
                                : isDeflected
                                  ? "return-up-back"
                                  : "time"
                            }
                            size={11}
                            color="white"
                          />
                          <Text className="text-white font-bold text-[9px] uppercase tracking-wider ml-1">
                            {statusLabel}
                          </Text>
                        </View>

                        {/* Date Badge */}
                        <View className="absolute bottom-2.5 right-3 bg-black/50 backdrop-blur-sm px-2 py-0.5 rounded-full">
                          <Text className="text-white/90 text-[10px] font-semibold">
                            {formattedDate}
                          </Text>
                        </View>
                      </View>

                      <View className="p-4">
                        <Text
                          style={{ color: isDark ? "#fda4af" : "#be123c" }}
                          className="text-[9px] font-bold tracking-widest uppercase mb-1"
                        >
                          {category}
                        </Text>
                        <Text
                          style={{ color: isDark ? "#ffffff" : "#0f172a" }}
                          className="text-base font-black tracking-tight"
                          numberOfLines={1}
                        >
                          {title}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            ) : (
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => navigateTo("/dares")}
                style={{
                  backgroundColor: isDark ? "#271318" : "#ffffff",
                  borderColor: isDark ? "rgba(225,29,72,0.3)" : "rgba(225,29,72,0.25)",
                }}
                className="border border-dashed rounded-[28px] p-6 items-center justify-center shadow-sm"
              >
                <View
                  style={{ backgroundColor: isDark ? "rgba(244,63,94,0.15)" : "#ffe4e6" }}
                  className="w-12 h-12 rounded-full items-center justify-center mb-3"
                >
                  <Ionicons
                    name="card"
                    size={22}
                    color={isDark ? "#f43f5e" : "#e11d48"}
                  />
                </View>
                <Text
                  style={{ color: isDark ? "#ffffff" : "#0f172a" }}
                  className="text-base font-bold mb-1 text-center"
                >
                  No Card History Yet
                </Text>
                <Text
                  style={{ color: isDark ? "#94a3b8" : "#64748b" }}
                  className="text-xs font-medium text-center mb-4 leading-4 px-4"
                >
                  Send your first dare card to your partner to start creating
                  history together! 💕
                </Text>
                <View
                  style={{ backgroundColor: isDark ? "#e11d48" : "#af2c3b" }}
                  className="px-5 py-2.5 rounded-full flex-row items-center"
                >
                  <Text className="text-white font-bold text-xs">
                    Send a Dare
                  </Text>
                  <Ionicons
                    name="arrow-forward"
                    size={14}
                    color="white"
                    style={{ marginLeft: 4 }}
                  />
                </View>
              </TouchableOpacity>
            )}
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
                      name="mail-unread"
                      size={12}
                      color={isDark ? "#fda4af" : "#e11d48"}
                    />
                    <Text className="font-bold text-[9px] tracking-widest uppercase ml-1.5 text-rose-600 dark:text-rose-400">
                      New Dare
                    </Text>
                  </View>
                </View>
              ) : (
                <View className="w-16 h-16 rounded-full bg-rose-50 dark:bg-rose-900/30 items-center justify-center mb-5 shadow-sm dark:shadow-none border border-rose-100 dark:border-rose-900/20">
                  <Ionicons name="mail-unread" size={32} color="#e11d48" />
                </View>
              )}

              <Text className="text-2xl font-black text-slate-900 dark:text-white mb-2 text-center tracking-tight px-2">
                {selectedReceivedCard?.card?.title || "New Challenge!"}
              </Text>

              <Text className="text-slate-500 dark:text-slate-400 text-center mb-4 font-medium leading-5 px-3 text-[14px]">
                {selectedReceivedCard?.card?.description ||
                  "Your partner has sent you a new intimacy dare. What would you like to do?"}
              </Text>

              {selectedReceivedCard?.message ? (
                <View className="bg-rose-50/50 dark:bg-rose-950/20 px-4 py-3.5 rounded-xl border border-rose-100/30 dark:border-rose-950/40 mb-6 w-full shadow-sm dark:shadow-none">
                  <Text className="text-[#a12338] dark:text-rose-400 font-bold text-[10px] uppercase tracking-wider mb-1">
                    Note from partner
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
                        48:00:00
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
