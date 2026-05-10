import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  addMessageReaction,
  deleteMessage as deleteConversationMessage,
  getConversationById,
  getConversations,
  getMessages,
  markConversationAsRead as markConversationReadRequest,
  removeMessageReaction,
  sendMessage as sendConversationMessage,
  uploadConversationAttachment,
  updateMessage as updateConversationMessage,
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

const getConversationId = (conversation) => {
  return toComparableId(conversation?.id || conversation?._id);
};

const normalizeMessagesForDisplay = (items = []) => {
  return [...items].sort(
    (a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0)
  );
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
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const { socket, isAuthenticated } = useSocket();
  const { startCall } = useCall();
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
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
      setTypingUsers([]);
      setReplyToMessage(null);
      setEditingMessage(null);
      return undefined;
    }

    let ignore = false;
    setIsLoadingMessages(true);

    const fetchMessages = async () => {
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
      } catch (err) {
        console.error("Failed to fetch messages:", err);
        if (!ignore) setMessages([]);
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
        const message = editingMessage
          ? await updateConversationMessage(
              selectedConversationId,
              editingMessage.id,
              { content }
            )
          : await sendConversationMessage(selectedConversationId, {
              type: "text",
              content,
              attachments,
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
    async (file) => {
      if (!selectedConversationId) {
        throw new Error("Conversation is required before uploading attachments");
      }

      return uploadConversationAttachment(selectedConversationId, file);
    },
    [selectedConversationId]
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

  const handleToggleReaction = useCallback(
    async (message, reaction) => {
      if (!selectedConversationId || !message?.id) return;

      const hasReaction = (message.reactions || []).some(
        (item) =>
          toComparableId(item.userId) === toComparableId(user?._id) &&
          item.reaction === reaction
      );

      try {
        if (hasReaction) {
          await removeMessageReaction(selectedConversationId, message.id, reaction);
          setMessages((prev) =>
            removeReactionFromMessages(prev, {
              messageId: message.id,
              userId: user?._id,
              reaction,
            })
          );
        } else {
          await addMessageReaction(selectedConversationId, message.id, reaction);
          setMessages((prev) =>
            addReactionToMessages(prev, {
              messageId: message.id,
              userId: user?._id,
              reaction,
            })
          );
        }
      } catch (err) {
        console.error("Failed to toggle reaction:", err);
      }
    },
    [selectedConversationId, user?._id]
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
          onSendMessage={handleSendMessage}
          onUploadAttachment={handleUploadAttachment}
          onTypingChange={handleTypingChange}
          onReplyMessage={handleReplyMessage}
          onEditMessage={handleEditMessage}
          onDeleteMessage={handleDeleteMessage}
          onToggleReaction={handleToggleReaction}
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
