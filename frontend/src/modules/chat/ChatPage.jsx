import { useCallback, useEffect, useRef, useState } from "react";
import { App } from "antd";
import { useNavigate, useParams } from "react-router-dom";
import {
  addPollOption as addConversationPollOption,
  cancelReminder as cancelConversationReminder,
  addMessageReaction,
  closePoll as closeConversationPoll,
  deleteMessage as deleteConversationMessage,
  getConversationById,
  getConversations,
  getMessages,
  getPinnedMessages,
  markConversationAsRead as markConversationReadRequest,
  removeMessageReaction,
  respondReminder as respondConversationReminder,
  sendMessage as sendConversationMessage,
  sharePoll as shareConversationPoll,
  uploadConversationAttachment,
  updateMessage as updateConversationMessage,
  updateMessagePin,
  votePoll as voteConversationPoll,
} from "../../api/conversationApi";
import { useAuth } from "../../context/AuthContext";
import ConversationList from "./ConversationList";
import ChatWindow from "./ChatWindow";
import ChatDetailPanel from "./ChatDetailPanel";
import NewConversationModal from "./NewConversationModal";
import { sortConversationsByActivity } from "./conversationListState";
import {
  addReactionToMessages,
  applyDeletedMessage,
  markConversationAsRead,
  removeReactionFromMessages,
  updateConversationParticipantStatus,
  updateConversationPreview,
  updateTypingUsers,
  upsertMessageById,
} from "./realtimeMessageState";
import { useSocket } from "../../context/SocketContext";
import { useCall } from "../call/callContextValue";
import {
  areMessagesForConversation,
  getCachedMessages,
  getVisibleMessagesForConversation,
  setCachedMessages,
  updateCachedMessages,
} from "./messageCacheState";
import {
  DEFAULT_MESSAGE_PAGE_STATE,
  MESSAGE_PAGE_SIZE,
  createMessagePageState,
  getCachedMessagePageState,
  getOldestMessageCursor,
  mergeMessagePage,
  setCachedMessagePageState,
} from "./messagePaginationState";

const toComparableId = (value) => {
  if (value == null) return "";
  return String(value);
};

const getMessageCopyText = (message) => {
  const parts = [];
  if (message?.content) {
    parts.push(message.content);
  }

  (message?.attachments || []).forEach((attachment) => {
    const attachmentLabel = [attachment.fileName, attachment.fileUrl]
      .filter(Boolean)
      .join(" - ");
    if (attachmentLabel) parts.push(attachmentLabel);
  });

  return parts.join("\n").trim();
};

const writeTextToClipboard = async (text) => {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
};

const getConversationId = (conversation) => {
  return toComparableId(conversation?.id || conversation?._id);
};

const getMessageId = (message) => {
  return toComparableId(message?.id || message?._id || message?.messageId);
};

const normalizeMessagesForDisplay = (items = []) => {
  return [...items].sort(
    (a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0)
  );
};

const getPinnedMessageTime = (message) => {
  const time = new Date(message?.pinnedAt || message?.createdAt || 0).getTime();
  return Number.isFinite(time) ? time : 0;
};

const sortPinnedMessages = (items = []) => {
  return [...items]
    .filter((message) => message?.isPinned && !message?.deletedAt)
    .sort((a, b) => getPinnedMessageTime(b) - getPinnedMessageTime(a));
};

const upsertPinnedMessage = (pinnedMessages, incomingMessage) => {
  const incomingMessageId = getMessageId(incomingMessage);
  if (!incomingMessageId) return pinnedMessages;

  if (!incomingMessage?.isPinned || incomingMessage?.deletedAt) {
    return pinnedMessages.filter(
      (message) => getMessageId(message) !== incomingMessageId
    );
  }

  const existingIndex = pinnedMessages.findIndex(
    (message) => getMessageId(message) === incomingMessageId
  );

  if (existingIndex === -1) {
    return sortPinnedMessages([...pinnedMessages, incomingMessage]);
  }

  const nextPinnedMessages = [...pinnedMessages];
  nextPinnedMessages[existingIndex] = {
    ...nextPinnedMessages[existingIndex],
    ...incomingMessage,
  };

  return sortPinnedMessages(nextPinnedMessages);
};

const mergeConversationUpdate = (
  conversations,
  incomingConversation,
  { preserveUnread = false } = {}
) => {
  const incomingConversationId = getConversationId(incomingConversation);
  if (!incomingConversationId) return conversations;

  const hasExisting = conversations.some(
    (conversation) => getConversationId(conversation) === incomingConversationId
  );

  const nextConversations = hasExisting
    ? conversations.map((conversation) => {
        if (getConversationId(conversation) !== incomingConversationId) {
          return conversation;
        }

        return {
          ...conversation,
          ...incomingConversation,
          ...(preserveUnread
            ? {
                hasUnread: conversation.hasUnread,
                unreadCount: conversation.unreadCount,
              }
            : {}),
        };
      })
    : [incomingConversation, ...conversations];

  return sortConversationsByActivity(nextConversations);
};

