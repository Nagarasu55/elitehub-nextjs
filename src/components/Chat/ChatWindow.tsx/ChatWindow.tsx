"use client";

import { useEffect, useRef, useState } from "react";
import {
    Avatar,
    Button,
    Input,
    Typography,
    Spin,
    theme,
    Badge,
    Progress,
    Tooltip,
    message as antMessage,
    Image,
    Space,
} from "antd";
import {
    ArrowLeftOutlined,
    ArrowRightOutlined,
    SendOutlined,
    PaperClipOutlined,
    FileOutlined,
    FilePdfOutlined,
    FileImageOutlined,
    FileZipOutlined,
    FileTextOutlined,
    VideoCameraOutlined,
    AudioOutlined,
    CloseOutlined,
    SettingOutlined,
    SmileOutlined,
} from "@ant-design/icons";
import { useChatStore } from "../../../store/chatStore";
import { getSocket } from "../../../service/socket";
import axiosInstance from "../../../service/axios";
import MessageBubble from "../MessageBubble/MessageBubble";
import type { Message } from "../../../types/chats";
import { getDateLabel } from "../../../utils/datelabel";
import DateDivider from "../DateDivider/DateDivider";
import EditGroupModal from "../EditGroupModel/EditGroupModal";
import styles from "./ChatWindow.module.css";
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react';

const { Text } = Typography;

const MAX_FILES = 20;
const MAX_FILE_SIZE_MB = 15;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

interface Props {
    currentUserId: number;
    onBack: () => void;
    hideSidebar: boolean;
    onlineUsers: number[];
    lastSeenMap: Record<number, string>;
    currentUserName: string;
    onMarkRead: (conversationId: number) => void;
    onUnreadIncrement: (conversationId: number, createdAt: string) => void;
}

interface FilePreview {
    file: File;
    previewUrl?: string;
    name: string;
    size: number;
    mimeType: string;
}

export interface S3FileUrl {
    url: string;
    key: string;
    name: string;
    size: number;
    mimeType: string;
}

const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const isImageMime = (mime: string) => mime.startsWith("image/");
const isVideoMime = (mime: string) => mime.startsWith("video/");
const isAudioMime = (mime: string) => mime.startsWith("audio/");

const FileIcon = ({ mimeType, size = 20 }: { mimeType: string; size?: number }) => {
    const style = { fontSize: size };
    if (isImageMime(mimeType)) return <FileImageOutlined style={style} />;
    if (isVideoMime(mimeType)) return <VideoCameraOutlined style={style} />;
    if (isAudioMime(mimeType)) return <AudioOutlined style={style} />;
    if (mimeType === "application/pdf") return <FilePdfOutlined style={style} />;
    if (mimeType.includes("zip") || mimeType.includes("rar") || mimeType.includes("7z"))
        return <FileZipOutlined style={style} />;
    if (mimeType.startsWith("text/")) return <FileTextOutlined style={style} />;
    return <FileOutlined style={style} />;
};

