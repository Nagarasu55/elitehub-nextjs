"use client";

import { useState, useMemo } from "react";
import { Input, Tabs, Badge, Typography, Button, Modal, Form, Checkbox, Avatar, message } from "antd";
import {  UsergroupAddOutlined } from "@ant-design/icons";
import { useChatStore } from "../../../store/chatStore";
import type { Conversation } from "../../../types/chats";
import ChatListItem from "../ChatlistItem/ChatListItem";
import FollowRequests from "../FollowRequests/FollowRequests";
import FriendsList from "../FriendsList/FriendsList";
import axiosInstance from "../../../service/axios";

const { Search } = Input;
const { Text } = Typography;

interface Friend {
    id: number;
    username: string;
    firstname?: string;
}

interface Props {
    currentUserId: number;
    onlineUsers: number[];
    lastSeenMap: Record<number, string>;
    unreadMap: Record<number, number>;   // ✅
    onMarkRead: (id: number) => void;    // ✅
}

const Sidebar = ({ currentUserId, onlineUsers, onMarkRead, lastSeenMap, unreadMap }: Props) => {
    const [activeTab, setActiveTab] = useState(() => {
        return localStorage.getItem("sidebar_active_tab") ?? "chats";
    });

   

    const setConversations = useChatStore(state => state.setConversations);
    const conversations = useChatStore(state => state.conversations);
    const setActiveConversation = useChatStore(state => state.setActiveConversation);
    const [search, setSearch] = useState("");
    const [pendingCount, setPendingCount] = useState(0);

    // Group modal state
    const [groupModalOpen, setGroupModalOpen] = useState(false);
    const [groupName, setGroupName] = useState("");
    const [friends, setFriends] = useState<Friend[]>([]);
    const [selectedMembers, setSelectedMembers] = useState<number[]>([]);
    const [creating, setCreating] = useState(false);
    const [form] = Form.useForm();

    const filtered = useMemo(() =>
        conversations.filter((c) => {
            const name =
                c.type === "group"
                    ? c.name
                    : c.members.find((m) => m.id !== currentUserId)?.username;
            return name?.toLowerCase().includes(search.toLowerCase());
        }),
        [conversations, search, currentUserId]);

        console.log('filtered',filtered)

    const handleSelect = (conversation: Conversation) => {
        setActiveConversation(conversation);
    };

    const handleOpenGroupModal = async () => {
        setGroupModalOpen(true);
        try {
            const res = await axiosInstance.get(`/follow/friends/${currentUserId}`);
            setFriends(res.data);
        } catch (err) {
            console.error(err);
        }
    };

    const toggleMember = (userId: number) => {
        setSelectedMembers((prev) =>
            prev.includes(userId)
                ? prev.filter((id) => id !== userId)
                : [...prev, userId]
        );
    };

    const handleCreateGroup = async () => {
        if (!groupName.trim()) {
            message.warning("Please enter a group name");
            return;
        }
        if (selectedMembers.length < 2) {
            message.warning("Select at least 2 members");
            return;
        }

        setCreating(true);
        try {
            await axiosInstance.post("/conversations", {
                type: "group",
                name: groupName.trim(),
                members: [...selectedMembers, currentUserId],
                createdBy: currentUserId,
            });

            message.success(`Group "${groupName}" created!`);

            const res = await axiosInstance.get(`/conversations/${currentUserId}`);
            setConversations(res.data);

            setGroupModalOpen(false);
            setGroupName("");
            setSelectedMembers([]);
            form.resetFields();

        } catch (err) {
            message.error("Failed to create group");
        } finally {
            setCreating(false);
        }
    };

    const handleCloseModal = () => {
        setGroupModalOpen(false);
        setGroupName("");
        setSelectedMembers([]);
        form.resetFields();
    };

    const handleTabChange = (key: string) => {
        setActiveTab(key);
        localStorage.setItem("sidebar_active_tab", key); // ✅ save on change
    };


    // ✅ Memoized chat list — re-renders when onlineUsers or lastSeenMap changes
    const chatListChildren = useMemo(() => (
        <>
            <div style={{ padding: "8px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
                <Button
                    icon={<UsergroupAddOutlined />}
                    onClick={handleOpenGroupModal}
                    style={{ width: "100%", textAlign: "left" }}
                >
                    New group
                </Button>
                <Search
                    placeholder="Search conversations..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    size="middle"
                />
            </div>

            <div style={{ overflowY: "auto", flex: 1, minHeight: 0 }}>
                {filtered.length === 0 ? (
                    <div style={{ padding: 16, textAlign: "center" }}>
                        <Text type="secondary">No conversations yet</Text>
                    </div>
                ) : (
                    filtered.map((c) => (
                        <ChatListItem
                            key={c.id}
                            conversation={c}
                            currentUserId={currentUserId}
                            onClick={() => {
                                handleSelect(c);
                                onMarkRead(c.id);
                            }}
                            onlineUsers={onlineUsers}
                            lastSeenMap={lastSeenMap}
                            unreadCount={unreadMap[c.id] ?? 0}
                        />
                    ))
                )}
            </div>
        </>
    ), [filtered, onlineUsers, lastSeenMap, search, currentUserId, unreadMap]);

    const tabItems = useMemo(() => [
        {
            key: "chats",
            label: "Chats",
            children: chatListChildren,
        },
        {
            key: "requests",
            label: (
                <Badge count={pendingCount} size="small">
                    <span style={{ paddingRight: 8 }}>Requests</span>
                </Badge>
            ),
            children: (
                <FollowRequests
                    currentUserId={currentUserId}
                    onCountChange={setPendingCount}
                />
            ),
        },
        {
            key: "friends",
            label: (
                <Badge size="small">
                    <span style={{ paddingRight: 8 }}>Friends</span>
                </Badge>
            ),
            children: (
                <FriendsList
                    currentUserId={currentUserId}
                    handleTabChange={handleTabChange}
                    onlineUsers={onlineUsers}
                    lastSeenMap={lastSeenMap}
                />
            ),
        },
    ], [chatListChildren, pendingCount, onlineUsers, lastSeenMap, currentUserId]);

    return (
        <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
            <div style={{ padding: "16px 12px 0" }}>
                <Text strong style={{ fontSize: 18 }}>Messages</Text>
            </div>

            <Tabs
                activeKey={activeTab}
                items={tabItems}
                onChange={(key) => handleTabChange(key)}
                style={{ flex: 1, padding: "0 4px", minHeight: 0 }}  // 👈 add minHeight: 0, overflow: hidden
                tabBarStyle={{ padding: "0 8px", marginBottom: 0 }}
            />

            {/* Create Group Modal */}
            <Modal
                title="Create new group"
                open={groupModalOpen}
                onCancel={handleCloseModal}
                onOk={handleCreateGroup}
                okText="Create group"
                okButtonProps={{ loading: creating, disabled: selectedMembers.length < 2 || !groupName.trim() }}
                width={420}
            >
                <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 16 }}>

                    <div>
                        <Text strong style={{ display: "block", marginBottom: 6 }}>
                            Group name
                        </Text>
                        <Input
                            placeholder="Enter group name..."
                            value={groupName}
                            onChange={(e) => setGroupName(e.target.value)}
                            maxLength={50}
                            showCount
                        />
                    </div>

                    <div>
                        <Text strong style={{ display: "block", marginBottom: 6 }}>
                            Add members
                            <Text type="secondary" style={{ fontSize: 12, fontWeight: 400, marginLeft: 8 }}>
                                ({selectedMembers.length} selected, min 2)
                            </Text>
                        </Text>

                        {friends.length === 0 ? (
                            <Text type="secondary" style={{ fontSize: 13 }}>
                                No friends yet — follow someone first
                            </Text>
                        ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 240, overflowY: "auto" }}>
                                {friends.map((friend) => (
                                    <div
                                        key={friend.id}
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 10,
                                            padding: "8px 10px",
                                            cursor: "pointer",
                                            borderRadius: 8,
                                            background: selectedMembers.includes(friend.id)
                                                ? "#f0f0ff"
                                                : "transparent",
                                            border: selectedMembers.includes(friend.id)
                                                ? "1px solid #6C63FF"
                                                : "1px solid transparent",
                                            transition: "all 0.2s",
                                        }}
                                    >
                                        <Checkbox
                                            checked={selectedMembers.includes(friend.id)}
                                            onChange={(e) => {
                                                e.stopPropagation();
                                                toggleMember(friend.id);
                                            }}
                                        />
                                        <Avatar style={{ background: "#6C63FF", flexShrink: 0 }}>
                                            {friend.username.slice(0, 2).toUpperCase()}
                                        </Avatar>
                                        <div onClick={() => toggleMember(friend.id)}>
                                            <Text strong style={{ fontSize: 13, display: "block" }}>
                                                {friend.username}
                                            </Text>
                                            {friend.firstname && (
                                                <Text type="secondary" style={{ fontSize: 12 }}>
                                                    {friend.firstname}
                                                </Text>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {selectedMembers.length > 0 && (
                        <div>
                            <Text type="secondary" style={{ fontSize: 12, display: "block", marginBottom: 6 }}>
                                Selected:
                            </Text>
                            <Avatar.Group maxCount={6}>
                                {selectedMembers.map((id) => {
                                    const friend = friends.find((f) => f.id === id);
                                    return (
                                        <Avatar key={id} style={{ background: "#6C63FF" }}>
                                            {friend?.username.slice(0, 2).toUpperCase()}
                                        </Avatar>
                                    );
                                })}
                            </Avatar.Group>
                        </div>
                    )}
                </div>
            </Modal>
        </div>
    );
};

export default Sidebar;