const ChatPage = () => {
  const { user } = useAuth();
  const { message: toast } = App.useApp();
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const { socket, isAuthenticated } = useSocket();
  const { startCall } = useCall();
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [pinnedMessages, setPinnedMessages] = useState([]);
  const [messagesConversationId, setMessagesConversationId] = useState("");
  const [pinnedMessagesConversationId, setPinnedMessagesConversationId] =
    useState("");
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [messagePageState, setMessagePageState] = useState(
    DEFAULT_MESSAGE_PAGE_STATE,
  );
  const [showDetail, setShowDetail] = useState(true);
  const [showMobileDetail, setShowMobileDetail] = useState(false);
  const [showNewModal, setShowNewModal] = useState(false);
  const [mobileView, setMobileView] = useState("list"); // "list" | "chat"
  const [typingUsers, setTypingUsers] = useState([]);
  const [replyToMessage, setReplyToMessage] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const typingTimeoutRef = useRef(null);
  const messagesCacheRef = useRef(new Map());
  const pinnedMessagesCacheRef = useRef(new Map());
  const messagePageStateCacheRef = useRef(new Map());
  const messagesConversationIdRef = useRef("");
  const pinnedMessagesConversationIdRef = useRef("");
  const selectedConversationIdRef = useRef("");
  const messagesRequestSeqRef = useRef(0);
  const olderMessagesRequestSeqRef = useRef(0);
  const fetchedConversationIdsRef = useRef(new Set());
  const [hasLoadedConversations, setHasLoadedConversations] = useState(false);

  const selectedConversationId = toComparableId(conversationId);
  const activeOrganizationId = toComparableId(
    user?.activeOrganization?.id || user?.activeOrganizationId,
  );
  selectedConversationIdRef.current = selectedConversationId;
  const setMessagesOwner = useCallback((nextConversationId) => {
    const targetConversationId = toComparableId(nextConversationId);
    messagesConversationIdRef.current = targetConversationId;
    setMessagesConversationId(targetConversationId);
  }, []);
  const setPinnedMessagesOwner = useCallback((nextConversationId) => {
    const targetConversationId = toComparableId(nextConversationId);
    pinnedMessagesConversationIdRef.current = targetConversationId;
    setPinnedMessagesConversationId(targetConversationId);
  }, []);
  const setMessagePageStateForConversation = useCallback(
    (nextConversationId, nextState) => {
      const targetConversationId = toComparableId(nextConversationId);
      const normalizedState = createMessagePageState(nextState);

      if (targetConversationId) {
        setCachedMessagePageState(
          messagePageStateCacheRef.current,
          targetConversationId,
          normalizedState,
        );
      }

      if (targetConversationId === selectedConversationId) {
        setMessagePageState(normalizedState);
      }
    },
    [selectedConversationId],
  );

  // Fetch conversations on mount
  useEffect(() => {
    let ignore = false;

    const fetchConversations = async () => {
      try {
        setHasLoadedConversations(false);
        const res = await getConversations({ page: 1, size: 50 });
        if (ignore) return;

        const nextConversations = sortConversationsByActivity(res.content || []);
        setConversations(nextConversations);
      } catch (err) {
        console.error("Failed to fetch conversations:", err);
      } finally {
        if (!ignore) setHasLoadedConversations(true);
      }
    };

    fetchConversations();

    return () => {
      ignore = true;
    };
  }, [activeOrganizationId]);

  useEffect(() => {
    messagesCacheRef.current.clear();
    pinnedMessagesCacheRef.current.clear();
    messagePageStateCacheRef.current.clear();
    fetchedConversationIdsRef.current.clear();
    setConversations([]);
    setSelectedConversation(null);
    setMessages([]);
    setPinnedMessages([]);
    setMessagesOwner("");
    setPinnedMessagesOwner("");
    setMessagePageState(DEFAULT_MESSAGE_PAGE_STATE);
    setTypingUsers([]);
    setReplyToMessage(null);
    setEditingMessage(null);
  }, [activeOrganizationId, setMessagesOwner, setPinnedMessagesOwner]);

  useEffect(() => {
    if (!selectedConversationId) {
      setSelectedConversation(null);
      setMessages([]);
      setPinnedMessages([]);
      setMessagesOwner("");
      setPinnedMessagesOwner("");
      setMessagePageState(DEFAULT_MESSAGE_PAGE_STATE);
      setIsLoadingMessages(false);
      messagesRequestSeqRef.current += 1;
      olderMessagesRequestSeqRef.current += 1;
      setTypingUsers([]);
      setReplyToMessage(null);
      setEditingMessage(null);
      setMobileView("list");
      return undefined;
    }

    const matchedConversation = conversations.find(
      (conversation) => getConversationId(conversation) === selectedConversationId
    );

    if (matchedConversation) {
      setSelectedConversation(matchedConversation);
      setMobileView("chat");
      return undefined;
    }

    if (
      !hasLoadedConversations ||
      fetchedConversationIdsRef.current.has(selectedConversationId)
    ) {
      return undefined;
    }

    let ignore = false;
    fetchedConversationIdsRef.current.add(selectedConversationId);

    const fetchConversation = async () => {
      try {
        const fetchedConversation = await getConversationById(selectedConversationId);
        if (ignore) return;
        setConversations((prev) =>
          sortConversationsByActivity([
            fetchedConversation,
            ...prev.filter(
              (conversation) =>
                getConversationId(conversation) !==
                getConversationId(fetchedConversation)
            ),
          ])
        );
        setSelectedConversation(fetchedConversation);
        setMobileView("chat");
      } catch (err) {
        console.error("Failed to fetch conversation:", err);
        fetchedConversationIdsRef.current.delete(selectedConversationId);
      }
    };

    fetchConversation();

    return () => {
      ignore = true;
    };
  }, [
    conversations,
    hasLoadedConversations,
    selectedConversationId,
    setMessagesOwner,
    setPinnedMessagesOwner,
  ]);

  useEffect(() => {
    if (!selectedConversationId) {
      setMessages([]);
      setPinnedMessages([]);
      setMessagesOwner("");
      setPinnedMessagesOwner("");
      setMessagePageState(DEFAULT_MESSAGE_PAGE_STATE);
      setIsLoadingMessages(false);
      messagesRequestSeqRef.current += 1;
      olderMessagesRequestSeqRef.current += 1;
      setTypingUsers([]);
      setReplyToMessage(null);
      setEditingMessage(null);
      return undefined;
    }

    let ignore = false;
    const requestSeq = messagesRequestSeqRef.current + 1;
    messagesRequestSeqRef.current = requestSeq;
    olderMessagesRequestSeqRef.current += 1;
    const cachedMessages = getCachedMessages(
      messagesCacheRef.current,
      selectedConversationId
    );
    const cachedPinnedMessages = getCachedMessages(
      pinnedMessagesCacheRef.current,
      selectedConversationId
    );
    const cachedMessagePageState =
      getCachedMessagePageState(
        messagePageStateCacheRef.current,
        selectedConversationId,
      ) || DEFAULT_MESSAGE_PAGE_STATE;
    const hasCachedMessages = Boolean(cachedMessages);

    if (hasCachedMessages) {
      setMessagesOwner(selectedConversationId);
      setPinnedMessagesOwner(selectedConversationId);
      setMessages(cachedMessages);
      setPinnedMessages(cachedPinnedMessages || []);
      setMessagePageState(cachedMessagePageState);
      setIsLoadingMessages(false);
      setConversations((prev) =>
        markConversationAsRead(prev, selectedConversationId)
      );
      setSelectedConversation((prev) => {
        if (!prev) return prev;
        return markConversationAsRead([prev], selectedConversationId)[0];
      });
    } else {
      setMessagesOwner(selectedConversationId);
      setPinnedMessagesOwner(selectedConversationId);
      setMessages([]);
      setPinnedMessages([]);
      setMessagePageState(DEFAULT_MESSAGE_PAGE_STATE);
      setIsLoadingMessages(true);
    }

    const fetchMessages = async () => {
      const pinnedMessagesRequest = getPinnedMessages(selectedConversationId)
        .then((response) => ({ response }))
        .catch((error) => ({ error }));

      try {
        const res = await getMessages(selectedConversationId, {
          limit: MESSAGE_PAGE_SIZE,
        });
        if (!ignore && messagesRequestSeqRef.current === requestSeq) {
          const loadedMessages = normalizeMessagesForDisplay(res.content || []);
          const nextMessagePageState = createMessagePageState({
            hasOlder: res.hasMore,
          });
          setCachedMessages(
            messagesCacheRef.current,
            selectedConversationId,
            loadedMessages
          );
          setCachedMessagePageState(
            messagePageStateCacheRef.current,
            selectedConversationId,
            nextMessagePageState,
          );
          setMessagesOwner(selectedConversationId);
          setMessages(loadedMessages);
          setMessagePageState(nextMessagePageState);
          setConversations((prev) =>
            markConversationAsRead(prev, selectedConversationId)
          );
          setSelectedConversation((prev) => {
            if (!prev) return prev;
            return markConversationAsRead([prev], selectedConversationId)[0];
          });
        }

        const pinnedMessagesResult = await pinnedMessagesRequest;
        if (ignore || messagesRequestSeqRef.current !== requestSeq) return;

        if (pinnedMessagesResult.response) {
          const loadedPinnedMessages = sortPinnedMessages(
            pinnedMessagesResult.response.content || []
          );
          setCachedMessages(
            pinnedMessagesCacheRef.current,
            selectedConversationId,
            loadedPinnedMessages
          );
          setPinnedMessagesOwner(selectedConversationId);
          setPinnedMessages(loadedPinnedMessages);
        } else {
          console.error(
            "Failed to fetch pinned messages:",
            pinnedMessagesResult.error
          );
          setPinnedMessagesOwner(selectedConversationId);
          setPinnedMessages([]);
        }
      } catch (err) {
        console.error("Failed to fetch messages:", err);
        if (
          !ignore &&
          messagesRequestSeqRef.current === requestSeq &&
          !hasCachedMessages
        ) {
          setMessagesOwner(selectedConversationId);
          setPinnedMessagesOwner(selectedConversationId);
          setMessages([]);
          setPinnedMessages([]);
          setMessagePageState(DEFAULT_MESSAGE_PAGE_STATE);
        }
      } finally {
        if (!ignore && messagesRequestSeqRef.current === requestSeq) {
          setIsLoadingMessages(false);
        }
      }
    };

    fetchMessages();

    return () => {
      ignore = true;
    };
  }, [selectedConversationId, setMessagesOwner, setPinnedMessagesOwner]);

  useEffect(() => {
    if (!socket || !selectedConversationId) return undefined;

    socket.emit("join_conversation", selectedConversationId);

    return () => {
      socket.emit("typing_status", {
        conversationId: selectedConversationId,
        isTyping: false,
      });
    };
  }, [socket, selectedConversationId]);

  useEffect(() => {
    return () => {
      clearTimeout(typingTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (!socket) return undefined;

    const getEventOrganizationId = (event = {}) =>
      toComparableId(
        event.organizationId ||
          event.conversation?.organizationId ||
          event.message?.organizationId,
      );

    const isActiveOrganizationEvent = (event = {}) => {
      const eventOrganizationId = getEventOrganizationId(event);
      return !eventOrganizationId || eventOrganizationId === activeOrganizationId;
    };

    const isSelectedConversationEvent = (eventConversationId) => {
      return (
        selectedConversationId &&
        toComparableId(eventConversationId) === selectedConversationId
      );
    };

    const applyMessageUpdate = (eventConversationId, updater) => {
      const eventConversationIdText = toComparableId(eventConversationId);
      if (!eventConversationIdText) return;

      if (isSelectedConversationEvent(eventConversationIdText)) {
        const hasCurrentMessages =
          messagesConversationIdRef.current === eventConversationIdText;
        setMessagesOwner(eventConversationIdText);
        setMessages((prev) => {
          const baseMessages = hasCurrentMessages
            ? prev
            : getCachedMessages(
                messagesCacheRef.current,
                eventConversationIdText
              ) || [];
          const nextMessages = updater(baseMessages);
          setCachedMessages(
            messagesCacheRef.current,
            eventConversationIdText,
            nextMessages
          );
          return nextMessages;
        });
        return;
      }

      updateCachedMessages(
        messagesCacheRef.current,
        eventConversationIdText,
        updater
      );
    };

    const applyPinnedMessageUpdate = (eventConversationId, updater) => {
      const eventConversationIdText = toComparableId(eventConversationId);
      if (!eventConversationIdText) return;

      if (isSelectedConversationEvent(eventConversationIdText)) {
        const hasCurrentPinnedMessages =
          pinnedMessagesConversationIdRef.current === eventConversationIdText;
        setPinnedMessagesOwner(eventConversationIdText);
        setPinnedMessages((prev) => {
          const basePinnedMessages = hasCurrentPinnedMessages
            ? prev
            : getCachedMessages(
                pinnedMessagesCacheRef.current,
                eventConversationIdText
              ) || [];
          const nextPinnedMessages = updater(basePinnedMessages);
          setCachedMessages(
            pinnedMessagesCacheRef.current,
            eventConversationIdText,
            nextPinnedMessages
          );
          return nextPinnedMessages;
        });
        return;
      }

      updateCachedMessages(
        pinnedMessagesCacheRef.current,
        eventConversationIdText,
        updater
      );
    };

    const handleNewMessage = (message) => {
      if (!isActiveOrganizationEvent(message)) return;
      applyMessageUpdate(message.conversationId, (prev) =>
        upsertMessageById(prev, message)
      );
      applyPinnedMessageUpdate(message.conversationId, (prev) =>
        upsertPinnedMessage(prev, message)
      );
      setConversations((prev) =>
        updateConversationPreview(prev, message, {
          currentUserId: user?._id || user?.id,
          selectedConversationId,
        })
      );
    };

    const handleMessageUpdated = (message) => {
      if (!isActiveOrganizationEvent(message)) return;
      applyMessageUpdate(message.conversationId, (prev) =>
        upsertMessageById(prev, message)
      );
      applyPinnedMessageUpdate(message.conversationId, (prev) =>
        upsertPinnedMessage(prev, message)
      );
      if (message.conversation) {
        setConversations((prev) =>
          mergeConversationUpdate(prev, message.conversation, {
            preserveUnread: true,
          })
        );
      }
    };

    const handleMessageDeleted = ({
      messageId,
      conversationId: eventConversationId,
      organizationId,
      message,
      conversation,
    }) => {
      if (!isActiveOrganizationEvent({ organizationId, message, conversation })) {
        return;
      }
      const deletedMessage =
        message || {
          id: messageId,
          conversationId: eventConversationId,
          deletedAt: new Date().toISOString(),
        };

      applyMessageUpdate(eventConversationId, (prev) =>
        applyDeletedMessage(prev, deletedMessage)
      );
      applyPinnedMessageUpdate(eventConversationId, (prev) =>
        upsertPinnedMessage(prev, deletedMessage)
      );
      if (isSelectedConversationEvent(eventConversationId)) {
        setReplyToMessage((prev) =>
          toComparableId(prev?.id) === toComparableId(messageId) ? null : prev
        );
        setEditingMessage((prev) =>
          toComparableId(prev?.id) === toComparableId(messageId) ? null : prev
        );
      }
      if (conversation) {
        setConversations((prev) =>
          mergeConversationUpdate(prev, conversation, { preserveUnread: true })
        );
        return;
      }

      setConversations((prev) =>
        updateConversationPreview(prev, deletedMessage, {
          currentUserId: user?._id || user?.id,
          selectedConversationId,
        })
      );
    };

    const handleReactionAdded = (event) => {
      if (!isActiveOrganizationEvent(event)) return;
      applyMessageUpdate(event.conversationId, (prev) =>
        addReactionToMessages(prev, event)
      );
    };

    const handleReactionRemoved = (event) => {
      if (!isActiveOrganizationEvent(event)) return;
      applyMessageUpdate(event.conversationId, (prev) =>
        removeReactionFromMessages(prev, event)
      );
    };

    const handleUserTyping = (event) => {
      if (!isActiveOrganizationEvent(event)) return;
      if (
        isSelectedConversationEvent(event.conversationId) &&
        toComparableId(event.userId) !== toComparableId(user?._id)
      ) {
        setTypingUsers((prev) => updateTypingUsers(prev, event));
      }
    };

    const handleActivityStatusChanged = (event) => {
      setConversations((prev) =>
        updateConversationParticipantStatus(prev, event)
      );
      setSelectedConversation((prev) => {
        if (!prev) return prev;
        return updateConversationParticipantStatus([prev], event)[0];
      });
    };

    socket.on("new_message", handleNewMessage);
    socket.on("message_updated", handleMessageUpdated);
    socket.on("message_deleted", handleMessageDeleted);
    socket.on("reaction_added", handleReactionAdded);
    socket.on("reaction_removed", handleReactionRemoved);
    socket.on("user_typing", handleUserTyping);
    socket.on("activity_status_changed", handleActivityStatusChanged);

    return () => {
      socket.off("new_message", handleNewMessage);
      socket.off("message_updated", handleMessageUpdated);
      socket.off("message_deleted", handleMessageDeleted);
      socket.off("reaction_added", handleReactionAdded);
      socket.off("reaction_removed", handleReactionRemoved);
      socket.off("user_typing", handleUserTyping);
      socket.off("activity_status_changed", handleActivityStatusChanged);
    };
  }, [
    socket,
    activeOrganizationId,
    selectedConversationId,
    setMessagesOwner,
    setPinnedMessagesOwner,
    user?._id,
    user?.id,
  ]);

  const emitTypingStatus = useCallback(
    (isTyping) => {
      if (!socket || !selectedConversationId) return;
      socket.emit("typing_status", {
        conversationId: selectedConversationId,
        isTyping,
      });
    },
    [socket, selectedConversationId]
  );

  const handleTypingChange = useCallback(
    (isTyping) => {
      clearTimeout(typingTimeoutRef.current);
      emitTypingStatus(isTyping);

      if (isTyping) {
        typingTimeoutRef.current = setTimeout(() => {
          emitTypingStatus(false);
        }, 3000);
      }
    },
    [emitTypingStatus]
  );

  const handleSelectConversation = (conv) => {
    setSelectedConversation(conv);
    setTypingUsers([]);
    setReplyToMessage(null);
    setEditingMessage(null);
    setShowMobileDetail(false);
    setMobileView("chat");
    navigate(`/messages/${getConversationId(conv)}`);
  };

  const handleBackToList = () => {
    setMobileView("list");
    setSelectedConversation(null);
    setTypingUsers([]);
    setReplyToMessage(null);
    setEditingMessage(null);
    setShowMobileDetail(false);
    navigate("/messages");
  };

  const handleToggleDetail = () => {
    const shouldUseDesktopRail =
      typeof window !== "undefined" &&
      window.matchMedia("(min-width: 1280px)").matches;

    if (shouldUseDesktopRail) {
      setShowDetail((value) => !value);
      return;
    }

    setShowMobileDetail((value) => !value);
  };

  const applySelectedMessagesUpdate = useCallback(
    (updater) => {
      if (!selectedConversationId || typeof updater !== "function") return;

      const hasCurrentMessages =
        messagesConversationIdRef.current === selectedConversationId;
      setMessagesOwner(selectedConversationId);
      setMessages((prev) => {
        const baseMessages = hasCurrentMessages
          ? prev
          : getCachedMessages(messagesCacheRef.current, selectedConversationId) ||
            [];
        const nextMessages = updater(baseMessages);
        setCachedMessages(
          messagesCacheRef.current,
          selectedConversationId,
          nextMessages
        );
        return nextMessages;
      });
    },
    [selectedConversationId, setMessagesOwner]
  );

  const applySelectedPinnedMessagesUpdate = useCallback(
    (updater) => {
      if (!selectedConversationId || typeof updater !== "function") return;

      const hasCurrentPinnedMessages =
        pinnedMessagesConversationIdRef.current === selectedConversationId;
      setPinnedMessagesOwner(selectedConversationId);
      setPinnedMessages((prev) => {
        const basePinnedMessages = hasCurrentPinnedMessages
          ? prev
          : getCachedMessages(
              pinnedMessagesCacheRef.current,
              selectedConversationId
            ) || [];
        const nextPinnedMessages = updater(basePinnedMessages);
        setCachedMessages(
          pinnedMessagesCacheRef.current,
          selectedConversationId,
          nextPinnedMessages
        );
        return nextPinnedMessages;
      });
    },
    [selectedConversationId, setPinnedMessagesOwner]
  );

  const upsertSelectedMessages = useCallback(
    (...nextMessages) => {
      applySelectedMessagesUpdate((prev) =>
        nextMessages
          .filter(Boolean)
          .reduce(
            (messagesToUpdate, message) =>
              upsertMessageById(messagesToUpdate, message),
            prev
          )
      );
    },
    [applySelectedMessagesUpdate]
  );

  const handleSendMessage = useCallback(
    async (content, options = {}) => {
      if (!selectedConversationId) return;

      try {
        const attachments = Array.isArray(options.attachments)
          ? options.attachments
          : [];
        const messageType = options.type || "text";
        const metadata = options.metadata || {};
        const poll = options.poll || null;
        const message = editingMessage
          ? await updateConversationMessage(
              selectedConversationId,
              editingMessage.id,
              { content }
            )
          : await sendConversationMessage(selectedConversationId, {
              type: messageType,
              content,
              attachments,
              metadata,
              poll,
              replyTo: replyToMessage?.id || null,
            });
        upsertSelectedMessages(message);
        applySelectedPinnedMessagesUpdate((prev) =>
          upsertPinnedMessage(prev, message)
        );
        if (!editingMessage) {
          setConversations((prev) =>
            updateConversationPreview(prev, message, {
              currentUserId: user?._id || user?.id,
              selectedConversationId,
            })
          );
        }
        setReplyToMessage(null);
        setEditingMessage(null);
        handleTypingChange(false);
      } catch (err) {
        console.error("Failed to send message:", err);
      }
    },
    [
      editingMessage,
      applySelectedPinnedMessagesUpdate,
      handleTypingChange,
      replyToMessage?.id,
      selectedConversationId,
      upsertSelectedMessages,
      user?._id,
      user?.id,
    ]
  );

  const handleUploadAttachment = useCallback(
    async (file, options = {}) => {
      if (!selectedConversationId) {
        throw new Error("Conversation is required before uploading attachments");
      }

      return uploadConversationAttachment(selectedConversationId, file, options);
    },
    [selectedConversationId]
  );

  const handleCreatePoll = useCallback(
    async (poll) => {
      if (!selectedConversationId) return;

      try {
        const createPollResult = await sendConversationMessage(
          selectedConversationId,
          {
            type: "poll",
            content: poll.question,
            poll,
            metadata: {},
          }
        );
        const message = createPollResult.message || createPollResult;
        const systemMessage = createPollResult.systemMessage || null;

        upsertSelectedMessages(message, systemMessage);
        applySelectedPinnedMessagesUpdate((prev) =>
          upsertPinnedMessage(prev, message)
        );
        setConversations((prev) =>
          updateConversationPreview(prev, systemMessage || message, {
            currentUserId: user?._id || user?.id,
            selectedConversationId,
          })
        );
        setReplyToMessage(null);
        setEditingMessage(null);
        handleTypingChange(false);
      } catch (err) {
        console.error("Failed to create poll:", err);
        toast.error("Không thể tạo bình chọn");
        throw err;
      }
    },
    [
      handleTypingChange,
      applySelectedPinnedMessagesUpdate,
      selectedConversationId,
      toast,
      upsertSelectedMessages,
      user?._id,
      user?.id,
    ]
  );

  const handleCreateReminder = useCallback(
    async (reminder) => {
      if (!selectedConversationId) return;

      try {
        const createReminderResult = await sendConversationMessage(
          selectedConversationId,
          {
            type: "reminder",
            content: reminder.title,
            reminder,
            metadata: {},
          }
        );
        const message = createReminderResult.message || createReminderResult;
        const systemMessage = createReminderResult.systemMessage || null;

        upsertSelectedMessages(message, systemMessage);
        applySelectedPinnedMessagesUpdate((prev) =>
          upsertPinnedMessage(prev, message)
        );
        setConversations((prev) =>
          updateConversationPreview(prev, systemMessage || message, {
            currentUserId: user?._id || user?.id,
            selectedConversationId,
          })
        );
        setReplyToMessage(null);
        setEditingMessage(null);
        handleTypingChange(false);
      } catch (err) {
        console.error("Failed to create reminder:", err);
        toast.error("Không thể tạo nhắc hẹn");
        throw err;
      }
    },
    [
      handleTypingChange,
      applySelectedPinnedMessagesUpdate,
      selectedConversationId,
      toast,
      upsertSelectedMessages,
      user?._id,
      user?.id,
    ]
  );

  const handleReplyMessage = useCallback((message) => {
    setEditingMessage(null);
    setReplyToMessage(message);
  }, []);

  const handleEditMessage = useCallback((message) => {
    setReplyToMessage(null);
    setEditingMessage(message);
  }, []);

  const handleCancelDraft = useCallback(() => {
    setReplyToMessage(null);
    setEditingMessage(null);
    handleTypingChange(false);
  }, [handleTypingChange]);

  const handleDeleteMessage = useCallback(
    async (message) => {
      if (!selectedConversationId || !message?.id) return;

      try {
        const deleteResult = await deleteConversationMessage(
          selectedConversationId,
          message.id
        );
        const deletedMessage = deleteResult.message || deleteResult;
        applySelectedMessagesUpdate((prev) =>
          applyDeletedMessage(prev, deletedMessage)
        );
        applySelectedPinnedMessagesUpdate((prev) =>
          upsertPinnedMessage(prev, deletedMessage)
        );
        setReplyToMessage((prev) =>
          toComparableId(prev?.id) === toComparableId(message.id) ? null : prev
        );
        setEditingMessage((prev) =>
          toComparableId(prev?.id) === toComparableId(message.id) ? null : prev
        );
        if (deleteResult.conversation) {
          setConversations((prev) =>
            mergeConversationUpdate(prev, deleteResult.conversation)
          );
        } else {
          setConversations((prev) =>
            updateConversationPreview(prev, deletedMessage, {
              currentUserId: user?._id || user?.id,
              selectedConversationId,
            })
          );
        }
      } catch (err) {
        console.error("Failed to delete message:", err);
      }
    },
    [
      applySelectedMessagesUpdate,
      applySelectedPinnedMessagesUpdate,
      selectedConversationId,
      user?._id,
      user?.id,
    ]
  );

  const handleMarkConversationRead = useCallback(
    async (conversation) => {
      const targetConversationId = getConversationId(conversation);
      if (!targetConversationId) return;

      setConversations((prev) => markConversationAsRead(prev, targetConversationId));
      setSelectedConversation((prev) => {
        if (!prev || getConversationId(prev) !== targetConversationId) return prev;
        return markConversationAsRead([prev], targetConversationId)[0];
      });

      try {
        const updatedConversation = await markConversationReadRequest(
          targetConversationId
        );
        setConversations((prev) =>
          mergeConversationUpdate(prev, updatedConversation)
        );
        setSelectedConversation((prev) =>
          prev && getConversationId(prev) === targetConversationId
            ? updatedConversation
            : prev
        );
      } catch (err) {
        console.error("Failed to mark conversation as read:", err);
      }
    },
    []
  );

  const handleCopyMessage = useCallback(
    async (message) => {
      const text = getMessageCopyText(message);
      if (!text) {
        toast.warning("Tin nhắn không có nội dung để sao chép");
        return;
      }

      try {
        await writeTextToClipboard(text);
        toast.success("Đã sao chép tin nhắn");
      } catch (err) {
        console.error("Failed to copy message:", err);
        toast.error("Không thể sao chép tin nhắn");
      }
    },
    [toast]
  );

  const handleTogglePinMessage = useCallback(
    async (message) => {
      if (!selectedConversationId || !message?.id) return;

      const nextPinnedState = !message.isPinned;

      try {
        const pinResult = await updateMessagePin(
          selectedConversationId,
          message.id,
          nextPinnedState
        );
        const {
          message: responseMessage,
          systemMessage,
          conversation,
          ...messagePayload
        } = pinResult;
        const updatedMessage = responseMessage || messagePayload;

        upsertSelectedMessages(updatedMessage, systemMessage);
        applySelectedPinnedMessagesUpdate((prev) =>
          upsertPinnedMessage(prev, updatedMessage)
        );
        if (conversation) {
          setConversations((prev) =>
            mergeConversationUpdate(prev, conversation)
          );
        }
      } catch (err) {
        console.error("Failed to pin message:", err);
        toast.error("Không thể cập nhật ghim tin nhắn");
      }
    },
    [
      applySelectedPinnedMessagesUpdate,
      selectedConversationId,
      toast,
      upsertSelectedMessages,
    ]
  );

  const handleLoadOlderMessages = useCallback(async () => {
    if (
      !selectedConversationId ||
      isLoadingMessages ||
      messagePageState.isLoadingOlder ||
      !messagePageState.hasOlder
    ) {
      return false;
    }

    const currentMessages =
      messagesConversationIdRef.current === selectedConversationId
        ? messages
        : getCachedMessages(messagesCacheRef.current, selectedConversationId) || [];
    const before = getOldestMessageCursor(currentMessages);

    if (!before) {
      setMessagePageStateForConversation(selectedConversationId, {
        hasOlder: false,
      });
      return false;
    }

    const requestSeq = olderMessagesRequestSeqRef.current + 1;
    olderMessagesRequestSeqRef.current = requestSeq;
    setMessagePageState(
      createMessagePageState({
        hasOlder: messagePageState.hasOlder,
        isLoadingOlder: true,
      }),
    );

    try {
      const res = await getMessages(selectedConversationId, {
        before,
        limit: MESSAGE_PAGE_SIZE,
      });

      if (
        selectedConversationIdRef.current !== selectedConversationId ||
        olderMessagesRequestSeqRef.current !== requestSeq
      ) {
        return false;
      }

      const loadedMessages = normalizeMessagesForDisplay(res.content || []);
      const nextMessagePageState = createMessagePageState({
        hasOlder: res.hasMore,
      });

      applySelectedMessagesUpdate((prev) =>
        mergeMessagePage(prev, loadedMessages),
      );
      setMessagePageStateForConversation(
        selectedConversationId,
        nextMessagePageState,
      );

      return loadedMessages.length > 0;
    } catch (err) {
      console.error("Failed to load older messages:", err);

      if (
        selectedConversationIdRef.current === selectedConversationId &&
        olderMessagesRequestSeqRef.current === requestSeq
      ) {
        setMessagePageState(
          createMessagePageState({
            hasOlder: messagePageState.hasOlder,
          }),
        );
      }

      return false;
    }
  }, [
    applySelectedMessagesUpdate,
    isLoadingMessages,
    messagePageState.hasOlder,
    messagePageState.isLoadingOlder,
    messages,
    selectedConversationId,
    setMessagePageStateForConversation,
  ]);

  const handleEnsureMessageLoaded = useCallback(
    async (targetMessage) => {
      const targetMessageId = getMessageId(targetMessage);
      if (!selectedConversationId || !targetMessageId) return false;

      const isAlreadyLoaded = messages.some(
        (message) => getMessageId(message) === targetMessageId
      );
      if (isAlreadyLoaded) return true;

      try {
        const res = await getMessages(selectedConversationId, {
          around: targetMessageId,
          limit: MESSAGE_PAGE_SIZE,
        });
        const loadedMessages = normalizeMessagesForDisplay(res.content || []);
        const didLoadTarget = loadedMessages.some(
          (message) => getMessageId(message) === targetMessageId
        );

        if (!didLoadTarget) return false;

        applySelectedMessagesUpdate((prev) =>
          mergeMessagePage(prev, loadedMessages),
        );
        setMessagePageStateForConversation(
          selectedConversationId,
          createMessagePageState({
            hasOlder: res.hasMore,
          }),
        );

        return true;
      } catch (err) {
        console.error("Failed to load pinned message context:", err);
        return false;
      }
    },
    [
      applySelectedMessagesUpdate,
      messages,
      selectedConversationId,
      setMessagePageStateForConversation,
    ]
  );

  const handleToggleReaction = useCallback(
    async (message, reaction) => {
      if (!selectedConversationId || !message?.id) return;

      const hasReaction = (message.reactions || []).some(
        (item) =>
          toComparableId(item.userId) ===
            toComparableId(user?._id || user?.id) &&
          item.reaction === reaction
      );

      try {
        if (hasReaction) {
          await removeMessageReaction(selectedConversationId, message.id, reaction);
          applySelectedMessagesUpdate((prev) =>
            removeReactionFromMessages(prev, {
              messageId: message.id,
              userId: user?._id || user?.id,
              reaction,
            })
          );
        } else {
          await addMessageReaction(selectedConversationId, message.id, reaction);
          applySelectedMessagesUpdate((prev) =>
            addReactionToMessages(prev, {
              messageId: message.id,
              userId: user?._id || user?.id,
              reaction,
            })
          );
        }
      } catch (err) {
        console.error("Failed to toggle reaction:", err);
      }
    },
    [applySelectedMessagesUpdate, selectedConversationId, user?._id, user?.id]
  );

  const handleVotePoll = useCallback(
    async (message, optionIds) => {
      if (!selectedConversationId || !message?.id) return;

      try {
        const voteResult = await voteConversationPoll(
          selectedConversationId,
          message.id,
          optionIds
        );
        const updatedMessage = voteResult.message || voteResult;
        const systemMessage = voteResult.systemMessage || null;

        upsertSelectedMessages(updatedMessage, systemMessage);
        applySelectedPinnedMessagesUpdate((prev) =>
          upsertPinnedMessage(prev, updatedMessage)
        );
        if (voteResult.conversation) {
          setConversations((prev) =>
            mergeConversationUpdate(prev, voteResult.conversation)
          );
        } else {
          setConversations((prev) =>
            updateConversationPreview(prev, systemMessage || updatedMessage, {
              currentUserId: user?._id || user?.id,
              selectedConversationId,
            })
          );
        }
      } catch (err) {
        console.error("Failed to vote poll:", err);
        toast.error("Không thể cập nhật bình chọn");
        throw err;
      }
    },
    [
      applySelectedPinnedMessagesUpdate,
      selectedConversationId,
      toast,
      upsertSelectedMessages,
      user?._id,
      user?.id,
    ]
  );

  const handleAddPollOption = useCallback(
    async (message, text) => {
      if (!selectedConversationId || !message?.id) return;

      try {
        const optionResult = await addConversationPollOption(
          selectedConversationId,
          message.id,
          text
        );
        const updatedMessage = optionResult.message || optionResult;
        const systemMessage = optionResult.systemMessage || null;

        upsertSelectedMessages(updatedMessage, systemMessage);
        applySelectedPinnedMessagesUpdate((prev) =>
          upsertPinnedMessage(prev, updatedMessage)
        );
        if (optionResult.conversation) {
          setConversations((prev) =>
            mergeConversationUpdate(prev, optionResult.conversation)
          );
        } else {
          setConversations((prev) =>
            updateConversationPreview(prev, systemMessage || updatedMessage, {
              currentUserId: user?._id || user?.id,
              selectedConversationId,
            })
          );
        }
      } catch (err) {
        console.error("Failed to add poll option:", err);
        toast.error("Không thể thêm phương án");
        throw err;
      }
    },
    [
      applySelectedPinnedMessagesUpdate,
      selectedConversationId,
      toast,
      upsertSelectedMessages,
      user?._id,
      user?.id,
    ]
  );

  const handleSharePoll = useCallback(
    async (message) => {
      if (!selectedConversationId || !message?.id) return;

      try {
        const shareResult = await shareConversationPoll(
          selectedConversationId,
          message.id
        );
        const updatedMessage = shareResult.message || message;
        const systemMessage = shareResult.systemMessage || null;

        upsertSelectedMessages(updatedMessage, systemMessage);
        applySelectedPinnedMessagesUpdate((prev) =>
          upsertPinnedMessage(prev, updatedMessage)
        );
        if (shareResult.conversation) {
          setConversations((prev) =>
            mergeConversationUpdate(prev, shareResult.conversation)
          );
        } else {
          setConversations((prev) =>
            updateConversationPreview(prev, systemMessage || updatedMessage, {
              currentUserId: user?._id || user?.id,
              selectedConversationId,
            })
          );
        }
      } catch (err) {
        console.error("Failed to send poll to group:", err);
        toast.error("Không thể gửi bình chọn vào nhóm");
        throw err;
      }
    },
    [
      applySelectedPinnedMessagesUpdate,
      selectedConversationId,
      toast,
      upsertSelectedMessages,
      user?._id,
      user?.id,
    ]
  );

  const handleClosePoll = useCallback(
    async (message) => {
      if (!selectedConversationId || !message?.id) return;

      try {
        const closeResult = await closeConversationPoll(
          selectedConversationId,
          message.id
        );
        const updatedMessage = closeResult.message || message;
        const systemMessage = closeResult.systemMessage || null;

        upsertSelectedMessages(updatedMessage, systemMessage);
        applySelectedPinnedMessagesUpdate((prev) =>
          upsertPinnedMessage(prev, updatedMessage)
        );
        if (closeResult.conversation) {
          setConversations((prev) =>
            mergeConversationUpdate(prev, closeResult.conversation)
          );
        } else {
          setConversations((prev) =>
            updateConversationPreview(prev, systemMessage || updatedMessage, {
              currentUserId: user?._id || user?.id,
              selectedConversationId,
            })
          );
        }
      } catch (err) {
        console.error("Failed to close poll:", err);
        toast.error("Không thể khóa bình chọn");
        throw err;
      }
    },
    [
      applySelectedPinnedMessagesUpdate,
      selectedConversationId,
      toast,
      upsertSelectedMessages,
      user?._id,
      user?.id,
    ]
  );

  const handleRespondReminder = useCallback(
    async (message, status) => {
      if (!selectedConversationId || !message?.id) return;

      try {
        const responseResult = await respondConversationReminder(
          selectedConversationId,
          message.id,
          status
        );
        const updatedMessage = responseResult.message || responseResult;
        const systemMessage = responseResult.systemMessage || null;

        upsertSelectedMessages(updatedMessage, systemMessage);
        applySelectedPinnedMessagesUpdate((prev) =>
          upsertPinnedMessage(prev, updatedMessage)
        );
        if (responseResult.conversation) {
          setConversations((prev) =>
            mergeConversationUpdate(prev, responseResult.conversation)
          );
        } else {
          setConversations((prev) =>
            updateConversationPreview(prev, systemMessage || updatedMessage, {
              currentUserId: user?._id || user?.id,
              selectedConversationId,
            })
          );
        }
      } catch (err) {
        console.error("Failed to update reminder response:", err);
        toast.error("Không thể cập nhật nhắc hẹn");
        throw err;
      }
    },
    [
      applySelectedPinnedMessagesUpdate,
      selectedConversationId,
      toast,
      upsertSelectedMessages,
      user?._id,
      user?.id,
    ]
  );

  const handleEditReminder = useCallback(
    async (message, reminder) => {
      if (!selectedConversationId || !message?.id) return;

      try {
        const updateResult = await updateConversationMessage(
          selectedConversationId,
          message.id,
          {
            content: reminder.title,
            reminder,
          }
        );
        const updatedMessage = updateResult.message || updateResult;

        upsertSelectedMessages(updatedMessage);
        applySelectedPinnedMessagesUpdate((prev) =>
          upsertPinnedMessage(prev, updatedMessage)
        );
        const lastMessageId = toComparableId(
          selectedConversation?.lastMessage?.id ||
            selectedConversation?.lastMessage?.messageId,
        );
        if (lastMessageId === toComparableId(message.id)) {
          setConversations((prev) =>
            updateConversationPreview(prev, updatedMessage, {
              currentUserId: user?._id || user?.id,
              selectedConversationId,
            })
          );
        }
      } catch (err) {
        console.error("Failed to edit reminder:", err);
        toast.error("Không thể chỉnh sửa nhắc hẹn");
        throw err;
      }
    },
    [
      applySelectedPinnedMessagesUpdate,
      selectedConversationId,
      selectedConversation?.lastMessage?.id,
      selectedConversation?.lastMessage?.messageId,
      toast,
      upsertSelectedMessages,
      user?._id,
      user?.id,
    ]
  );

  const handleCancelReminder = useCallback(
    async (message) => {
      if (!selectedConversationId || !message?.id) return;

      try {
        const cancelResult = await cancelConversationReminder(
          selectedConversationId,
          message.id
        );
        const updatedMessage = cancelResult.message || message;
        const systemMessage = cancelResult.systemMessage || null;

        upsertSelectedMessages(updatedMessage, systemMessage);
        applySelectedPinnedMessagesUpdate((prev) =>
          upsertPinnedMessage(prev, updatedMessage)
        );
        if (cancelResult.conversation) {
          setConversations((prev) =>
            mergeConversationUpdate(prev, cancelResult.conversation)
          );
        } else {
          setConversations((prev) =>
            updateConversationPreview(prev, systemMessage || updatedMessage, {
              currentUserId: user?._id || user?.id,
              selectedConversationId,
            })
          );
        }
      } catch (err) {
        console.error("Failed to cancel reminder:", err);
        toast.error("Không thể hủy nhắc hẹn");
        throw err;
      }
    },
    [
      applySelectedPinnedMessagesUpdate,
      selectedConversationId,
      toast,
      upsertSelectedMessages,
      user?._id,
      user?.id,
    ]
  );

  const handleCreateConversation = async (newConv) => {
    const newConversationId = getConversationId(newConv);
    let nextConversation = newConv;

    try {
      nextConversation = await getConversationById(newConversationId);
    } catch (err) {
      console.error("Failed to hydrate new conversation:", err);
    }

    setConversations((prev) =>
      sortConversationsByActivity([
        nextConversation,
        ...prev.filter(
          (conversation) =>
            getConversationId(conversation) !== getConversationId(nextConversation)
        ),
      ])
    );
    setSelectedConversation(nextConversation);
    setShowNewModal(false);
    setMobileView("chat");
    navigate(`/messages/${getConversationId(nextConversation)}`);
  };

  const activeConversation =
    selectedConversationId &&
    getConversationId(selectedConversation) === selectedConversationId
      ? selectedConversation
      : conversations.find(
          (conversation) => getConversationId(conversation) === selectedConversationId
        ) || null;
  const hasMessagesForSelectedConversation = areMessagesForConversation(
    messagesConversationId,
    selectedConversationId
  );
  const visibleMessages = getVisibleMessagesForConversation(
    messages,
    messagesConversationId,
    selectedConversationId
  );
  const visiblePinnedMessages = getVisibleMessagesForConversation(
    pinnedMessages,
    pinnedMessagesConversationId,
    selectedConversationId
  );
  const visibleIsLoadingMessages =
    isLoadingMessages ||
    (Boolean(selectedConversationId) && !hasMessagesForSelectedConversation);
  const visibleHasOlderMessages =
    hasMessagesForSelectedConversation && messagePageState.hasOlder;
  const visibleIsLoadingOlderMessages =
    hasMessagesForSelectedConversation && messagePageState.isLoadingOlder;

  return (
    <div className="chat-page-shell flex h-full w-full overflow-hidden bg-slate-100 text-slate-950">
      {/* Conversation List - Hidden on mobile when viewing chat */}
      <div
        className={`${
          mobileView === "chat" ? "hidden" : "flex"
        } min-w-0 w-full shrink-0 md:flex md:w-[19rem] md:max-w-[38vw] lg:w-[21rem] xl:w-[22rem]`}
      >
        <ConversationList
          conversations={conversations}
          selectedId={selectedConversationId}
          onSelect={handleSelectConversation}
          onMarkRead={handleMarkConversationRead}
          onCreateNew={() => setShowNewModal(true)}
          currentUserId={user?._id || user?.id}
        />
      </div>

      {/* Chat Window - Hidden on mobile when viewing list */}
      <div
        className={`${
          mobileView === "list" ? "hidden" : "flex"
        } min-w-0 flex-1 p-2 md:flex md:p-3`}
      >
        <ChatWindow
          conversation={activeConversation}
          messages={visibleMessages}
          pinnedMessages={visiblePinnedMessages}
          onSendMessage={handleSendMessage}
          onUploadAttachment={handleUploadAttachment}
          onCreatePoll={handleCreatePoll}
          onCreateReminder={handleCreateReminder}
          onTypingChange={handleTypingChange}
          onReplyMessage={handleReplyMessage}
          onEditMessage={handleEditMessage}
          onDeleteMessage={handleDeleteMessage}
          onCopyMessage={handleCopyMessage}
          onTogglePinMessage={handleTogglePinMessage}
          onEnsureMessageLoaded={handleEnsureMessageLoaded}
          onLoadOlderMessages={handleLoadOlderMessages}
          onToggleReaction={handleToggleReaction}
          onVotePoll={handleVotePoll}
          onAddPollOption={handleAddPollOption}
          onSharePoll={handleSharePoll}
          onClosePoll={handleClosePoll}
          onRespondReminder={handleRespondReminder}
          onCancelReminder={handleCancelReminder}
          onEditReminder={handleEditReminder}
          onCancelDraft={handleCancelDraft}
          onStartCall={startCall}
          onBack={handleBackToList}
          onToggleDetail={handleToggleDetail}
          replyToMessage={replyToMessage}
          editingMessage={editingMessage}
          typingUsers={typingUsers}
          isLoadingMessages={visibleIsLoadingMessages}
          hasOlderMessages={visibleHasOlderMessages}
          isLoadingOlderMessages={visibleIsLoadingOlderMessages}
          isComposerDisabled={!isAuthenticated}
        />
      </div>

      {/* Detail Panel - Desktop only, toggleable */}
      {showDetail && activeConversation && (
        <div className="hidden shrink-0 py-3 pr-3 xl:flex">
          <ChatDetailPanel
            conversation={activeConversation}
            currentUserId={user?._id || user?.id}
            className="flex w-80 rounded-2xl border border-slate-200 bg-white shadow-sm xl:w-[20rem] 2xl:w-80"
            onClose={() => setShowDetail(false)}
          />
        </div>
      )}

      {/* Detail drawer - Mobile/tablet */}
      {showMobileDetail && activeConversation && (
        <>
          <button
            type="button"
            aria-label="Đóng thông tin hội thoại"
            className="fixed inset-0 z-40 bg-slate-950/35 backdrop-blur-[2px] xl:hidden"
            onClick={() => setShowMobileDetail(false)}
          />
          <ChatDetailPanel
            conversation={activeConversation}
            currentUserId={user?._id || user?.id}
            className="chat-detail-drawer fixed bottom-3 right-3 top-[4.75rem] z-50 flex rounded-2xl border border-slate-200 bg-white shadow-2xl xl:hidden"
            onClose={() => setShowMobileDetail(false)}
          />
        </>
      )}

      {/* New Conversation Modal */}
      <NewConversationModal
        isOpen={showNewModal}
        onClose={() => setShowNewModal(false)}
        onCreate={handleCreateConversation}
      />
    </div>
  );
};

export default ChatPage;