const ChatWindow = ({
    currentUserId,
    onBack,
    hideSidebar,
    onlineUsers,
    lastSeenMap,
    currentUserName,
    onUnreadIncrement,
    onMarkRead
}: Props) => {

    const activeConversation = useChatStore(state => state.activeConversation);
    const messages = useChatStore(state => state.messages);
    const setConversations = useChatStore(state => state.setConversations);
    const setMessages = useChatStore(state => state.setMessages);
    const addMessage = useChatStore(state => state.addMessage);
    const deleteMessageForMe = useChatStore(state => state.deleteMessageForMe);
    const deleteMessageForEveryone = useChatStore(state => state.deleteMessageForEveryone);
    const editMessage = useChatStore(state => state.editMessage);
    const updateMessageRead = useChatStore(state => state.updateMessageRead);
    const updateMessageDelivered = useChatStore(state => state.updateMessageDelivered);
    const updateConversationToTop = useChatStore(state => state.updateConversationToTop);

    const [text, setText] = useState("");
    const [loading, setLoading] = useState(false);
    const [sending, setSending] = useState(false);
    const [editGroupOpen, setEditGroupOpen] = useState(false);
    const [selectionMode, setSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);

    const [filePreviews, setFilePreviews] = useState<FilePreview[]>([]);
    const [uploadProgress, setUploadProgress] = useState<number>(0);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [lightboxOpen, setLightboxOpen] = useState(false);
    const [lightboxIndex, setLightboxIndex] = useState(0);
    const [lightboxImages, setLightboxImages] = useState<S3FileUrl[]>([]);

    const bottomRef = useRef<HTMLDivElement>(null);
    const socket = getSocket();
    const { token } = theme.useToken();

    const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isTypingRef = useRef(false);
    const [typingUsers, setTypingUsers] = useState<string[]>([]);
    const activeConversationRef = useRef(activeConversation);
    const onUnreadIncrementRef = useRef(onUnreadIncrement);
    const messageListRef = useRef<HTMLDivElement>(null);
    const emojiPickerRef = useRef<HTMLDivElement>(null);

    const isNearBottom = () => {
        const el = messageListRef.current;
        if (!el) return true;
        return el.scrollHeight - el.scrollTop - el.clientHeight < 150;
    };

    const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
        setTimeout(() => {
            bottomRef.current?.scrollIntoView({ behavior });
        }, 50);
    };

    useEffect(() => { activeConversationRef.current = activeConversation; }, [activeConversation]);
    useEffect(() => { onUnreadIncrementRef.current = onUnreadIncrement; }, [onUnreadIncrement]);

    useEffect(() => {
        if (!loading) scrollToBottom("instant");
    }, [loading]);

    useEffect(() => {
        if (!loading && isNearBottom()) scrollToBottom("smooth");
    }, [messages, typingUsers.length]);
    // ── Active conversation change ──────────────────────────────────────────
    useEffect(() => {
        if (!activeConversation) return;
        setLoading(true);
        setTypingUsers([]);
        setText("");
        setFilePreviews([]);
        isTypingRef.current = false;
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

        onMarkRead(activeConversation.id);

        axiosInstance
            .get(`/messages/${activeConversation.id}?userId=${currentUserId}`)
            .then((res) => setMessages(res.data))
            .catch(console.error)
            .finally(() => setLoading(false));

        socket.emit("join", activeConversation.id);
        socket.emit("mark_delivered", { conversationId: activeConversation.id, userId: currentUserId });
        socket.emit("mark_read", { conversationId: activeConversation.id, userId: currentUserId });

        return () => { socket.emit("leave", activeConversation.id); };
    }, [activeConversation?.id]);

    // ── Listeners ──────────────────────────────────────────────────────────
    useEffect(() => {
        const handleTyping = ({ conversationId, username }: { conversationId: number; userId: number; username: string }) => {
            if (Number(conversationId) !== Number(activeConversationRef.current?.id)) return;
            setTypingUsers((prev) => prev.includes(username) ? prev : [...prev, username]);
        };
        const handleStopTyping = ({ conversationId, username }: { conversationId: number; userId: number; username: string }) => {
            if (Number(conversationId) !== Number(activeConversationRef.current?.id)) return;
            setTypingUsers((prev) => prev.filter((u) => u !== username));
        };
        const handleDelivered = ({ messageId, conversationId }: { messageId: number; conversationId: number }) => {
            if (Number(conversationId) === Number(activeConversationRef.current?.id)) updateMessageDelivered(messageId);
        };
        const handleRead = ({ messageId, conversationId }: { messageId: number; conversationId: number }) => {
            if (Number(conversationId) === Number(activeConversationRef.current?.id)) updateMessageRead(messageId);
        };
        socket.on("messages_deleted", ({ messageIds, type }) => {
            const current = useChatStore.getState().messages;
            setMessages(current.map(msg => {
                if (!messageIds.includes(msg.id)) return msg;
                if (type === "for_everyone") return { ...msg, is_deleted_for_everyone: true };
                if (type === "for_me") return { ...msg, is_deleted_for_me: true };
                return msg;
            }));
        });
        const handleMessageDeletedForMe = ({ messageId }: { messageId: number }) => deleteMessageForMe(messageId);
        const handleMessageDeletedForEveryone = ({ messageId }: { messageId: number }) => deleteMessageForEveryone(messageId);
        const handleMessageEdited = ({ messageId, newBody }: { messageId: number; newBody: string }) => editMessage(messageId, newBody);

        socket.on("message_deleted_for_me", handleMessageDeletedForMe);
        socket.on("message_deleted_for_everyone", handleMessageDeletedForEveryone);
        socket.on("message_edited", handleMessageEdited);
        socket.on("user_typing", handleTyping);
        socket.on("user_stop_typing", handleStopTyping);
        socket.on("message_delivered", handleDelivered);
        socket.on("message_read", handleRead);

        return () => {
            socket.off("user_typing", handleTyping);
            socket.off("user_stop_typing", handleStopTyping);
            socket.off("message_deleted_for_me", handleMessageDeletedForMe);
            socket.off("message_deleted_for_everyone", handleMessageDeletedForEveryone);
            socket.off("message_edited", handleMessageEdited);
            socket.off("message_delivered", handleDelivered);
            socket.off("message_read", handleRead);
            socket.off("messages_deleted");
        };
    }, []);

    // ── Derived ────────────────────────────────────────────────────────────
    const otherMember =
        activeConversation?.type !== "group"
            ? activeConversation?.members.find((m) => m.id !== currentUserId)
            : null;

    const conversationName =
        activeConversation?.type === "group"
            ? activeConversation.name
            : otherMember?.username;

    const isOnline = otherMember ? onlineUsers.includes(otherMember.id) : false;

    const formatLastSeen = (userId: number): string => {
        const timestamp = lastSeenMap[userId];
        if (!timestamp) return "Offline";
        const lastSeen = new Date(timestamp);
        const now = new Date();
        const diffMins = Math.floor((now.getTime() - lastSeen.getTime()) / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);
        if (diffMins < 1) return "Just now";
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays === 1) return "Yesterday";
        return lastSeen.toLocaleDateString();
    };

    const statusText =
        activeConversation?.type === "group"
            ? `${activeConversation.members.length} members`
            : isOnline
                ? "Online"
                : otherMember
                    ? formatLastSeen(otherMember.id)
                    : "Offline";



    // ── Receive message ────────────────────────────────────────────────────
    useEffect(() => {
        const handleMessage = (msg: Message) => {
            const activeId = activeConversationRef.current?.id;
            if (Number(msg.conversation_id) !== Number(activeId)) {

                return;
            }
            addMessage(msg);
            updateConversationToTop(msg.conversation_id, msg.created_at);
            socket.emit("mark_delivered", { conversationId: msg.conversation_id, userId: currentUserId });
            socket.emit("mark_read", { conversationId: msg.conversation_id, userId: currentUserId });
            // Check if message has images
            const fileUrls = typeof msg.file_urls === "string"
                ? JSON.parse(msg.file_urls)
                : (msg.file_urls ?? []);
            const hasImages = fileUrls.some((f: { mimeType: string }) => f.mimeType?.startsWith("image/"));

            // If no images, scroll immediately
            // If has images, onMediaLoad in MessageBubble will handle scroll
            if (!hasImages) {
                setTimeout(() => scrollToBottom("smooth"), 50);
            }
        };
        socket.on("receive_message", handleMessage);
        return () => { socket.off("receive_message", handleMessage); };
    }, []);

    useEffect(() => {
        if (!loading) bottomRef.current?.scrollIntoView({ behavior: "instant" });
    }, [messages, loading, typingUsers.length]);

    // ── File selection ─────────────────────────────────────────────────────
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (!files.length) return;
        const remaining = MAX_FILES - filePreviews.length;
        if (remaining <= 0) { antMessage.warning(`Maximum ${MAX_FILES} files.`); return; }
        const valid: FilePreview[] = [];
        for (const file of files.slice(0, remaining)) {
            if (file.size > MAX_FILE_SIZE_BYTES) { antMessage.error(`"${file.name}" exceeds ${MAX_FILE_SIZE_MB}MB.`); continue; }
            valid.push({ file, previewUrl: isImageMime(file.type) ? URL.createObjectURL(file) : undefined, name: file.name, size: file.size, mimeType: file.type });
        }
        if (files.length > remaining) antMessage.warning(`Only ${remaining} more file(s) can be added.`);
        setFilePreviews((prev) => [...prev, ...valid]);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const removeFilePreview = (index: number) => {
        setFilePreviews((prev) => {
            const updated = [...prev];
            if (updated[index].previewUrl) URL.revokeObjectURL(updated[index].previewUrl!);
            updated.splice(index, 1);
            return updated;
        });
    };

    const uploadFilesToS3 = async (): Promise<S3FileUrl[]> => {
        if (!filePreviews.length) return [];
        const formData = new FormData();
        filePreviews.forEach((fp) => formData.append("files", fp.file));
        setIsUploading(true);
        setUploadProgress(0);
        try {
            const res = await axiosInstance.post(
                `/messages/upload?conversationId=${activeConversation?.id}&senderId=${currentUserId}`,
                formData,
                { headers: { "Content-Type": "multipart/form-data" } }
            );
            return res.data.fileUrls as S3FileUrl[];
        } finally {
            setIsUploading(false);
            setUploadProgress(0);
        }
    };

    // ── Send ───────────────────────────────────────────────────────────────
    const handleSend = async () => {
        const hasText = text.trim().length > 0;
        const hasFiles = filePreviews.length > 0;
        if ((!hasText && !hasFiles) || !activeConversation) return;

        if (isTypingRef.current) {
            isTypingRef.current = false;
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
            socket.emit("stop_typing", { conversationId: activeConversation.id, userId: currentUserId, username: currentUserName });
        }

        setSending(true);
        const sentText = text.trim();
        setText("");

        try {
            let fileUrls: S3FileUrl[] = [];
            if (hasFiles) {
                fileUrls = await uploadFilesToS3();
                filePreviews.forEach((fp) => { if (fp.previewUrl) URL.revokeObjectURL(fp.previewUrl); });
                setFilePreviews([]);
            }
            socket.emit("message", { conversationId: activeConversation.id, senderId: currentUserId, body: sentText, fileUrls });
            setTimeout(() => scrollToBottom("smooth"), 100);
        } catch (err) {
            console.error("Send failed:", err);
            antMessage.error("Failed to send. Please try again.");
            setText(sentText);
            setIsUploading(false);
        } finally {
            setSending(false);
        }
    };

    // ── Typing ─────────────────────────────────────────────────────────────


    const handleMessageOnchange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setText(e.target.value);
        if (!activeConversation) return;
        if (!isTypingRef.current) {
            isTypingRef.current = true;
            socket.emit("typing", { conversationId: activeConversation.id, userId: currentUserId, username: currentUserName });
        }
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
            if (isTypingRef.current) {
                isTypingRef.current = false;
                socket.emit("stop_typing", { conversationId: activeConversation.id, userId: currentUserId, username: currentUserName });
            }
        }, 1500);
    };

    // ── Image groups ───────────────────────────────────────────────────────
    const buildImageGroups = (msgs: Message[]): Map<number, S3FileUrl[]> => {
        const groups = new Map<number, S3FileUrl[]>();
        let currentGroup: { messageIds: number[]; images: S3FileUrl[] } | null = null;
        for (const msg of msgs) {
            const fileUrls: S3FileUrl[] = typeof msg.file_urls === "string" ? JSON.parse(msg.file_urls) : (msg.file_urls ?? []);
            const imageFiles = fileUrls.filter(f => f.mimeType?.startsWith("image/"));
            const hasImagesWithText = imageFiles.length > 0 && !!msg.body?.trim();
            if (imageFiles.length > 0 && !hasImagesWithText) {
                if (!currentGroup) currentGroup = { messageIds: [], images: [] };
                currentGroup.messageIds.push(msg.id);
                currentGroup.images.push(...imageFiles);
            } else {
                currentGroup = null;
                if (hasImagesWithText) groups.set(msg.id, imageFiles);
            }
            if (currentGroup) for (const id of currentGroup.messageIds) groups.set(id, [...currentGroup.images]);
        }
        return groups;
    };

    const imageGroups = buildImageGroups(messages);

    const openLightbox = (groupImages: S3FileUrl[], clickedUrl: string) => {
        const idx = groupImages.findIndex(img => img.url === clickedUrl);
        setLightboxImages(groupImages);
        setLightboxIndex(idx >= 0 ? idx : 0);
        setLightboxOpen(true);
    };

    const handleDeleteForMe = (messageId: number) => socket.emit("delete_message_for_me", { messageId, userId: currentUserId });
    const handleDeleteForEveryone = (messageId: number) => socket.emit("delete_message_for_everyone", { messageId, conversationId: activeConversation?.id });
    const handleEditMessage = (messageId: number, newBody: string) => socket.emit("edit_message", { messageId, conversationId: activeConversation?.id, newBody });

    const enterSelectMode = (messageId: number) => { setSelectionMode(true); setSelectedIds([messageId]); };

    const toggleSelect = (messageId: number) => {
        const msg = messages.find(m => m.id === messageId);
        if (!msg || msg.is_deleted_for_me || msg.is_deleted_for_everyone) return;
        setSelectedIds(prev => prev.includes(messageId) ? prev.filter(id => id !== messageId) : [...prev, messageId]);
    };

    const exitSelectMode = () => { setSelectionMode(false); setSelectedIds([]); };

    const renderMessagesWithDividers = () => {
        let lastDateLabel = "";
        return messages.map((msg) => {
            const label = getDateLabel(msg.created_at);
            const showDivider = label !== lastDateLabel;
            lastDateLabel = label;
            return (
                <div key={msg.id}>
                    {showDivider && <DateDivider label={label} />}
                    <MessageBubble
                        message={msg}
                        isOwn={msg.sender_id === currentUserId}
                        isGroupMessage={activeConversation?.type === "group"}
                        groupImages={imageGroups.get(msg.id) ?? []}
                        onImageClick={openLightbox}
                        onDeleteForMe={handleDeleteForMe}
                        onDeleteForEveryone={handleDeleteForEveryone}
                        onEdit={handleEditMessage}
                        isSelectionMode={selectionMode}
                        isSelected={selectedIds.includes(msg.id)}
                        onSelect={toggleSelect}
                        onEnterSelectMode={enterSelectMode}
                        onMediaLoad={() => {
                            // For received images, always scroll if it's the last message
                            const isLastMessage = msg.id === messages[messages.length - 1]?.id;
                            if (isLastMessage || isNearBottom()) {
                                scrollToBottom("smooth");
                            }
                        }}
                    />
                </div>
            );
        });
    };

    // ── Typing Dots ────────────────────────────────────────────────────────
    const TypingDots = () => (
        <div className={styles.typingDots}>
            {[0, 1, 2].map((i) => (
                <div
                    key={i}
                    className={styles.typingDot}
                    style={{ background: token.colorPrimary }}
                />
            ))}
        </div>
    );

    // ── File Preview Strip ─────────────────────────────────────────────────
    const FilePreviewStrip = () => {
        if (!filePreviews.length && !isUploading) return null;
        return (
            <div
                className={styles.filePreviewStrip}
                style={{
                    borderTop: `1px solid ${token.colorBorderSecondary}`,
                    background: token.colorBgContainer,
                }}
            >
                <Text className={styles.filePreviewCount} style={{ color: token.colorTextSecondary }}>
                    {filePreviews.length} / {MAX_FILES} files selected
                </Text>
                <div className={styles.filePreviewList}>
                    {filePreviews.map((fp, idx) => (
                        <div
                            key={idx}
                            className={styles.filePreviewItem}
                            style={{
                                background: token.colorBgLayout,
                                border: `1px solid ${token.colorBorderSecondary}`,
                                padding: fp.previewUrl ? 0 : "6px 10px",
                            }}
                        >
                            {fp.previewUrl ? (
                                <img src={fp.previewUrl} alt={fp.name} className={styles.filePreviewThumb} />
                            ) : (
                                <>
                                    <FileIcon mimeType={fp.mimeType} />
                                    <div className={styles.filePreviewMeta}>
                                        <Text ellipsis className={styles.filePreviewName}>{fp.name}</Text>
                                        <Text className={styles.filePreviewSize} style={{ color: token.colorTextSecondary }}>
                                            {formatBytes(fp.size)}
                                        </Text>
                                    </div>
                                </>
                            )}
                            <Button
                                type="text"
                                size="small"
                                icon={<CloseOutlined style={{ fontSize: 10 }} />}
                                onClick={() => removeFilePreview(idx)}
                                disabled={isUploading}
                                className={styles.filePreviewRemoveBtn}
                            />
                        </div>
                    ))}
                </div>
                {isUploading && (
                    <Progress
                        percent={uploadProgress}
                        size="small"
                        status="active"
                        format={(p) => `Uploading ${p}%`}
                    />
                )}
            </div>
        );
    };

    // ── Bulk delete ────────────────────────────────────────────────────────
    const handleBulkDelete = async (type: "for_me" | "for_everyone") => {
        try {
            await axiosInstance.delete(`/messages/bulk-delete`, {
                data: { messageIds: selectedIds, userId: currentUserId, type },
            });
            const current = useChatStore.getState().messages;
            setMessages(current.map(msg => {
                if (!selectedIds.includes(msg.id)) return msg;
                if (type === "for_everyone") return { ...msg, is_deleted_for_everyone: true };
                if (type === "for_me") return { ...msg, is_deleted_for_me: true };
                return msg;
            }));
            exitSelectMode();
        } catch (err) {
            console.error(err);
        }
    };

    const handleEmojiSelect = (emojiData: EmojiClickData) => {
        setText(prev => prev + emojiData.emoji);
    };

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target as Node)) {
                setShowEmojiPicker(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // ── Render ─────────────────────────────────────────────────────────────
    return (
        <div className={styles.container}>

            {/* Header */}
            <div
                className={styles.header}
                style={{
                    borderBottom: `1px solid ${token.colorBorderSecondary}`,
                    background: token.colorBgContainer,
                }}
            >
                <Button
                    type="text"
                    icon={hideSidebar ? <ArrowRightOutlined /> : <ArrowLeftOutlined />}
                    onClick={onBack}
                    style={{ display: "flex" }}
                />
                <Badge
                    dot
                    offset={[-2, 32]}
                    styles={{
                        indicator: {
                            width: 10,
                            height: 10,
                            backgroundColor:
                                activeConversation?.type === "group"
                                    ? "transparent"
                                    : isOnline ? "#52c41a" : "#d9d9d9",
                            boxShadow: "0 0 0 2px #fff",
                        },
                    }}
                >
                    <Avatar style={{ background: token.colorPrimary }}>
                        {conversationName?.slice(0, 2).toUpperCase()}
                    </Avatar>
                </Badge>
                <div className={styles.headerInfo}>
                    <Text strong className={styles.headerName}>{conversationName}</Text>
                    <Text
                        className={styles.headerStatus}
                        style={{
                            color:
                                isOnline && activeConversation?.type !== "group"
                                    ? "#52c41a"
                                    : token.colorTextSecondary,
                        }}
                    >
                        {statusText}
                    </Text>
                </div>
                {activeConversation?.type === "group" && (
                    <Button
                        type="text"
                        icon={<SettingOutlined />}
                        onClick={() => setEditGroupOpen(true)}
                        className={styles.headerSettingsBtn}
                    />
                )}
            </div>

            {/* Message list */}
            <div className={styles.messageList} ref={messageListRef}>
                {loading
                    ? <div className={styles.loadingWrapper}><Spin /></div>
                    : renderMessagesWithDividers()
                }
                <div ref={bottomRef} />
            </div>

            {/* Typing indicator */}
            <div
                className={styles.typingBar}
                style={{
                    maxHeight: typingUsers.length > 0 ? "48px" : "0px",
                    opacity: typingUsers.length > 0 ? 1 : 0,
                    transition: "max-height 0.3s cubic-bezier(0.4,0,0.2,1), opacity 0.25s ease",
                    padding: typingUsers.length > 0 ? "6px 16px" : "0 16px",
                    background: token.colorBgContainer,
                    borderTop: typingUsers.length > 0
                        ? `1px solid ${token.colorBorderSecondary}`
                        : "1px solid transparent",
                }}
            >
                <TypingDots />
                <Text className={styles.typingText} style={{ color: token.colorTextSecondary }}>
                    {typingUsers.join(", ")} {typingUsers.length === 1 ? "is" : "are"} typing...
                </Text>
            </div>

            {/* File preview strip */}
            <FilePreviewStrip />

            {/* Input bar */}
            <div
                className={styles.inputBar}
                style={{
                    borderTop: `1px solid ${token.colorBorderSecondary}`,
                    background: token.colorBgContainer,
                }}
            >
                <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="*/*"
                    style={{ display: "none" }}
                    onChange={handleFileSelect}
                />
                <Tooltip
                    title={
                        filePreviews.length >= MAX_FILES
                            ? `Maximum ${MAX_FILES} files reached`
                            : `Attach files (max ${MAX_FILES}, ${MAX_FILE_SIZE_MB}MB each)`
                    }
                >
                    <Button
                        type="text"
                        icon={<PaperClipOutlined />}
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading || filePreviews.length >= MAX_FILES}
                        style={{ flexShrink: 0 }}
                    />
                </Tooltip>

                <div ref={emojiPickerRef} style={{ position: 'relative' }}>
                    <Tooltip title="Emoji">
                        <Button
                            type="text"
                            icon={<SmileOutlined />}
                            onClick={() => setShowEmojiPicker(prev => !prev)}
                            disabled={isUploading}
                            style={{ flexShrink: 0 }}
                        />
                    </Tooltip>
                    {showEmojiPicker && (
                        <div
                            style={{
                                position: 'fixed',
                                bottom: 70,
                                left: '50%',
                                transform: 'translateX(-50%)',
                                zIndex: 1000,
                                width: `min(350px, calc(100vw - 24px))`,
                            }}
                        >
                            <EmojiPicker
                                onEmojiClick={handleEmojiSelect}
                                skinTonesDisabled
                                searchDisabled={false}
                                height={400}
                                width="100%"   // ← fill the wrapper div
                            />
                        </div>
                    )}
                </div>

                {/* <Input
                    value={text}
                    onChange={handleMessageOnchange}
                    onPressEnter={handleSend}
                    placeholder="Type a message..."
                    className={styles.messageInput}
                    disabled={isUploading}
                /> */}

                <Input.TextArea
                    value={text}
                    onChange={handleMessageOnchange as any}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSend();
                        }
                    }}
                    placeholder="Type a message..."
                    className={styles.messageInput}
                    disabled={isUploading}
                    autoSize={{ minRows: 1, maxRows: 5 }}
                    style={{ resize: 'none' }}
                />
                <Button
                    type="primary"
                    icon={<SendOutlined />}
                    onClick={handleSend}
                    loading={sending || isUploading}
                    disabled={!text.trim() && !filePreviews.length}
                />
            </div>

            {/* Edit group modal */}
            {activeConversation?.type === "group" && (
                <EditGroupModal
                    open={editGroupOpen}
                    onClose={() => setEditGroupOpen(false)}
                    conversation={activeConversation}
                    currentUserId={currentUserId}
                    onUpdate={() => {
                        axiosInstance
                            .get(`/conversations/${currentUserId}`)
                            .then((res) => setConversations(res.data))
                            .catch(console.error);
                    }}
                />
            )}

            {/* Lightbox */}
            <div style={{ display: "none" }}>
                <Image.PreviewGroup
                    preview={{
                        open: lightboxOpen,
                        current: lightboxIndex,
                        onOpenChange: v => setLightboxOpen(v),
                        onChange: current => setLightboxIndex(current),
                    }}
                >
                    {lightboxImages.map((img, i) => <Image key={i} src={img.url} />)}
                </Image.PreviewGroup>
            </div>

            {/* Selection toolbar */}
            {selectionMode && (
                <div
                    className={styles.selectionToolbar}
                    style={{
                        background: token.colorBgContainer,
                        borderTop: `1px solid ${token.colorBorderSecondary}`,
                    }}
                >
                    <Button onClick={exitSelectMode}>Cancel</Button>
                    <Text>{selectedIds.length} selected</Text>
                    <Space className={styles.selectionActions}>
                        <Button
                            danger
                            disabled={selectedIds.length === 0}
                            onClick={() => handleBulkDelete("for_me")}
                        >
                            Delete for me
                        </Button>
                        {selectedIds.every(id => messages.find(m => m.id === id)?.sender_id === currentUserId) && (
                            <Button
                                danger
                                type="primary"
                                disabled={selectedIds.length === 0}
                                onClick={() => handleBulkDelete("for_everyone")}
                            >
                                Delete for everyone
                            </Button>
                        )}
                    </Space>
                </div>
            )}
        </div>
    );
};

export default ChatWindow;