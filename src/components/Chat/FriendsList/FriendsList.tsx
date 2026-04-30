"use client";
import { useEffect, useState } from "react";
import { Avatar, Badge, Button, List, Typography, Empty, Spin, Popconfirm, Space, message } from "antd";
import { MessageOutlined, UserDeleteOutlined } from "@ant-design/icons";
import axiosInstance from "../../../service/axios";
import SearchUsers from "../SearchUser/SearchUser";
import { useChatStore } from "../../../store/chatStore";

const { Text } = Typography;

interface Friend {
    id: number;
    username: string;
}

interface Props {
    currentUserId: number;
    handleTabChange: (tab: string) => void;
    onlineUsers: number[];
    lastSeenMap: Record<number, string>;
}

const FriendsList = ({ currentUserId, handleTabChange, onlineUsers, lastSeenMap }: Props) => {
    const [friends, setFriends] = useState<Friend[]>([]);
    const [loading, setLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState<number | null>(null);
    const setConversations = useChatStore(state => state.setConversations);
    const conversations = useChatStore(state => state.conversations);
    const setActiveConversation = useChatStore(state => state.setActiveConversation);

    useEffect(() => {
        const fetchFriends = async () => {
            setLoading(true);
            try {
                const res = await axiosInstance.get(`/follow/friends/${currentUserId}`);
                setFriends(res.data);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchFriends();
    }, [currentUserId]);

    const handleUnfollow = async (userId: number) => {
        try {
            await axiosInstance.delete(`/follow/unfollow`, {
                data: { followerId: currentUserId, followingId: userId },
            });
            setFriends((prev) => prev.filter((f) => f.id !== userId));
        } catch (err) {
            console.error(err);
        }
    };

    const handleStartConversation = async (targetUserId: number) => {
        setActionLoading(targetUserId);
        try {
            const res = await axiosInstance.post("/conversations", {
                type: "dm",
                members: [currentUserId, targetUserId],
            });

            const conversationId = res.data.conversationId;
            const existing = conversations.find((c) => c.id === conversationId);

            if (existing) {
                setActiveConversation(existing);
            } else {
                const convRes = await axiosInstance.get(`/conversations/${currentUserId}`);
                setConversations(convRes.data);
                const newConv = convRes.data.find((c: any) => c.id === conversationId);
                if (newConv) setActiveConversation(newConv);
            }

            handleTabChange("chats");
        } catch (err: any) {
            const errorMsg = err.response?.data?.message;
            if (errorMsg === "Mutual follow required") {
                message.warning("You need to follow each other before messaging");
            } else {
                message.error("Something went wrong");
            }
        } finally {
            setActionLoading(null);
        }
    };

    const getAvatarColor = (text: string) => {
        const colors = [
            "#f56a00", "#7265e6", "#ffbf00", "#00a2ae",
            "#87d068", "#1890ff", "#eb2f96", "#fa541c",
        ];
        let hash = 0;
        for (let i = 0; i < text.length; i++) {
            hash = text.charCodeAt(i) + ((hash << 5) - hash);
        }
        return colors[Math.abs(hash) % colors.length];
    };

    // ✅ Same formatter as ChatListItem
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

    if (loading) {
        return <div style={{ textAlign: "center", padding: 40 }}><Spin /></div>;
    }

    if (friends.length === 0) {
        return (
            <>
                <div style={{ padding: "8px 12px" }}>
                    <SearchUsers currentUserId={currentUserId} />
                </div>
                <Empty description="No friends yet" style={{ padding: 40 }} />
            </>
        );
    }

    return (
        <>
            <div style={{ padding: "8px 12px" }}>
                <SearchUsers currentUserId={currentUserId} />
            </div>

            <List
                dataSource={friends}
                renderItem={(user) => {
                    const isOnline = onlineUsers.includes(user.id);
                    const statusText = isOnline ? "Online" : formatLastSeen(user.id);

                    return (
                        <List.Item
                            style={{ padding: "10px 14px" }}
                            actions={[
                                <Space>
                                    <Popconfirm
                                        title="Unfollow this user?"
                                        onConfirm={() => handleUnfollow(user.id)}
                                    >
                                        <Button
                                            danger
                                            shape="circle"
                                            size="small"
                                            icon={<UserDeleteOutlined />}
                                        />
                                    </Popconfirm>

                                    <Button
                                        type="primary"
                                        icon={<MessageOutlined />}
                                        size="small"
                                        loading={actionLoading === user.id}
                                        onClick={() => handleStartConversation(user.id)}
                                    >
                                        Message
                                    </Button>
                                </Space>,
                            ]}
                        >
                            <List.Item.Meta
                                avatar={
                                    // ✅ Same Badge style as ChatListItem
                                    <Badge
                                        dot
                                        offset={[-2, 30]}
                                        styles={{
                                            indicator: {
                                                width: 10,
                                                height: 10,
                                                backgroundColor: isOnline ? "#52c41a" : "#d9d9d9",
                                                boxShadow: "0 0 0 2px #fff",
                                            },
                                        }}
                                    >
                                        <Avatar
                                            style={{
                                                backgroundColor: getAvatarColor(user.username),
                                                color: "#fff",
                                            }}
                                        >
                                            {user.username?.slice(0, 2).toUpperCase() ?? "??"}
                                        </Avatar>
                                    </Badge>
                                }
                                title={<Text strong>{user.username}</Text>}
                                description={
                                    // ✅ Same color logic as ChatListItem
                                    <Text
                                        style={{
                                            fontSize: 12,
                                            color: isOnline ? "#52c41a" : undefined,
                                        }}
                                        type={isOnline ? undefined : "secondary"}
                                    >
                                        {statusText}
                                    </Text>
                                }
                            />
                        </List.Item>
                    );
                }}
            />
        </>
    );
};

export default FriendsList;