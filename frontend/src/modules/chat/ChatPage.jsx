import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  addMessageReaction,
  deleteMessage as deleteConversationMessage,
  getConversationById,
  getConversations,
  getMessages,
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
import {
  addReactionToMessages,
  removeMessageById,
  removeReactionFromMessages,
  updateConversationParticipantStatus,
  updateConversationPreview,
  updateTypingUsers,
  upsertMessageById,
} from "./realtimeMessageState";
import { useSocket } from "../../context/SocketContext";

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

const ChatPage = () => {
  const { user, updateCurrentUser } = useAuth();
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const { socket, isAuthenticated } = useSocket();
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [showDetail, setShowDetail] = useState(true);
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

        const nextConversations = res.content || [];
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
        setConversations((prev) => [fetchedConversation, ...prev]);
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
      socket.emit("leave_conversation", selectedConversationId);
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
      setConversations((prev) => updateConversationPreview(prev, message));
    };

    const handleMessageUpdated = (message) => {
      if (isSelectedConversationEvent(message.conversationId)) {
        setMessages((prev) => upsertMessageById(prev, message));
      }
    };

    const handleMessageDeleted = ({ messageId, conversationId: eventConversationId }) => {
      if (isSelectedConversationEvent(eventConversationId)) {
        setMessages((prev) => removeMessageById(prev, messageId));
        setReplyToMessage((prev) =>
          toComparableId(prev?.id) === toComparableId(messageId) ? null : prev
        );
        setEditingMessage((prev) =>
          toComparableId(prev?.id) === toComparableId(messageId) ? null : prev
        );
      }
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
  }, [socket, selectedConversationId, user?._id]);

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
    setMobileView("chat");
    navigate(`/messages/${getConversationId(conv)}`);
  };

  const handleBackToList = () => {
    setMobileView("list");
    setSelectedConversation(null);
    setTypingUsers([]);
    setReplyToMessage(null);
    setEditingMessage(null);
    navigate("/messages");
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
          setConversations((prev) => updateConversationPreview(prev, message));
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
    [editingMessage, handleTypingChange, replyToMessage?.id, selectedConversationId]
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
        await deleteConversationMessage(selectedConversationId, message.id);
        setMessages((prev) => removeMessageById(prev, message.id));
      } catch (err) {
        console.error("Failed to delete message:", err);
      }
    },
    [selectedConversationId]
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

    setConversations((prev) => [
      nextConversation,
      ...prev.filter(
        (conversation) =>
          getConversationId(conversation) !== getConversationId(nextConversation)
      ),
    ]);
    setSelectedConversation(nextConversation);
    setShowNewModal(false);
    setMobileView("chat");
    navigate(`/messages/${getConversationId(nextConversation)}`);
  };

  return (
    <div className="flex h-full w-full overflow-hidden bg-white">
      {/* Conversation List - Hidden on mobile when viewing chat */}
      <div
        className={`${
          mobileView === "chat" ? "hidden" : "flex"
        } md:flex shrink-0`}
      >
        <ConversationList
          conversations={conversations}
          selectedId={selectedConversation?.id}
          onSelect={handleSelectConversation}
          onCreateNew={() => setShowNewModal(true)}
          currentUserId={user?._id}
        />
      </div>

      {/* Chat Window - Hidden on mobile when viewing list */}
      <div
        className={`${
          mobileView === "list" ? "hidden" : "flex"
        } md:flex flex-1 min-w-0`}
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
          onBack={handleBackToList}
          onToggleDetail={() => setShowDetail(!showDetail)}
          replyToMessage={replyToMessage}
          editingMessage={editingMessage}
          typingUsers={typingUsers}
          isLoadingMessages={isLoadingMessages}
          isSending={isSending || !isAuthenticated}
        />
      </div>

      {/* Detail Panel - Desktop only, toggleable */}
      {showDetail && selectedConversation && (
        <ChatDetailPanel
          conversation={selectedConversation}
          currentUserId={user?._id || user?.id}
          onClose={() => setShowDetail(false)}
        />
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
