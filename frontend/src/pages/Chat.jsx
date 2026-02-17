import { useEffect, useState, useRef, useCallback } from "react";
import { useAuthStore } from "../store/useAuthStore";
import { socket } from "../lib/socket";
import api from "../api/axios";
import { useNavigate } from "react-router-dom";
// --- 1. Import motion here ---
import { motion, AnimatePresence } from "framer-motion";
import toast, { Toaster } from "react-hot-toast";
import {
  Send,
  Hash,
  LogOut,
  Menu,
  MessageSquare,
  Users,
  Paperclip,
  X,
  Loader2,
  Smile,
  Search,
  ArrowLeft,
  Check,
  CheckCheck,
  Maximize2,
} from "lucide-react";

const Chat = () => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  // -- State --
  const [messages, setMessages] = useState([]);
  const [readStatus, setReadStatus] = useState({});
  const [currentMessage, setCurrentMessage] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUserIds, setOnlineUserIds] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  // --- 2. Define isSearching state ---
  const [isSearching, setIsSearching] = useState(false);

  const [selectedFile, setSelectedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

  // Lightbox State
  const [lightboxImage, setLightboxImage] = useState(null);

  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isFetchingOld, setIsFetchingOld] = useState(false);
  const [isLoadingInitial, setIsLoadingInitial] = useState(false);

  const messagesContainerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const searchTimeoutRef = useRef(null);
  const observerRef = useRef(null);

  const [activeReactionMessageId, setActiveReactionMessageId] = useState(null);

  const channels = [
    { id: 1, name: "general" },
    { id: 2, name: "react-help" },
    { id: 3, name: "random" },
  ];
  const [activeChannel, setActiveChannel] = useState(channels[0]);

  // -- HELPER: Fetch Messages --
  const fetchMessages = useCallback(
    async (reset = false) => {
      if (isSearchOpen) return;
      if (reset) setIsLoadingInitial(true);
      try {
        const targetPage = reset ? 1 : page;
        const res = await api.get(
          `/messages/${activeChannel.id}?page=${targetPage}`,
        );
        const fetchedMsgs = res.data.messages || [];

        if (res.data.readStatus) setReadStatus(res.data.readStatus);

        if (reset) {
          setMessages(fetchedMsgs);
          setPage(1);
        } else {
          setMessages((prev) => [...fetchedMsgs, ...prev]);
        }
        setHasMore(res.data.hasMore);
      } catch (err) {
        toast.error("Failed to load messages", err);
      } finally {
        if (reset) setIsLoadingInitial(false);
      }
    },
    [activeChannel.id, page, isSearchOpen],
  );

  // -- OBSERVER --
  const setupObserver = () => {
    if (observerRef.current) observerRef.current.disconnect();
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const msgId = entry.target.getAttribute("data-msg-id");
            if (msgId && user) {
              socket.emit("mark_read", {
                channelId: activeChannel.id,
                messageId: msgId,
                userId: user.id,
              });
            }
          }
        });
      },
      { threshold: 0.5 },
    );

    const msgElements = document.querySelectorAll(".message-item");
    if (msgElements.length > 0)
      observerRef.current.observe(msgElements[msgElements.length - 1]);
  };

  useEffect(() => {
    if (!isFetchingOld && messages.length > 0) setupObserver();
  }, [messages, isFetchingOld]);

  // -- EFFECTS --
  useEffect(() => {
    if (!isSearchOpen) fetchMessages(true);
    setTypingUsers([]);
    setSelectedFile(null);
  }, [activeChannel, isSearchOpen, fetchMessages]);

  useEffect(() => {
    if (!isFetchingOld && !isSearchOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages.length, typingUsers, activeChannel, isSearchOpen]);

  const handleScroll = async () => {
    if (isSearchOpen) return;
    const container = messagesContainerRef.current;
    if (!container) return;

    if (container.scrollTop === 0 && hasMore && !isFetchingOld) {
      setIsFetchingOld(true);
      const previousHeight = container.scrollHeight;
      setPage((prev) => prev + 1);

      try {
        const nextPage = page + 1;
        const res = await api.get(
          `/messages/${activeChannel.id}?page=${nextPage}`,
        );
        const newMsgs = res.data.messages || [];
        if (newMsgs.length > 0) {
          setMessages((prev) => [...newMsgs, ...prev]);
          setHasMore(res.data.hasMore);
          setTimeout(() => {
            const newHeight = container.scrollHeight;
            container.scrollTop = newHeight - previousHeight;
          }, 0);
        } else {
          setHasMore(false);
        }
      } catch (err) {
        toast.error("Could not load older messages", err);
      } finally {
        setIsFetchingOld(false);
      }
    }
  };

  // -- SOCKET LOGIC --
  useEffect(() => {
    if (!user) {
      navigate("/login");
      return;
    }
    socket.connect();
    socket.emit("user_connected", user.id);
    socket.emit("join_channel", activeChannel.id);

    function onConnect() {
      setIsConnected(true);
    }
    function onDisconnect() {
      setIsConnected(false);
    }

    function onReceiveMessage(newMessage) {
      if (newMessage.channelId === activeChannel.id && !isSearchOpen) {
        setMessages((prev) => {
          const tempIndex = prev.findIndex(
            (m) => m.tempId && m.tempId === newMessage.tempId,
          );
          if (tempIndex !== -1) {
            const updated = [...prev];
            updated[tempIndex] = newMessage;
            return updated;
          }
          if (prev.some((m) => m.id === newMessage.id)) return prev;
          return [...prev, newMessage];
        });
        setTimeout(
          () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }),
          100,
        );
      }
    }

    function onUserReadUpdate(data) {
      setReadStatus((prev) => ({
        ...prev,
        [data.userId]: data.lastReadMessageId,
      }));
    }

    function onMessageError(data) {
      toast.error(data.error);
      if (!isSearchOpen) fetchMessages(true);
    }

    function onUpdateOnlineUsers(userIds) {
      setOnlineUserIds(userIds);
    }
    function onUserTyping(username) {
      setTypingUsers((prev) =>
        prev.includes(username) ? prev : [...prev, username],
      );
    }
    function onUserStopTyping(username) {
      setTypingUsers((prev) => prev.filter((u) => u !== username));
    }
    function onReactionUpdate({ messageId, userId, emoji }) {
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id !== messageId) return msg;
          const current = msg.reactions || [];
          const idx = current.findIndex(
            (r) => r.userId === userId && r.emoji === emoji,
          );
          let updated = [...current];
          if (idx > -1) updated.splice(idx, 1);
          else updated.push({ userId, emoji });
          return { ...msg, reactions: updated };
        }),
      );
    }

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("receive_message", onReceiveMessage);
    socket.on("user_read_update", onUserReadUpdate);
    socket.on("message_error", onMessageError);
    socket.on("update_online_users", onUpdateOnlineUsers);
    socket.on("user_typing", onUserTyping);
    socket.on("user_stop_typing", onUserStopTyping);
    socket.on("message_reaction_update", onReactionUpdate);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("receive_message", onReceiveMessage);
      socket.off("user_read_update", onUserReadUpdate);
      socket.off("message_error", onMessageError);
      socket.off("update_online_users", onUpdateOnlineUsers);
      socket.off("user_typing", onUserTyping);
      socket.off("user_stop_typing", onUserStopTyping);
      socket.off("message_reaction_update", onReactionUpdate);
    };
  }, [user, navigate, activeChannel, isSearchOpen, fetchMessages]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if ((!currentMessage.trim() && !selectedFile) || !user || isUploading)
      return;
    let attachmentUrl = null;
    if (selectedFile) {
      setIsUploading(true);
      const loadingToast = toast.loading("Uploading image...");
      try {
        const formData = new FormData();
        formData.append("file", selectedFile);
        const res = await api.post("/upload", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        attachmentUrl = res.data.url;
        toast.dismiss(loadingToast);
      } catch (error) {
        toast.dismiss(loadingToast);
        toast.error("Upload failed", error);
        setIsUploading(false);
        return;
      } finally {
        setIsUploading(false);
      }
    }
    const tempId = Date.now() + Math.random();
    const messageData = {
      channelId: activeChannel.id,
      content: currentMessage,
      senderId: user.id,
      sender: user.username,
      time: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
      attachmentUrl: attachmentUrl,
      reactions: [],
      tempId: tempId,
    };
    socket.emit("send_message", messageData);
    setMessages((prev) => [...prev, messageData]);
    socket.emit("stop_typing", {
      channelId: activeChannel.id,
      username: user.username,
    });
    setCurrentMessage("");
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setTimeout(
      () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }),
      0,
    );
  };

  const handleReaction = async (messageId, emoji) => {
    setActiveReactionMessageId(null);
    try {
      await api.post(`/messages/${messageId}/react`, {
        emoji,
        userId: user.id,
      });
      socket.emit("message_reaction", {
        messageId,
        channelId: activeChannel.id,
        userId: user.id,
        emoji,
      });
    } catch (err) {
      console.error("Failed to react", err);
    }
  };

  const handleTyping = (e) => {
    setCurrentMessage(e.target.value);
    socket.emit("typing", {
      channelId: activeChannel.id,
      username: user.username,
    });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit("stop_typing", {
        channelId: activeChannel.id,
        username: user.username,
      });
    }, 2000);
  };

  const getMessageReadStatus = (msgId) => {
    if (!user) return false;
    return Object.entries(readStatus).some(
      ([uId, readId]) =>
        parseInt(uId) !== user.id && parseInt(readId) >= parseInt(msgId),
    );
  };

  const handleSearch = async (query) => {
    if (!query.trim()) {
      fetchMessages(true);
      return;
    }
    setIsSearching(true);
    try {
      const res = await api.get(
        `/messages/${activeChannel.id}/search?q=${query}`,
      );
      setMessages(res.data.messages || []);
      setHasMore(false);
    } catch (err) {
      toast.error("Search failed", err);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="flex h-screen bg-gray-950 text-slate-100 overflow-hidden font-sans">
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: "#1e293b",
            color: "#fff",
            border: "1px solid #334155",
          },
        }}
      />

      {/* LIGHTBOX (Uses motion) */}
      <AnimatePresence>
        {lightboxImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 cursor-zoom-out"
            onClick={() => setLightboxImage(null)}
          >
            <motion.img
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              src={lightboxImage}
              alt="Full view"
              className="max-w-full max-h-full rounded-lg shadow-2xl"
            />
            <button className="absolute top-6 right-6 text-white/70 hover:text-white p-2 bg-white/10 rounded-full">
              <X className="w-6 h-6" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MOBILE OVERLAY */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-20 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* SIDEBAR */}
      <div
        className={`fixed inset-y-0 left-0 z-30 w-72 bg-gray-900 border-r border-gray-800 transform transition-transform duration-300 md:relative md:translate-x-0 flex flex-col ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="p-6 border-b border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-xl shadow-lg shadow-indigo-500/20">
              <MessageSquare className="w-6 h-6 text-white" />
            </div>
            <span className="font-bold text-xl tracking-tight">Nexus</span>
          </div>
          <div
            className={`w-3 h-3 rounded-full shadow-[0_0_12px] transition-all duration-500 ${isConnected ? "bg-emerald-500 shadow-emerald-500/50" : "bg-rose-500 shadow-rose-500/50"}`}
          />
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          <div>
            <div className="px-2 mb-3 text-xs font-bold text-gray-500 uppercase tracking-wider">
              Channels
            </div>
            <div className="space-y-1">
              {channels.map((channel) => (
                <button
                  key={channel.id}
                  onClick={() => {
                    setActiveChannel(channel);
                    setIsSidebarOpen(false);
                  }}
                  className={`w-full flex items-center px-4 py-3 rounded-xl transition-all duration-200 group relative overflow-hidden ${activeChannel.id === channel.id ? "bg-indigo-600/10 text-indigo-400 border border-indigo-500/20" : "text-gray-400 hover:bg-gray-800 hover:text-gray-100"}`}
                >
                  <Hash
                    className={`w-4 h-4 mr-3 ${activeChannel.id === channel.id ? "text-indigo-400" : "text-gray-500 group-hover:text-gray-300"}`}
                  />
                  <span className="font-medium">{channel.name}</span>
                  {activeChannel.id === channel.id && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-indigo-500 rounded-r-full" />
                  )}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="px-2 mb-3 text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center justify-between">
              <span>Online — {onlineUserIds.length}</span>
            </div>
            <div className="space-y-3 px-2">
              {onlineUserIds.includes(user?.id) ? (
                <div className="flex items-center gap-3 bg-gray-800/50 p-2 rounded-lg border border-gray-700/50">
                  <div className="relative">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-xs font-bold shadow-inner">
                      {user?.username?.[0]?.toUpperCase()}
                    </div>
                    <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 border-2 border-gray-800 rounded-full"></div>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-medium text-white">You</span>
                    <span className="text-[10px] text-emerald-400">
                      Active now
                    </span>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="p-4 bg-gray-900 border-t border-gray-800">
          <button
            onClick={() => {
              logout();
              socket.disconnect();
              navigate("/login");
            }}
            className="w-full flex items-center justify-center gap-2 p-3 text-gray-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-all duration-200"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium text-sm">Sign Out</span>
          </button>
        </div>
      </div>

      {/* MAIN AREA */}
      <div className="flex-1 flex flex-col min-w-0 bg-gray-950 relative">
        {/* HEADER */}
        <div className="h-20 glass-header flex items-center px-6 sticky top-0 z-20 justify-between">
          <div className="flex items-center w-full">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="mr-4 md:hidden text-gray-400 hover:text-white"
            >
              <Menu className="w-6 h-6" />
            </button>
            {isSearchOpen ? (
              // --- 3. motion used here ---
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center w-full"
              >
                <button
                  onClick={() => {
                    setIsSearchOpen(false);
                    setSearchQuery("");
                    fetchMessages(true);
                  }}
                  className="mr-4 text-gray-400 hover:text-white p-2 rounded-full hover:bg-gray-800"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="relative flex-1 max-w-2xl">
                  <Search className="absolute left-4 top-3 w-5 h-5 text-gray-500" />
                  <input
                    autoFocus
                    type="text"
                    placeholder="Search conversation..."
                    className="w-full bg-gray-800/50 text-white pl-12 pr-4 py-2.5 rounded-full focus:outline-none focus:ring-2 focus:ring-indigo-500/50 border border-gray-700 placeholder-gray-500 transition-all"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      if (searchTimeoutRef.current)
                        clearTimeout(searchTimeoutRef.current);
                      searchTimeoutRef.current = setTimeout(
                        () => handleSearch(e.target.value),
                        500,
                      );
                    }}
                  />
                </div>
              </motion.div>
            ) : (
              <>
                <div className="flex flex-col mr-auto">
                  <div className="flex items-center gap-2">
                    <Hash className="w-5 h-5 text-indigo-400" />
                    <span className="font-bold text-lg text-white tracking-tight">
                      {activeChannel.name}
                    </span>
                  </div>
                  <span className="text-xs text-gray-400 mt-0.5">
                    {onlineUserIds.length} members online
                  </span>
                </div>
                <button
                  onClick={() => setIsSearchOpen(true)}
                  className="p-3 text-gray-400 hover:bg-gray-800/80 rounded-xl transition-all duration-200 hover:text-white"
                >
                  <Search className="w-5 h-5" />
                </button>
              </>
            )}
          </div>
        </div>

        <div
          ref={messagesContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-2 scrollbar-thin"
          onClick={() => setActiveReactionMessageId(null)}
        >
          {isFetchingOld && (
            <div className="flex justify-center py-4">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
            </div>
          )}

          {/* --- 4. isSearching used here --- */}
          {isSearching && messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <Search className="w-12 h-12 mb-2 opacity-20" />
              <p>Searching...</p>
            </div>
          )}

          {isLoadingInitial ? (
            <div className="space-y-6">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex gap-4 animate-pulse opacity-50">
                  <div className="w-10 h-10 bg-gray-800 rounded-full"></div>
                  <div className="space-y-2 flex-1">
                    <div className="h-4 bg-gray-800 rounded w-1/4"></div>
                    <div className="h-12 bg-gray-800 rounded-2xl w-1/2"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {(messages || []).map((msg, idx) => {
                const isMe = msg.sender === user?.username;
                const reactionCounts = (msg.reactions || []).reduce(
                  (acc, curr) => {
                    acc[curr.emoji] = (acc[curr.emoji] || 0) + 1;
                    return acc;
                  },
                  {},
                );
                const isRead = isMe && getMessageReadStatus(msg.id);

                const prevMsg = messages[idx - 1];
                const isSequence = prevMsg && prevMsg.sender === msg.sender;

                return (
                  // --- 5. motion used here for messages ---
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    key={`${msg.id}-${idx}`}
                    className={`message-item flex w-full ${isMe ? "justify-end" : "justify-start"} group relative ${isSequence ? "mt-1" : "mt-6"}`}
                    data-msg-id={msg.id}
                  >
                    <div
                      className={`flex max-w-[85%] sm:max-w-[65%] ${isMe ? "flex-row-reverse" : "flex-row"} items-end gap-3`}
                    >
                      {!isMe && (
                        <div className="w-9 flex-shrink-0 flex flex-col items-center">
                          {!isSequence ? (
                            <div
                              className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shadow-lg bg-gradient-to-br from-gray-700 to-gray-600`}
                            >
                              {msg.sender?.[0]?.toUpperCase()}
                            </div>
                          ) : (
                            <div className="w-9" />
                          )}
                        </div>
                      )}

                      <div
                        className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
                      >
                        {!isMe && !isSequence && (
                          <div className="flex items-center gap-2 mb-1 px-1">
                            <span className="text-xs font-semibold text-indigo-300">
                              {msg.sender}
                            </span>
                            <span className="text-[10px] text-gray-500">
                              {msg.time}
                            </span>
                          </div>
                        )}

                        <div className="relative group/bubble">
                          <div
                            className={`px-5 py-3 shadow-sm text-[15px] leading-relaxed break-words relative backdrop-blur-sm border 
                            ${
                              isMe
                                ? `bg-indigo-600/90 text-white border-indigo-500/50 ${isSequence ? "rounded-3xl rounded-tr-md" : "rounded-3xl rounded-br-none"}`
                                : `glass text-gray-100 border-gray-700/50 ${isSequence ? "rounded-3xl rounded-tl-md" : "rounded-3xl rounded-bl-none"}`
                            }`}
                          >
                            {msg.attachmentUrl && (
                              <div className="mb-3 rounded-xl overflow-hidden border border-white/10 shadow-sm relative group/image">
                                <img
                                  src={msg.attachmentUrl}
                                  alt="attachment"
                                  className="max-w-full h-auto max-h-72 object-cover hover:scale-105 transition-transform duration-300 cursor-pointer"
                                  onClick={() =>
                                    setLightboxImage(msg.attachmentUrl)
                                  }
                                />
                                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover/image:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                                  <Maximize2 className="w-6 h-6 text-white drop-shadow-md" />
                                </div>
                              </div>
                            )}
                            {msg.content}
                          </div>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveReactionMessageId(
                                activeReactionMessageId === msg.id
                                  ? null
                                  : msg.id,
                              );
                            }}
                            className={`absolute -top-3 ${isMe ? "-left-8" : "-right-8"} p-1.5 rounded-full bg-gray-800 border border-gray-700 text-gray-400 hover:text-amber-400 hover:bg-gray-700 transition-all opacity-0 group-hover/bubble:opacity-100 scale-90 hover:scale-100 shadow-lg`}
                          >
                            <Smile className="w-4 h-4" />
                          </button>

                          <div
                            className={`absolute -bottom-5 ${isMe ? "right-0" : "left-0"} flex items-center gap-2 z-10`}
                          >
                            {isMe &&
                              (idx === messages.length - 1 || !isSequence) && (
                                <span className="opacity-0 group-hover/bubble:opacity-100 transition-opacity duration-200">
                                  {isRead ? (
                                    <CheckCheck className="w-3.5 h-3.5 text-indigo-400" />
                                  ) : (
                                    <Check className="w-3.5 h-3.5 text-gray-600" />
                                  )}
                                </span>
                              )}
                            {Object.entries(reactionCounts).length > 0 && (
                              <div className="flex gap-1 transform -translate-y-2">
                                {Object.entries(reactionCounts).map(
                                  ([emoji, count]) => (
                                    <div
                                      key={emoji}
                                      className="bg-gray-800/90 border border-gray-700/50 rounded-full px-1.5 py-0.5 text-[10px] flex items-center gap-1 shadow-md text-gray-300"
                                    >
                                      <span>{emoji}</span>
                                      <span>{count > 1 ? count : ""}</span>
                                    </div>
                                  ),
                                )}
                              </div>
                            )}
                          </div>

                          <AnimatePresence>
                            {activeReactionMessageId === msg.id && (
                              <motion.div
                                initial={{ scale: 0.8, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.8, opacity: 0 }}
                                className={`absolute z-20 -top-14 ${isMe ? "right-0" : "left-0"} bg-gray-800/90 backdrop-blur-md border border-gray-700 rounded-full shadow-2xl flex items-center p-1.5 gap-1`}
                              >
                                {["👍", "❤️", "😂", "😮", "😢", "😡"].map(
                                  (emoji) => (
                                    <button
                                      key={emoji}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleReaction(msg.id, emoji);
                                      }}
                                      className="w-9 h-9 flex items-center justify-center hover:bg-white/10 rounded-full text-xl transition-colors"
                                    >
                                      {emoji}
                                    </button>
                                  ),
                                )}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}

          {/* --- 6. motion used here for typing indicator --- */}
          {typingUsers.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-3 text-gray-500 text-xs ml-12 mt-4"
            >
              <div className="flex gap-1 bg-gray-800/50 p-2 rounded-xl">
                <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce"></span>
                <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce delay-75"></span>
                <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce delay-150"></span>
              </div>
              <span className="font-medium text-indigo-400">
                {typingUsers.join(", ")} is typing...
              </span>
            </motion.div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-4 bg-gray-950/80 backdrop-blur-md border-t border-gray-800/50">
          <div className="max-w-4xl mx-auto">
            {selectedFile && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-4 inline-flex items-center gap-3 bg-gray-900 p-2 pr-4 rounded-xl border border-gray-800 shadow-lg"
              >
                <div className="relative group">
                  <img
                    src={URL.createObjectURL(selectedFile)}
                    alt="preview"
                    className="w-12 h-12 object-cover rounded-lg"
                  />
                  <button
                    onClick={() => {
                      setSelectedFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                    className="absolute -top-2 -right-2 bg-rose-500 text-white rounded-full p-0.5 shadow-md hover:bg-rose-600 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
                <div className="text-sm">
                  <div className="font-medium text-gray-200">
                    Image selected
                  </div>
                  <div className="text-xs text-gray-500 truncate max-w-[150px]">
                    {selectedFile.name}
                  </div>
                </div>
              </motion.div>
            )}

            <form
              onSubmit={handleSendMessage}
              className={`flex gap-3 items-end transition-opacity duration-300 ${isSearchOpen ? "opacity-30 pointer-events-none" : "opacity-100"}`}
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={(e) => {
                  const file = e.target.files[0];
                  if (file) setSelectedFile(file);
                }}
                className="hidden"
                accept="image/*"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-3.5 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-indigo-400 rounded-2xl transition-all border border-gray-700/50 shadow-sm hover:shadow-indigo-500/10"
                title="Attach Image"
              >
                <Paperclip className="w-5 h-5" />
              </button>

              <div className="relative flex-1">
                <input
                  type="text"
                  value={currentMessage}
                  onChange={handleTyping}
                  placeholder={`Message #${activeChannel.name}`}
                  className="w-full bg-gray-800/50 hover:bg-gray-800 text-white pl-5 pr-4 py-3.5 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:bg-gray-800 transition-all shadow-inner border border-gray-700/50 placeholder-gray-500"
                />
              </div>

              <button
                type="submit"
                disabled={
                  (!currentMessage.trim() && !selectedFile) || isUploading
                }
                className={`p-3.5 rounded-2xl transition-all duration-200 flex items-center justify-center shadow-lg ${(currentMessage.trim() || selectedFile) && !isUploading ? "bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/20 hover:scale-105 active:scale-95" : "bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700"}`}
              >
                {isUploading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Chat;
