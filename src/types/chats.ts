import type { S3FileUrl } from "../components/Chat/ChatWindow.tsx/ChatWindow";

export interface User {
    id: number;
    username: string;
    firstname?: string;
}

export interface Message {
    id: number;
    conversation_id: number;
    sender_id: number;
    body: string | null;
    created_at: string;
    username: string;
    is_read: boolean;
    is_delivered: boolean;
    is_edited: boolean;
    is_deleted_for_me: boolean;
    is_deleted_for_everyone: boolean;
    file_urls: S3FileUrl[] | string | null;
}


export interface Conversation {
    id: number;
    type: "dm" | "group";
    name: string | null;
    created_at: string;
    members: User[];
}

export interface FollowRequest {
    id: number;
    follower_id: number;
    following_id: number;
    status: "pending" | "accepted" | "rejected";
    username?: string;
}