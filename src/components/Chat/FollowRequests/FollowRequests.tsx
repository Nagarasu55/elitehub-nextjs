"use client";
import { useEffect, useState } from "react";
import { Avatar, Button, List, Typography, Empty, Spin } from "antd";
import {
    CheckOutlined,
    CloseOutlined,
} from "@ant-design/icons";
import axiosInstance from "../../../service/axios";
import type { FollowRequest } from "../../../types/chats";

const { Text } = Typography;

interface Props {
    currentUserId: number;
    onCountChange: (count: number) => void;
}

const FollowRequests = ({ currentUserId, onCountChange }: Props) => {
    const [requests, setRequests] = useState<FollowRequest[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const fetchRequests = async () => {
            setLoading(true);
            try {
                const res = await axiosInstance.get(
                    `/follow/pending/${currentUserId}`
                );


                setRequests(res.data);
                onCountChange(res.data.length);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchRequests();
    }, [currentUserId]);

    const handleAccept = async (followerId: number) => {
        try {
            await axiosInstance.post("/follow/accept", {
                followerId,
                followingId: currentUserId,
            });
            const updated = requests.filter(
                (r) => r.follower_id !== followerId
            );
            setRequests(updated);
            onCountChange(updated.length);
        } catch (err) {
            console.error(err);
        }
    };

    const handleReject = async (followerId: number) => {
        try {
            await axiosInstance.post("/follow/reject", {
                followerId,
                followingId: currentUserId,
            });
            const updated = requests.filter(
                (r) => r.follower_id !== followerId
            );
            setRequests(updated);
            onCountChange(updated.length);
        } catch (err) {
            console.error(err);
        }
    };

    if (loading) {
        return (
            <div style={{ textAlign: "center", padding: 40 }}>
                <Spin />
            </div>
        );
    }

    if (requests.length === 0) {
        return (
            <Empty
                description="No pending requests"
                style={{ padding: 40 }}
            />
        );
    }

    return (
        <List
            dataSource={requests}
            renderItem={(req) => (
                <List.Item
                    style={{ padding: "10px 14px" }}
                    actions={[
                        <Button
                            type="primary"
                            shape="circle"
                            size="small"
                            icon={<CheckOutlined />}
                            onClick={() => handleAccept(req.follower_id)}
                        />,
                        <Button
                            danger
                            shape="circle"
                            size="small"
                            icon={<CloseOutlined />}
                            onClick={() => handleReject(req.follower_id)}
                        />,
                    ]}
                >
                    <List.Item.Meta
                        avatar={
                            <Avatar>
                                {req.username?.slice(0, 2).toUpperCase() ?? "??"}
                            </Avatar>
                        }
                        title={<Text strong>{req.username}</Text>}
                        description={
                            <Text type="secondary" style={{ fontSize: 12 }}>
                                Wants to follow you
                            </Text>
                        }
                    />
                </List.Item>
            )}
        />
    );
};

export default FollowRequests;