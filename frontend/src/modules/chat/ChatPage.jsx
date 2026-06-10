import { useCallback, useEffect, useRef, useState } from "react";
import { App } from "antd";
import { useNavigate, useParams } from "react-router-dom";
import {
  addPollOption as addConversationPollOption,
  addMessageReaction,
  deleteMessage as deleteConversationMessage,
  getConversationById,
  getConversations,
  getMessages,
  getPinnedMessages,
  markConversationAsRead as markConversationReadRequest,
  removeMessageReaction,
  sendMessage as sendConversationMessage,
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
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [showDetail, setShowDetail] = useState(true);
  const [showMobileDetail, setShowMobileDetail] = useState(false);
  const [showNewModal, setShowNewModal] = useState(false);
  const [mobileView, setMobileView] = useState("list"); // "list" | "chat"
  const [typingUsers, setTypingUsers] = useState([]);
  const [replyToMessage, setReplyToMessage] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const typingTimeoutRef = useRef(null);

  const selectedConversationId = getConversationId(selectedConversation);

  // Fetch conversations on mount
  useEffect(() => {
    let ignore = false;

    const fetchConversations = async () => {
      try {
        const res = await getConversations({ page: 1, size: 50 });
        if (ignore) return;

        const nextConversations = sortConversationsByActivity(res.content || []);
        setConversations(nextConversations);

        if (!conversationId) {
          setSelectedConversation(null);
          setMessages([]);
          setMobileView("list");
          return;
        }

        const matchedConversation = nextConversations.find(
          (conversation) => getConversationId(conversation) === conversationId
        );

        if (matchedConversation) {
          setSelectedConversation(matchedConversation);
          setMobileView("chat");
          return;
        }

        const fetchedConversation = await getConversationById(conversationId);
        if (ignore) return;
        setConversations((prev) =>
          sortConversationsByActivity([fetchedConversation, ...prev])
        );
        setSelectedConversation(fetchedConversation);
        setMobileView("chat");
      } catch (err) {
        console.error("Failed to fetch conversations:", err);
      }
    };

    fetchConversations();

    return () => {
      ignore = true;
    };
  }, [conversationId]);

  useEffect(() => {
    if (!selectedConversationId) {
      setMessages([]);
      setPinnedMessages([]);
      setTypingUsers([]);
      setReplyToMessage(null);
      setEditingMessage(null);
      return undefined;
    }

    let ignore = false;
    setIsLoadingMessages(true);

    const fetchMessages = async () => {
      const pinnedMessagesRequest = getPinnedMessages(selectedConversationId)
        .then((response) => ({ response }))
        .catch((error) => ({ error }));

      try {
        const res = await getMessages(selectedConversationId, { limit: 50 });
        if (!ignore) {
          setMessages(normalizeMessagesForDisplay(res.content || []));
          setConversations((prev) =>
            markConversationAsRead(prev, selectedConversationId)
          );
          setSelectedConversation((prev) => {
            if (!prev) return prev;
            return markConversationAsRead([prev], selectedConversationId)[0];
          });
        }

        const pinnedMessagesResult = await pinnedMessagesRequest;
        if (ignore) return;

        if (pinnedMessagesResult.response) {
          setPinnedMessages(
            sortPinnedMessages(pinnedMessagesResult.response.content || [])
          );
        } else {
          console.error(
            "Failed to fetch pinned messages:",
            pinnedMessagesResult.error
          );
          setPinnedMessages([]);
        }
      } catch (err) {
        console.error("Failed to fetch messages:", err);
        if (!ignore) {
          setMessages([]);
          setPinnedMessages([]);
        }
      } finally {
        if (!ignore) setIsLoadingMessages(false);
      }
    };

    fetchMessages();

    return () => {
      ignore = true;
    };
  }, [selectedConversationId]);

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

    const isSelectedConversationEvent = (eventConversationId) => {
      return (
        selectedConversationId &&
        toComparableId(eventConversationId) === selectedConversationId
      );
    };

    const handleNewMessage = (message) => {
      if (isSelectedConversationEvent(message.conversationId)) {
        setMessages((prev) => upsertMessageById(prev, message));
        setPinnedMessages((prev) => upsertPinnedMessage(prev, message));
      }
      setConversations((prev) =>
        updateConversationPreview(prev, message, {
          currentUserId: user?._id || user?.id,
          selectedConversationId,
        })
      );
    };

    const handleMessageUpdated = (message) => {
      if (isSelectedConversationEvent(message.conversationId)) {
        setMessages((prev) => upsertMessageById(prev, message));
        setPinnedMessages((prev) => upsertPinnedMessage(prev, message));
      }
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
      message,
      conversation,
    }) => {
      const deletedMessage =
        message || {
          id: messageId,
          conversationId: eventConversationId,
          deletedAt: new Date().toISOString(),
        };

      if (isSelectedConversationEvent(eventConversationId)) {
        setMessages((prev) => applyDeletedMessage(prev, deletedMessage));
        setPinnedMessages((prev) => upsertPinnedMessage(prev, deletedMessage));
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
      if (isSelectedConversationEvent(event.conversationId)) {
        setMessages((prev) => addReactionToMessages(prev, event));
      }
    };

    const handleReactionRemoved = (event) => {
      if (isSelectedConversationEvent(event.conversationId)) {
        setMessages((prev) => removeReactionFromMessages(prev, event));
      }
    };

    const handleUserTyping = (event) => {
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
  }, [socket, selectedConversationId, user?._id, user?.id]);

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

  const handleSendMessage = useCallback(
    async (content, options = {}) => {
      if (!selectedConversationId) return;

      setIsSending(true);
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
        setMessages((prev) => upsertMessageById(prev, message));
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
      } finally {
        setIsSending(false);
      }
    },
    [
      editingMessage,
      handleTypingChange,
      replyToMessage?.id,
      selectedConversationId,
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

      setIsSending(true);
      try {
        const message = await sendConversationMessage(selectedConversationId, {
          type: "poll",
          content: poll.question,
          poll,
          metadata: {},
        });
        setMessages((prev) => upsertMessageById(prev, message));
        setPinnedMessages((prev) => upsertPinnedMessage(prev, message));
        setConversations((prev) =>
          updateConversationPreview(prev, message, {
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
      } finally {
        setIsSending(false);
      }
    },
    [
      handleTypingChange,
      selectedConversationId,
      toast,
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
        setMessages((prev) => applyDeletedMessage(prev, deletedMessage));
        setPinnedMessages((prev) => upsertPinnedMessage(prev, deletedMessage));
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
    [selectedConversationId, user?._id, user?.id]
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

        setMessages((prev) => {
          const withUpdatedMessage = upsertMessageById(prev, updatedMessage);
          return systemMessage
            ? upsertMessageById(withUpdatedMessage, systemMessage)
            : withUpdatedMessage;
        });
        setPinnedMessages((prev) => upsertPinnedMessage(prev, updatedMessage));
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
    [selectedConversationId, toast]
  );

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
          limit: 50,
        });
        const loadedMessages = normalizeMessagesForDisplay(res.content || []);
        const didLoadTarget = loadedMessages.some(
          (message) => getMessageId(message) === targetMessageId
        );

        if (!didLoadTarget) return false;

        setMessages((prev) =>
          loadedMessages.reduce(
            (nextMessages, message) => upsertMessageById(nextMessages, message),
            prev
          )
        );

        return true;
      } catch (err) {
        console.error("Failed to load pinned message context:", err);
        return false;
      }
    },
    [messages, selectedConversationId]
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
          setMessages((prev) =>
            removeReactionFromMessages(prev, {
              messageId: message.id,
              userId: user?._id || user?.id,
              reaction,
            })
          );
        } else {
          await addMessageReaction(selectedConversationId, message.id, reaction);
          setMessages((prev) =>
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
    [selectedConversationId, user?._id, user?.id]
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

        setMessages((prev) => {
          const withUpdatedPoll = upsertMessageById(prev, updatedMessage);
          return systemMessage
            ? upsertMessageById(withUpdatedPoll, systemMessage)
            : withUpdatedPoll;
        });
        setPinnedMessages((prev) => upsertPinnedMessage(prev, updatedMessage));
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
    [selectedConversationId, toast, user?._id, user?.id]
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

        setMessages((prev) => {
          const withUpdatedPoll = upsertMessageById(prev, updatedMessage);
          return systemMessage
            ? upsertMessageById(withUpdatedPoll, systemMessage)
            : withUpdatedPoll;
        });
        setPinnedMessages((prev) => upsertPinnedMessage(prev, updatedMessage));
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
    [selectedConversationId, toast, user?._id, user?.id]
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
          conversation={selectedConversation}
          messages={messages}
          pinnedMessages={pinnedMessages}
          onSendMessage={handleSendMessage}
          onUploadAttachment={handleUploadAttachment}
          onCreatePoll={handleCreatePoll}
          onTypingChange={handleTypingChange}
          onReplyMessage={handleReplyMessage}
          onEditMessage={handleEditMessage}
          onDeleteMessage={handleDeleteMessage}
          onCopyMessage={handleCopyMessage}
          onTogglePinMessage={handleTogglePinMessage}
          onEnsureMessageLoaded={handleEnsureMessageLoaded}
          onToggleReaction={handleToggleReaction}
          onVotePoll={handleVotePoll}
          onAddPollOption={handleAddPollOption}
          onCancelDraft={handleCancelDraft}
          onStartCall={startCall}
          onBack={handleBackToList}
          onToggleDetail={handleToggleDetail}
          replyToMessage={replyToMessage}
          editingMessage={editingMessage}
          typingUsers={typingUsers}
          isLoadingMessages={isLoadingMessages}
          isSending={isSending || !isAuthenticated}
        />
      </div>

      {/* Detail Panel - Desktop only, toggleable */}
      {showDetail && selectedConversation && (
        <div className="hidden shrink-0 py-3 pr-3 xl:flex">
          <ChatDetailPanel
            conversation={selectedConversation}
            currentUserId={user?._id || user?.id}
            className="flex w-80 rounded-2xl border border-slate-200 bg-white shadow-sm xl:w-[20rem] 2xl:w-80"
            onClose={() => setShowDetail(false)}
          />
        </div>
      )}

      {/* Detail drawer - Mobile/tablet */}
      {showMobileDetail && selectedConversation && (
        <>
          <button
            type="button"
            aria-label="Đóng thông tin hội thoại"
            className="fixed inset-0 z-40 bg-slate-950/35 backdrop-blur-[2px] xl:hidden"
            onClick={() => setShowMobileDetail(false)}
          />
          <ChatDetailPanel
            conversation={selectedConversation}
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
