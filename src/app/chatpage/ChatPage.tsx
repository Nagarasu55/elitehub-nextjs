'use client';
import { useEffect, useRef, useState } from "react";
import { Avatar, Button, Layout, Popover, theme, Typography } from "antd";
import { useChatStore } from "../../store/chatStore";
import axiosInstance from "../../service/axios";
import Sidebar from "../../components/Chat/Sidebar/Sidebar";
import ChatWindow from "../../components/Chat/ChatWindow.tsx/ChatWindow";
import styles from "./Chatpage.module.css";
import { useAuthStore } from "../../store/authStore";
import { useRouter } from "next/navigation";
import { LogoutOutlined, UserOutlined } from "@ant-design/icons";
import { getSocket } from "../../service/socket";
import { useCallback } from "react";
import Image from "next/image";

const { Sider, Content } = Layout;
const { Text } = Typography;

const ChatPage = () => {

    const activeConversation = useChatStore(state => state.activeConversation);
    const setConversations = useChatStore(state => state.setConversations);
    const resetChat = useChatStore(state => state.resetChat);
    const updateConversationToTop = useChatStore(state => state.updateConversationToTop);
    const setActiveConversation = useChatStore(state => state.setActiveConversation);

    const [hideSidebar, setHideSidebar] = useState(() => {
        if (typeof window === "undefined") return false;
        return localStorage.getItem("hideSidebar") === "true";
    });
    const [unreadMap, setUnreadMap] = useState<Record<number, number>>({});
    const [onlineUsers, setOnlineUsers] = useState<number[]>([]);
    const [lastSeenMap, setLastSeenMap] = useState<Record<number, string>>({});
    const activeConversationRef = useRef(activeConversation);
    const { token } = theme.useToken();
    const { user, clearUser } = useAuthStore();
    const router = useRouter();
    const socket = getSocket();

    console.log("ChatPage render"); // should not log excessively

    const handleLogout = () => {
        clearUser();
        resetChat();
        localStorage.clear();
        socket.emit("user_offline", user!.id);
        router.replace("/");

    };

    const handleHideSidebar = () => {
        setHideSidebar(prev => {
            const newValue = !prev;
            console.log(newValue)
            localStorage.setItem("hideSidebar", String(newValue));
            return newValue;
        });
    };

    useEffect(() => {
        activeConversationRef.current = activeConversation;
    }, [activeConversation]);


    useEffect(() => {
        if (!user?.id) return;
        socket.emit("user_online", user.id);



        // ✅ Fix 1 — convert to numbers when receiving online_users list
        socket.on("online_users", (userIds: number[]) => {
            setOnlineUsers(userIds.map(Number)); // ✅ always numbers
        });

        // ✅ Fix 2 — convert userId to number in status change handler
        socket.on("user_status_changed", ({ userId, isOnline, lastSeen }) => {
            const uid = Number(userId); // ✅ always number
            if (isOnline) {
                setOnlineUsers((prev) => prev.includes(uid) ? prev : [...prev, uid]);
                setLastSeenMap((prev) => {
                    const updated = { ...prev };
                    delete updated[uid];
                    return updated;
                });
            } else {
                setOnlineUsers((prev) => prev.filter((id) => id !== uid));
                setLastSeenMap((prev) => ({
                    ...prev,
                    [uid]: lastSeen ?? new Date().toISOString(),
                }));
            }
        });

        socket.on("new_conversation", ({ conversation, message }) => {
            const { conversations, setConversations } = useChatStore.getState();

            const exists = conversations.some((c) => c.id === conversation.id);
            if (!exists) {
                setConversations([
                    { ...conversation, last_message_at: message.created_at },
                    ...conversations,
                ]);
            }

            // ✅ Set unread count for the new conversation
            if (message.sender_id !== user?.id) {
                if (activeConversationRef.current?.id !== conversation.id) {
                    setUnreadMap((prev) => ({
                        ...prev,
                        [conversation.id]: (prev[conversation.id] ?? 0) + 1,
                    }));
                }
            }
        });

        // ✅ ADD THIS — listen for messages even when ChatWindow is not open
        socket.on("receive_message", (msg) => {
            if (msg.sender_id === user.id) return; // ignore own messages

            const activeId = activeConversationRef.current?.id;

            // Only increment if message is NOT for the currently open chat
            if (Number(msg.conversation_id) !== Number(activeId)) {
                setUnreadMap((prev) => ({
                    ...prev,
                    [msg.conversation_id]: (prev[msg.conversation_id] ?? 0) + 1,
                }));
                updateConversationToTop(msg.conversation_id, msg.created_at);
            }
        });

        return () => {
            socket.off("online_users");
            socket.off("user_status_changed");
            socket.off("new_conversation");
            socket.off("receive_message");

        };
    }, [user?.id]);

    useEffect(() => {
        if (!user?.id) return;

        // ✅ Restore from localStorage on page load
        const saved = localStorage.getItem("activeConversationId");
        if (saved && !activeConversation) {
            // Wait for conversations to load, then find and restore
            const restore = async () => {
                try {
                    const res = await axiosInstance.get(`/conversations/${user?.id}`);
                    const convs = res.data;
                    const found = convs.find((c: any) => c.id === Number(saved));
                    if (found) setActiveConversation(found);
                } catch (err) {
                    console.error(err);
                }
            };
            restore();
        }
    }, [user?.id]);

    const handleUnreadIncrement = useCallback((conversationId: number, createdAt: string) => {
        setUnreadMap((prev) => ({
            ...prev,
            [conversationId]: (prev[conversationId] ?? 0) + 1,
        }));
        updateConversationToTop(conversationId, createdAt);
    }, [updateConversationToTop]);

    // ✅ Save to localStorage whenever active conversation changes
    useEffect(() => {
        if (activeConversation?.id) {
            localStorage.setItem("activeConversationId", String(activeConversation.id));
        }
    }, [activeConversation?.id]);


    // ✅ Fetch conversations + unread counts + last seen
    useEffect(() => {
        if (!user?.id) return;

        const fetchConversations = async () => {
            try {
                const res = await axiosInstance.get(`/conversations/${user?.id}`);
                setConversations(res.data);

                const unreadRes = await axiosInstance.get(`/messages/unread-counts/${user?.id}`);
                setUnreadMap(unreadRes.data);

                const allMemberIds: number[] = [];
                res.data.forEach((conv: any) => {
                    conv.members.forEach((m: any) => {
                        if (m.id !== user?.id) allMemberIds.push(m.id);
                    });
                });

                if (allMemberIds.length > 0) {
                    const lsRes = await axiosInstance.get(`/conversations/last-seen`, {
                        params: { ids: [...new Set(allMemberIds)].join(",") },
                    });
                    setLastSeenMap(lsRes.data);
                }
            } catch (err) {
                console.error(err);
            }
        };
        fetchConversations();
    }, [user?.id]);

    // ✅ Mark messages as read
    const handleMarkRead = async (conversationId: number) => {
        try {
            await axiosInstance.put(`/messages/mark-read/${conversationId}`, {
                userId: user?.id,
            });
            setUnreadMap((prev) => ({ ...prev, [conversationId]: 0 }));
        } catch (err) {
            console.error(err);
        }
    }; // ✅ closes here, not after JSX



    const profileContent = (
        <div style={{ width: 200 }}>
            <div style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 0",
                borderBottom: `1px solid ${token.colorBorderSecondary}`,
                marginBottom: 8,
            }}>
                <Avatar style={{ background: token.colorPrimary, flexShrink: 0 }} size={40}>
                    {user?.firstname?.slice(0, 1).toUpperCase()}
                </Avatar>
                <div>
                    <Text strong style={{ display: "block", fontSize: 13 }}>
                        {user?.firstname} {user?.lastname}
                    </Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                        @{user?.username}
                    </Text>
                </div>
            </div>
            <Button
                type="text"
                danger
                icon={<LogoutOutlined />}
                onClick={handleLogout}
                style={{ width: "100%", textAlign: "left" }}
            >
                Log out
            </Button>
        </div>
    );

    if (!user) return <div>Loading...</div>;

    return (
        <Layout style={{ height: "100vh" }}>
            <div style={{
                height: 52,
                background: token.colorBgContainer,
                borderBottom: `1px solid ${token.colorBorderSecondary}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0 20px",
                flexShrink: 0,
            }}>
                <Image src='/assets/elitehub_logo.svg' alt="EliteHub" width={100} height={40} className={styles.logo} />

                <Popover content={profileContent} trigger="click" placement="bottomRight" arrow={false}>
                    <Avatar style={{ background: token.colorPrimary, cursor: "pointer" }} icon={<UserOutlined />}>
                        {user?.firstname?.slice(0, 1).toUpperCase()}
                    </Avatar>
                </Popover>
            </div>

            <Layout style={{ flex: 1, overflow: "hidden" }}>
                <Sider
                    width={300}
                    style={{
                        background: token.colorBgContainer,
                        borderRight: `1px solid ${token.colorBorderSecondary}`,
                        display: hideSidebar ? "none" : "block",
                        flexDirection: "column",
                        height: "100%",
                        overflow: "hidden"
                    }}
                    collapsedWidth={0}
                >
                    <Sidebar
                        currentUserId={user!.id}
                        onlineUsers={onlineUsers}
                        lastSeenMap={lastSeenMap}
                        unreadMap={unreadMap}
                        onMarkRead={handleMarkRead}
                    />
                </Sider>

                <Content style={{ display: "flex", flexDirection: "column", background: token.colorBgLayout }} className={styles.content}>
                    {activeConversation ? (
                        <ChatWindow
                            currentUserId={user?.id}
                            currentUserName={user?.username}
                            hideSidebar={hideSidebar}
                            onlineUsers={onlineUsers}
                            lastSeenMap={lastSeenMap}
                            onUnreadIncrement={handleUnreadIncrement}
                            onMarkRead={handleMarkRead}
                            onBack={() => {
                                handleHideSidebar();
                            }}
                        />
                    ) : (
                        <div className={styles.placeholder}>
                            <p style={{ color: token.colorTextSecondary }}>
                                Select a conversation to start chatting
                            </p>
                        </div>
                    )}
                </Content>
            </Layout>
        </Layout>
    );
};

export default ChatPage;