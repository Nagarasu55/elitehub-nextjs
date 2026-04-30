"use client";

import { useEffect, useState } from "react";
import {
    Modal, Input, Button, Avatar, Typography,
    message, Divider, Tag, Select
} from "antd";
import { UserDeleteOutlined, LogoutOutlined, CrownOutlined } from "@ant-design/icons";
import axiosInstance from "../../../service/axios";
import type { Conversation } from "../../../types/chats";
import styles from "./EditGroupModal.module.css";

const { Text } = Typography;

interface Member {
    id: number;
    username: string;
    firstname?: string;
    role: "admin" | "member";
}

interface Friend {
    id: number;
    username: string;
    firstname?: string;
}

interface Props {
    open: boolean;
    onClose: () => void;
    conversation: Conversation;
    currentUserId: number;
    onUpdate: () => void;
}

const EditGroupModal = ({ open, onClose, conversation, currentUserId, onUpdate }: Props) => {
    const [members, setMembers] = useState<Member[]>([]);
    const [friends, setFriends] = useState<Friend[]>([]);
    const [groupName, setGroupName] = useState(conversation.name ?? "");
    const [selectedNewMembers, setSelectedNewMembers] = useState<number[]>([]);
    const [loading, setLoading] = useState(false);

    const isAdmin = members.find((m) => m.id === currentUserId)?.role === "admin";

    useEffect(() => {
        if (!open) return;
        setGroupName(conversation.name ?? "");
        fetchMembers();
        fetchFriends();
    }, [open]);

    const fetchMembers = async () => {
        try {
            const res = await axiosInstance.get(`/conversations/${conversation.id}/members`);
            setMembers(res.data);
        } catch (err) {
            console.error(err);
        }
    };

    const fetchFriends = async () => {
        try {
            const res = await axiosInstance.get(`/follow/friends/${currentUserId}`);
            setFriends(res.data);
        } catch (err) {
            console.error(err);
        }
    };

    const handleSaveName = async () => {
        if (!groupName.trim()) return message.warning("Name cannot be empty");
        setLoading(true);
        try {
            await axiosInstance.put(`/conversations/${conversation.id}/name`, {
                name: groupName.trim(),
                userId: currentUserId,
            });
            message.success("Group name updated");
            onUpdate();
        } catch (err) {
            message.error("Failed to update name");
        } finally {
            setLoading(false);
        }
    };

    const handleRemoveMember = async (memberId: number) => {
        try {
            await axiosInstance.delete(
                `/conversations/${conversation.id}/members/${memberId}`,
                { data: { requesterId: currentUserId } }
            );
            message.success("Member removed");
            fetchMembers();
            onUpdate();
        } catch (err) {
            message.error("Failed to remove member");
        }
    };

    const handleAddMembers = async () => {
        if (selectedNewMembers.length === 0) return;
        try {
            await axiosInstance.post(`/conversations/${conversation.id}/members`, {
                userIds: selectedNewMembers,
                requesterId: currentUserId,
            });
            message.success("Members added");
            setSelectedNewMembers([]);
            fetchMembers();
            onUpdate();
        } catch (err) {
            message.error("Failed to add members");
        }
    };

    const handleLeave = async () => {
        try {
            await axiosInstance.delete(`/conversations/${conversation.id}/leave`, {
                data: { userId: currentUserId },
            });
            message.success("Left the group");
            onUpdate();
            onClose();
        } catch (err) {
            message.error("Failed to leave group");
        }
    };

    const availableFriends = friends.filter(
        (f) => !members.find((m) => m.id === f.id)
    );

    return (
        <Modal
            title="Edit Group"
            open={open}
            onCancel={onClose}
            footer={null}
            width={460}
        >
            <div className={styles.body}>

                {/* ── Group Name ── */}
                {isAdmin && (
                    <div>
                        <Text strong className={styles.sectionLabel}>
                            Group Name
                        </Text>
                        <div className={styles.nameRow}>
                            <Input
                                value={groupName}
                                onChange={(e) => setGroupName(e.target.value)}
                                maxLength={50}
                                showCount
                            />
                            <Button
                                type="primary"
                                onClick={handleSaveName}
                                loading={loading}
                                disabled={groupName.trim() === conversation.name}
                            >
                                Save
                            </Button>
                        </div>
                    </div>
                )}

                <Divider className={styles.divider} />

                {/* ── Members List ── */}
                <div>
                    <Text strong className={styles.membersLabel}>
                        Members ({members.length})
                    </Text>
                    <div className={styles.membersList}>
                        {members.map((member) => (
                            <div key={member.id} className={styles.memberItem}>
                                <div className={styles.memberLeft}>
                                    <Avatar style={{ background: "#6C63FF" }}>
                                        {member.username.slice(0, 2).toUpperCase()}
                                    </Avatar>
                                    <div>
                                        <Text strong className={styles.memberName}>
                                            {member.username}
                                            {member.id === currentUserId && (
                                                <Text type="secondary" className={styles.memberYou}>
                                                    (you)
                                                </Text>
                                            )}
                                        </Text>
                                        {member.role === "admin" && (
                                            <Tag
                                                icon={<CrownOutlined />}
                                                color="gold"
                                                className={styles.adminTag}
                                            >
                                                Admin
                                            </Tag>
                                        )}
                                    </div>
                                </div>

                                {isAdmin && member.id !== currentUserId && (
                                    <Button
                                        type="text"
                                        danger
                                        size="small"
                                        icon={<UserDeleteOutlined />}
                                        onClick={() => handleRemoveMember(member.id)}
                                    >
                                        Remove
                                    </Button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* ── Add Members (admin only) ── */}
                {isAdmin && availableFriends.length > 0 && (
                    <>
                        <Divider className={styles.divider} />
                        <div>
                            <Text strong className={styles.sectionLabel}>
                                Add Members
                            </Text>
                            <div className={styles.addMembersRow}>
                                <Select
                                    mode="multiple"
                                    className={styles.addMembersSelect}
                                    placeholder="Select friends to add"
                                    value={selectedNewMembers}
                                    onChange={setSelectedNewMembers}
                                    options={availableFriends.map((f) => ({
                                        value: f.id,
                                        label: f.username,
                                    }))}
                                />
                                <Button
                                    type="primary"
                                    onClick={handleAddMembers}
                                    disabled={selectedNewMembers.length === 0}
                                >
                                    Add
                                </Button>
                            </div>
                        </div>
                    </>
                )}

                <Divider className={styles.divider} />

                {/* ── Leave Group ── */}
                <Button
                    danger
                    icon={<LogoutOutlined />}
                    onClick={handleLeave}
                    className={styles.leaveBtn}
                >
                    Leave Group
                </Button>

            </div>
        </Modal>
    );
};

export default EditGroupModal;