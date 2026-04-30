"use client";

import { Avatar, Typography, theme, Badge } from "antd";
import type { Conversation } from "../../../types/chats";
import { useChatStore } from "../../../store/chatStore";
import styles from "./ChatListItem.module.css";

const { Text } = Typography;

interface Props {
    conversation: Conversation;
    currentUserId: number;
    onClick: () => void;
    onlineUsers?: number[];
    lastSeenMap?: Record<number, string>;
    unreadCount?: number;
}

const ChatListItem = ({
    conversation,
    currentUserId,
    onClick,
    onlineUsers = [],
    lastSeenMap = {},
    unreadCount,
}: Props) => {
    const activeConversation = useChatStore(state => state.activeConversation);

    const { token } = theme.useToken();

    const otherMember =
        conversation.type !== "group"
            ? conversation.members.find((m) => m.id !== currentUserId)
            : null;

    const name =
        conversation.type === "group"
            ? conversation.name
            : otherMember?.username;

    const isActive = activeConversation?.id === conversation.id;
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
        if (diffDays === 1) return "last seen Yesterday";
        return `last seen on ${lastSeen.toLocaleDateString()}`;
    };

    const statusText =
        conversation.type === "group"
            ? `${conversation.members.length} members`
            : isOnline
                ? "Online"
                : otherMember
                    ? formatLastSeen(otherMember.id)
                    : "Offline";

    // ✅ Better approach for dynamic token-based styles:
    // Compute them as a plain object once, apply via style prop only where needed.
    // Static structure lives in CSS; only token-dependent values stay inline.
    const dynamicItemStyle = {
        background: isActive ? token.colorPrimaryBg : "transparent",
        borderLeftColor: isActive ? token.colorPrimary : "transparent",
    };

    const dynamicStatusStyle = {
        color:
            isOnline && conversation.type !== "group"
                ? "#52c41a"
                : token.colorTextSecondary,
    };

    const dynamicAvatarStyle = {
        background: token.colorPrimary,
        flexShrink: 0 as const,
    };

    return (
        <div
            onClick={onClick}
            className={styles.item}
            style={dynamicItemStyle}
        >
            {/* Avatar with online dot */}
            <Badge
                dot
                offset={[-2, 30]}
                styles={{
                    indicator: {
                        width: 10,
                        height: 10,
                        backgroundColor:
                            conversation.type === "group"
                                ? "transparent"
                                : isOnline
                                    ? "#52c41a"
                                    : "#d9d9d9",
                        boxShadow:
                            conversation.type === "group" ? "none" : "0 0 0 2px #fff",
                    },
                }}
            >
                <Avatar style={dynamicAvatarStyle}>
                    {name?.slice(0, 2).toUpperCase()}
                </Avatar>
            </Badge>

            {/* Info */}
            <div className={styles.info}>
                <div className={styles.row}>
                    <Text strong className={styles.name}>
                        {name}
                    </Text>

                    {/* Unread badge */}
                    {unreadCount && unreadCount > 0 ? (
                        <span className={styles.unreadBadge}>
                            {unreadCount > 99 ? "99+" : unreadCount}
                        </span>
                    ) : null}
                </div>

                <Text className={styles.status} style={dynamicStatusStyle}>
                    {statusText}
                </Text>
            </div>
        </div>
    );
};

export default ChatListItem;