"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
    Input,
    List,
    Avatar,
    Button,
    Modal,
    Typography,
    Space,
    Spin,
    message,
} from "antd";
import {
    UserAddOutlined,
    MessageOutlined,
    SearchOutlined,
} from "@ant-design/icons";
import axiosInstance from "../../../service/axios";
import { useChatStore } from "../../../store/chatStore";

const { Text } = Typography;

interface SearchedUser {
    id: number;
    username: string;
    firstname: string;
    lastname: string;
}

interface Props {
    currentUserId: number;
}

const SearchUsers = ({ currentUserId }: Props) => {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<SearchedUser[]>([]);
    const [loading, setLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState<number | null>(null);
    const [followStatus, setFollowStatus] = useState<Record<number, "none" | "requested" | "following">>({});
    const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);



    const setConversations = useChatStore(state => state.setConversations);
    const conversations = useChatStore(state => state.conversations);
    const setActiveConversation = useChatStore(state => state.setActiveConversation);

    // Search users

    const handleSearch = useCallback((value: string) => {
        setQuery(value);

        if (!value.trim()) {
            setResults([]);
            return;
        }

        // Clear previous timer on every keystroke
        if (debounceTimer.current) {
            clearTimeout(debounceTimer.current);
        }

        // Only fire after user stops typing for 500ms
        debounceTimer.current = setTimeout(async () => {
            setLoading(true);
            try {
                const res = await axiosInstance.get(`/search?q=${value}`);
                const filtered = res.data.filter((u: SearchedUser) => u.id !== currentUserId);
                setResults(filtered);

                const statusMap: Record<number, "none" | "requested" | "following"> = {};
                await Promise.all(
                    filtered.map(async (user: SearchedUser) => {
                        try {
                            const statusRes = await axiosInstance.get(
                                `/follow/status?followerId=${currentUserId}&followingId=${user.id}`
                            );
                            statusMap[user.id] = statusRes.data.status;
                        } catch {
                            statusMap[user.id] = "none";
                        }
                    })
                );
                setFollowStatus(statusMap);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        }, 700);
    }, [currentUserId]);

    // Cleanup timer on unmount
    useEffect(() => {
        return () => {
            if (debounceTimer.current) clearTimeout(debounceTimer.current);
        };
    }, []);



    // Send follow request
    const handleFollowRequest = async (targetUserId: number) => {
        setActionLoading(targetUserId);
        try {
            await axiosInstance.post("/follow/request", {
                followerId: currentUserId,
                followingId: targetUserId,
            });

            // ✅ Update status to requested
            setFollowStatus((prev) => ({
                ...prev,
                [targetUserId]: "requested",
            }));

            message.success("Follow request sent!");
        } catch (err: any) {
            const errorMsg = err.response?.data?.message;
            if (errorMsg === "Already requested or following") {
                message.warning("Already sent a request");
            } else {
                message.error("Something went wrong");
            }
        } finally {
            setActionLoading(null);
        }
    };

    const handleCancelRequest = async (targetUserId: number) => {
        setActionLoading(targetUserId);
        try {
            await axiosInstance.post("/follow/cancel", {
                followerId: currentUserId,
                followingId: targetUserId,
            });

            // ✅ Update status back to none
            setFollowStatus((prev) => ({
                ...prev,
                [targetUserId]: "none",
            }));

            message.success("Request cancelled");
        } catch (err) {
            message.error("Something went wrong");
        } finally {
            setActionLoading(null);
        }
    };

    // Start or open DM conversation
    const handleStartConversation = async (targetUserId: number) => {
        setActionLoading(targetUserId);
        try {
            const res = await axiosInstance.post("/conversations", {
                type: "dm",
                members: [currentUserId, targetUserId],
            });

            const conversationId = res.data.conversationId;

            // Check if conversation already in list
            const existing = conversations.find(
                (c) => c.id === conversationId
            );

            if (existing) {
                setActiveConversation(existing);
            } else {
                // Refetch conversations to get updated list
                const convRes = await axiosInstance.get(
                    `/conversations/${currentUserId}`
                );
                setConversations(convRes.data);

                const newConv = convRes.data.find(
                    (c: any) => c.id === conversationId
                );
                if (newConv) setActiveConversation(newConv);
            }

            setOpen(false);
        } catch (err: any) {
            const errorMsg = err.response?.data?.message;
            if (errorMsg === "Mutual follow required") {
                message.warning(
                    "You need to follow each other before messaging"
                );
            } else {
                message.error("Something went wrong");
            }
        } finally {
            setActionLoading(null);
        }
    };

    const handleClose = () => {
        setOpen(false);
        setQuery("");
        setResults([]);
    };


    // Helper to render follow button based on status
    const renderFollowButton = (user: SearchedUser) => {
        const status = followStatus[user.id] ?? "none";

        if (status === "requested") {
            return (
                <Button
                    size="small"
                    danger
                    loading={actionLoading === user.id}
                    onClick={() => handleCancelRequest(user.id)}
                >
                    Requested · Cancel
                </Button>
            );
        }

        if (status === "following") {
            return (
                <Button
                    size="small"
                    disabled
                    style={{ color: "#52c41a", borderColor: "#52c41a" }}
                >
                    Following
                </Button>
            );
        }

        return (
            <Button
                icon={<UserAddOutlined />}
                size="small"
                loading={actionLoading === user.id}
                onClick={() => handleFollowRequest(user.id)}
            >
                Follow
            </Button>
        );
    };

    return (
        <>
            {/* Search trigger button */}
            <Button
                type="primary"
                icon={<SearchOutlined />}
                onClick={() => setOpen(true)}
                style={{ width: "100%" }}
            >
                Find people
            </Button>

            {/* Search modal */}
            <Modal
                title="Find people"
                open={open}
                onCancel={handleClose}
                footer={null}
                width={480}
            >
                <Input
                    placeholder="Search by username or name..."
                    prefix={<SearchOutlined />}
                    value={query}
                    onChange={(e) => handleSearch(e.target.value)}
                    autoFocus
                    size="large"
                    style={{ marginBottom: 16 }}
                />

                {loading && (
                    <div style={{ textAlign: "center", padding: 20 }}>
                        <Spin />
                    </div>
                )}

                {!loading && results.length === 0 && query && (
                    <Text type="secondary">No users found for "{query}"</Text>
                )}

                <List
                    dataSource={results}
                    renderItem={(user) => (
                        <List.Item
                            actions={[
                                <Space>
                                    {renderFollowButton(user)}

                                    <Button
                                        type="primary"
                                        icon={<MessageOutlined />}
                                        size="small"
                                        loading={actionLoading === user.id}
                                        onClick={() =>
                                            handleStartConversation(user.id)
                                        }
                                    >
                                        Message
                                    </Button>
                                </Space>,
                            ]}
                        >
                            <List.Item.Meta
                                avatar={
                                    <Avatar>
                                        {user.username
                                            .slice(0, 2)
                                            .toUpperCase()}
                                    </Avatar>
                                }
                                title={
                                    <Text strong>{user.username}</Text>
                                }
                                description={
                                    <Text type="secondary">
                                        {user.firstname} {user.lastname}
                                    </Text>
                                }
                            />
                        </List.Item>
                    )}
                />
            </Modal>
        </>
    );
};

export default SearchUsers;