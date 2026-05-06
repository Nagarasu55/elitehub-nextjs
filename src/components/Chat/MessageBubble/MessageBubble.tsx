"use client";
import { Typography, theme, Modal, Tooltip, Input, Dropdown, Checkbox } from "antd";
import { useState } from "react";
import {
    FileOutlined, FilePdfOutlined, FileImageOutlined,
    FileZipOutlined, FileTextOutlined, VideoCameraOutlined,
    AudioOutlined, DownloadOutlined, EyeOutlined,
    FileWordOutlined, FileExcelOutlined, FilePptOutlined,
    DeleteOutlined, EditOutlined, CheckOutlined, CloseOutlined,
    CheckSquareOutlined,
} from "@ant-design/icons";
import type { Message } from "../../../types/chats";
import type { S3FileUrl } from "../ChatWindow.tsx/ChatWindow";
import type { MenuProps } from "antd";
import styles from "./MessageBubble.module.css";
import axiosInstance from "../../../service/axios"; // adjust path


const { Text } = Typography;

// ─── Types ────────────────────────────────────────────────────────────────────
interface Props {
    message: Message;
    isOwn: boolean;
    isGroupMessage: boolean;
    groupImages: S3FileUrl[];
    onImageClick: (groupImages: S3FileUrl[], url: string) => void;
    onDeleteForMe: (messageId: number) => void;
    onDeleteForEveryone: (messageId: number) => void;
    onEdit: (messageId: number, newBody: string) => void;
    isSelected: boolean;
    isSelectionMode: boolean;
    onSelect: (messageId: number) => void;
    onEnterSelectMode: (messageId: number) => void;
    onMediaLoad: () => void;
}

interface DownloadedFile {
    url: string;
    blobUrl: string;
    name: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const FileIcon = ({ mimeType, size = 20 }: { mimeType: string; size?: number }) => {
    const style = { fontSize: size };
    if (mimeType.startsWith("image/")) return <FileImageOutlined style={style} />;
    if (mimeType.startsWith("video/")) return <VideoCameraOutlined style={style} />;
    if (mimeType.startsWith("audio/")) return <AudioOutlined style={style} />;
    if (mimeType === "application/pdf") return <FilePdfOutlined style={style} />;
    if (mimeType.includes("wordprocessingml") || mimeType === "application/msword")
        return <FileWordOutlined style={style} />;
    if (mimeType.includes("spreadsheetml") || mimeType === "application/vnd.ms-excel")
        return <FileExcelOutlined style={style} />;
    if (mimeType.includes("presentationml") || mimeType === "application/vnd.ms-powerpoint")
        return <FilePptOutlined style={style} />;
    if (mimeType.includes("zip") || mimeType.includes("rar") || mimeType.includes("7z"))
        return <FileZipOutlined style={style} />;
    if (mimeType.startsWith("text/")) return <FileTextOutlined style={style} />;
    return <FileOutlined style={style} />;
};

const getAvatarColor = (text: string) => {
    const colors = ["#f56a00", "#7265e6", "#ffbf00", "#00a2ae", "#87d068", "#1890ff", "#eb2f96", "#fa541c"];
    let hash = 0;
    for (let i = 0; i < text.length; i++) hash = text.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
};

const isEmojiOnly = (text: string): boolean => {
    const emojiRegex = /^[\p{Emoji}\s]+$/u;
    return emojiRegex.test(text.trim()) && text.trim().length > 0;
};

const isOpenWithType = (mimeType: string) =>
    mimeType === "application/pdf" ||
    mimeType.includes("wordprocessingml") ||
    mimeType === "application/msword" ||
    mimeType.includes("spreadsheetml") ||
    mimeType === "application/vnd.ms-excel" ||
    mimeType.includes("presentationml") ||
    mimeType === "application/vnd.ms-powerpoint";

// ─── Component ────────────────────────────────────────────────────────────────
const MessageBubble = ({
    message,
    isOwn,
    isGroupMessage,
    onImageClick,
    groupImages,
    onDeleteForMe,
    onDeleteForEveryone,
    onEdit,
    isSelected,
    isSelectionMode,
    onSelect,
    onEnterSelectMode,
    onMediaLoad
}: Props) => {
    const { token } = theme.useToken();

    const [downloadedFiles, setDownloadedFiles] = useState<Record<string, DownloadedFile>>({});
    const [downloadingKeys, setDownloadingKeys] = useState<Record<string, boolean>>({});
    const [redownloadTarget, setRedownloadTarget] = useState<S3FileUrl | null>(null);
    const [videoModal, setVideoModal] = useState<S3FileUrl | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editText, setEditText] = useState(message.body ?? "");

    // ── Derived ────────────────────────────────────────────────────────────
    const fileUrls: S3FileUrl[] = typeof message.file_urls === "string"
        ? JSON.parse(message.file_urls)
        : (message.file_urls ?? []);

    const hasFiles = fileUrls.length > 0;
    const hasBody = !!message.body?.trim();

    const isDeletedForMe = !!message.is_deleted_for_me;
    const isDeletedForEveryone = !!message.is_deleted_for_everyone;
    const isDeleted = isDeletedForMe || isDeletedForEveryone;

    const time = (() => {
        const raw = message.created_at;
        if (!raw) return "";
        // Add Z to treat as UTC since DB stores IST as UTC
        const normalized = raw.includes("T") ? raw : raw.replace(" ", "T");
        const date = new Date(normalized + "Z");
        if (isNaN(date.getTime())) return "";
        return date.toLocaleTimeString(undefined, {
            hour: "2-digit",
            minute: "2-digit",
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        });
    })();

    // Dynamic values that depend on runtime tokens / props — kept as inline style objects
    const bubbleBg = isDeleted
        ? (isOwn ? "rgba(99,99,132,0.35)" : token.colorBgTextHover)
        : (isOwn ? token.colorPrimary : token.colorBgTextHover);
    const textColor = isOwn ? "#fff" : token.colorText;
    const subtleColor = isOwn ? "rgba(255,255,255,0.65)" : token.colorTextSecondary;

    const isWithin5Mins = (): boolean => {
        const raw = message.created_at;
        if (!raw) return false;
        const normalized = raw.includes("T") ? raw : raw.replace(" ", "T");
        const sent = new Date(normalized + "Z").getTime();
        return Date.now() - sent < 5 * 60 * 1000;
    };

    // ── Context menu ───────────────────────────────────────────────────────
    const menuItems: MenuProps["items"] = [
        {
            key: "select",
            label: "Select",
            icon: <CheckSquareOutlined />,
            disabled: isDeleted,
            onClick: () => !isDeleted && onEnterSelectMode(message.id),
        },
        ...(isOwn && hasBody && !isDeleted && isWithin5Mins()
            ? [{
                key: "edit",
                label: "Edit",
                icon: <EditOutlined />,
                onClick: () => {
                    setEditText(message.body ?? "");
                    setIsEditing(true);
                },
            }]
            : []
        ),
        {
            key: "delete_for_me",
            label: "Delete for me",
            icon: <DeleteOutlined />,
            onClick: () => onDeleteForMe(message.id),
        },
        ...(isOwn && !isDeleted
            ? [{
                key: "delete_for_everyone",
                label: "Delete for everyone",
                icon: <DeleteOutlined />,
                danger: true,
                onClick: () => onDeleteForEveryone(message.id),
            }]
            : []
        ),
    ];

    const handleEditSubmit = () => {
        const trimmed = editText.trim();
        if (!trimmed || trimmed === message.body) {
            setIsEditing(false);
            return;
        }
        onEdit(message.id, trimmed);
        setIsEditing(false);
    };

    const getIncrementedFileName = (originalName: string): string => {
        const dotIndex = originalName.lastIndexOf(".");
        const hasExt = dotIndex > 0;
        const base = hasExt ? originalName.slice(0, dotIndex) : originalName;
        const ext = hasExt ? originalName.slice(dotIndex) : "";
        const cleanBase = base.replace(/\s*\(\d+\)$/, "");
        let n = 1;
        while (downloadedFiles[`${cleanBase}(${n})${ext}`]) n++;
        return `${cleanBase}(${n})${ext}`;
    };

    // const fetchAndCache = async (f: S3FileUrl): Promise<string> => {
    //     if (downloadedFiles[f.key]) return downloadedFiles[f.key].blobUrl;
    //     const proxyUrl = `/api/messages/download?url=${encodeURIComponent(f.url)}&name=${encodeURIComponent(f.name)}`;
    //     const res = await fetch(proxyUrl);
    //     const blob = await res.blob();
    //     const blobUrl = URL.createObjectURL(blob);
    //     setDownloadedFiles(prev => ({ ...prev, [f.key]: { url: f.url, blobUrl, name: f.name } }));
    //     return blobUrl;
    // };


    const fetchAndCache = async (f: S3FileUrl): Promise<string> => {
        if (downloadedFiles[f.key]) return downloadedFiles[f.key].blobUrl;

        const response = await axiosInstance.get("/messages/download", {
            params: {
                url: f.url,
                name: f.name,
            },
            responseType: "blob", // ✅ critical — tells axios to handle binary
            timeout: 60000,       // ✅ increase timeout for large files (9MB)
        });

        const blob = new Blob([response.data], {
            type: response.headers["content-type"]?.toString() || "application/octet-stream"
        });

        console.log("blob size:", blob.size);   // should be 9MB
        console.log("blob type:", blob.type);   // should be audio/mpeg

        const blobUrl = URL.createObjectURL(blob);
        setDownloadedFiles(prev => ({
            ...prev,
            [f.key]: { url: f.url, blobUrl, name: f.name }
        }));
        return blobUrl;
    };

    const triggerSaveToDisk = (blobUrl: string, name: string) => {
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    const handleDownload = async (f: S3FileUrl, forceRename = false) => {
        if (downloadedFiles[f.key] && !forceRename) {
            setRedownloadTarget(f);
            return;
        }
        setDownloadingKeys(prev => ({ ...prev, [f.key]: true }));
        try {
            const blobUrl = await fetchAndCache(f);
            triggerSaveToDisk(blobUrl, forceRename ? getIncrementedFileName(f.name) : f.name);
        } catch {
            window.open(f.url, "_blank");
        } finally {
            setDownloadingKeys(prev => ({ ...prev, [f.key]: false }));
        }
    };

    // ── Tick component ─────────────────────────────────────────────────────
    const MessageTicks = ({ isRead, isDelivered, isOwn }: {
        isRead: boolean;
        isDelivered: boolean;
        isOwn: boolean;
    }) => {
        if (!isOwn) return null;

        if (isRead) return (
            <span className={styles.ticks}>
                <svg width="16" height="11" viewBox="0 0 16 11" fill="none">
                    <path d="M1 6L5 10L11 1" stroke="#29e442" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M5 6L9 10L15 1" stroke="#29e442" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            </span>
        );

        if (isDelivered) return (
            <span className={styles.ticks}>
                <svg width="16" height="11" viewBox="0 0 16 11" fill="none">
                    <path d="M1 6L5 10L11 1" stroke="rgba(255,255,255,0.7)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M5 6L9 10L15 1" stroke="rgba(255,255,255,0.7)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            </span>
        );

        return (
            <span className={styles.ticks}>
                <svg width="10" height="11" viewBox="0 0 10 11" fill="none">
                    <path d="M1 6L4 10L9 1" stroke="rgba(255,255,255,0.7)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            </span>
        );
    };

    // ── Render ─────────────────────────────────────────────────────────────
    return (
        <>
            <div
                onClick={() => {
                    if (isSelectionMode && !isDeleted) onSelect(message.id);
                }}
                className={[
                    styles.messageRow,
                    isOwn ? styles.messageRowOwn : styles.messageRowOther,
                    isSelectionMode ? styles.selectionCursor : styles.defaultCursor,
                ].join(" ")}
            >
                {!isDeleted && isSelectionMode && (
                    <Checkbox
                        checked={isSelected}
                        onChange={(e) => {
                            e.stopPropagation();
                            onSelect(message.id);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className={styles.selectionCheckbox}
                    />
                )}

                <Dropdown
                    menu={{ items: menuItems }}
                    trigger={["contextMenu"]}
                    disabled={isDeleted}
                    arrow={true}
                >
                    <div
                        className={[
                            styles.bubble,
                            isOwn ? styles.bubbleOwn : styles.bubbleOther,
                            isDeleted ? styles.bubbleDeleted : "",
                        ].join(" ")}
                        style={{ background: bubbleBg }}
                    >
                        {/* Group sender name */}
                        {isGroupMessage && !isOwn && (
                            <Text
                                className={styles.senderName}
                                style={{ color: getAvatarColor(message.username) }}
                            >
                                @{message.username}
                            </Text>
                        )}

                        {/* ── Deleted placeholder ────────────────────── */}
                        {isDeleted ? (
                            <Text
                                className={styles.deletedText}
                                style={{ color: subtleColor }}
                            >
                                🚫 This message was deleted
                            </Text>
                        ) : (
                            <>
                                {/* ── File attachments ──────────────────── */}
                                {hasFiles && (
                                    <div className={styles.fileList}>
                                        {fileUrls.map((f, i): React.ReactElement | null => {
                                            const isDownloaded = !!downloadedFiles[f.key];
                                            const isDownloading = !!downloadingKeys[f.key];

                                            if (f.mimeType?.startsWith("image/")) {
                                                return (
                                                    <div
                                                        key={i}
                                                        className={styles.imageWrapper}
                                                        onMouseEnter={e => {
                                                            const el = e.currentTarget.querySelector(`.${styles.imageOverlay}`) as HTMLElement;
                                                            if (el) el.style.opacity = "1";
                                                        }}
                                                        onMouseLeave={e => {
                                                            const el = e.currentTarget.querySelector(`.${styles.imageOverlay}`) as HTMLElement;
                                                            if (el) el.style.opacity = "0";
                                                        }}
                                                    >
                                                        <img
                                                            src={f.url}
                                                            alt={f.name}
                                                            className={styles.attachmentImage}
                                                            onLoad={onMediaLoad}
                                                        />
                                                        <div className={styles.imageOverlay}>
                                                            <Tooltip title="View">
                                                                <EyeOutlined
                                                                    className={styles.imageOverlayIcon}
                                                                    onClick={() => onImageClick(groupImages, f.url)}
                                                                />
                                                            </Tooltip>
                                                            <Tooltip title={isDownloaded ? "Downloaded" : "Download"}>
                                                                <DownloadOutlined
                                                                    className={styles.imageOverlayIcon}
                                                                    style={{
                                                                        color: isDownloaded ? "#52c41a" : "#fff",
                                                                        opacity: isDownloading ? 0.5 : 1,
                                                                    }}
                                                                    onClick={() => !isDownloading && handleDownload(f)}
                                                                />
                                                            </Tooltip>
                                                        </div>
                                                    </div>
                                                );
                                            }

                                            if (f.mimeType?.startsWith("video/")) {
                                                return (
                                                    <div
                                                        key={i}
                                                        className={[
                                                            styles.fileRow,
                                                            isOwn ? styles.fileRowOwn : styles.fileRowOther,
                                                        ].join(" ")}
                                                    >
                                                        <VideoCameraOutlined style={{ fontSize: 20, color: textColor, flexShrink: 0 }} />
                                                        <div className={styles.fileMeta}>
                                                            <Text
                                                                ellipsis
                                                                className={styles.fileName}
                                                                style={{ color: textColor }}
                                                            >
                                                                {f.name}
                                                            </Text>
                                                            <Text
                                                                className={styles.fileSize}
                                                                style={{ color: subtleColor }}
                                                            >
                                                                {formatBytes(f.size)}
                                                            </Text>
                                                        </div>
                                                        <div className={styles.fileActions}>
                                                            <Tooltip title="View">
                                                                <EyeOutlined
                                                                    style={{ fontSize: 16, color: textColor, cursor: "pointer" }}
                                                                    onClick={() => setVideoModal(f)}
                                                                />
                                                            </Tooltip>
                                                            <Tooltip title={isDownloaded ? "Downloaded" : "Download"}>
                                                                <DownloadOutlined
                                                                    className={[
                                                                        styles.downloadIcon,
                                                                        isDownloading ? styles.downloadIconDisabled : styles.downloadIconAllowed,
                                                                    ].join(" ")}
                                                                    style={{
                                                                        color: isDownloaded ? "#52c41a" : textColor,
                                                                        opacity: isDownloading ? 0.5 : 1,
                                                                    }}
                                                                    onClick={() => !isDownloading && handleDownload(f)}
                                                                />
                                                            </Tooltip>
                                                        </div>
                                                    </div>
                                                );
                                            }

                                            if (f.mimeType?.startsWith("audio/")) {
                                                return (
                                                    <div key={i} className={styles.audioWrapper}>
                                                        <audio controls className={styles.audioElement} preload="metadata">
                                                            <source src={f.url} type={f.mimeType} />
                                                        </audio>
                                                        <div className={styles.audioFooter}>
                                                            <Text
                                                                className={styles.audioName}
                                                                style={{ color: subtleColor }}
                                                            >
                                                                {f.name}
                                                            </Text>
                                                            <Tooltip title={isDownloaded ? "Downloaded" : "Download"}>
                                                                <DownloadOutlined
                                                                    className={[
                                                                        isDownloading
                                                                            ? styles.audioDownloadIconDisabled
                                                                            : styles.audioDownloadIcon,
                                                                    ].join(" ")}
                                                                    style={{
                                                                        color: isDownloaded ? "#52c41a" : subtleColor,
                                                                        opacity: isDownloading ? 0.5 : 1,
                                                                    }}
                                                                    onClick={() => !isDownloading && handleDownload(f)}
                                                                />
                                                            </Tooltip>
                                                        </div>
                                                    </div>
                                                );
                                            }

                                            if (isOpenWithType(f.mimeType) || (f.url && f.name)) {
                                                return (
                                                    <div
                                                        key={i}
                                                        className={[
                                                            styles.fileRow,
                                                            isOwn ? styles.fileRowOwn : styles.fileRowOther,
                                                        ].join(" ")}
                                                    >
                                                        <FileIcon mimeType={f.mimeType} />
                                                        <div className={styles.fileMeta}>
                                                            <Text
                                                                ellipsis
                                                                className={styles.fileName}
                                                                style={{ color: textColor }}
                                                            >
                                                                {f.name}
                                                            </Text>
                                                            <Text
                                                                className={styles.fileSize}
                                                                style={{ color: subtleColor }}
                                                            >
                                                                {formatBytes(f.size)}
                                                            </Text>
                                                        </div>
                                                        <Tooltip title={isDownloaded ? "Downloaded" : isOpenWithType(f.mimeType) ? "Save to disk" : "Download"}>
                                                            <DownloadOutlined
                                                                className={[
                                                                    styles.downloadIcon,
                                                                    isDownloading ? styles.downloadIconDisabled : styles.downloadIconAllowed,
                                                                ].join(" ")}
                                                                style={{
                                                                    color: isDownloaded ? "#52c41a" : textColor,
                                                                    opacity: isDownloading ? 0.5 : 1,
                                                                }}
                                                                onClick={() => !isDownloading && handleDownload(f)}
                                                            />
                                                        </Tooltip>
                                                    </div>
                                                );
                                            }

                                            return null;
                                        })}
                                    </div>
                                )}

                                {/* ── Text body or inline edit ───────────── */}
                                {hasBody && (
                                    isEditing ? (
                                        <div className={styles.editContainer}>
                                            <Input.TextArea
                                                value={editText}
                                                onChange={e => setEditText(e.target.value)}
                                                onPressEnter={e => {
                                                    if (!e.shiftKey) {
                                                        e.preventDefault();
                                                        handleEditSubmit();
                                                    }
                                                }}
                                                autoSize={{ minRows: 1, maxRows: 6 }}
                                                autoFocus
                                                className={styles.editTextarea}
                                                style={{ color: isEditing ? "black" : textColor }}
                                            />
                                            <div className={styles.editActions}>
                                                <Tooltip title="Cancel">
                                                    <CloseOutlined
                                                        className={styles.editCancelIcon}
                                                        style={{ color: subtleColor }}
                                                        onClick={() => setIsEditing(false)}
                                                    />
                                                </Tooltip>
                                                <Tooltip title="Save (Enter)">
                                                    <CheckOutlined
                                                        className={styles.editSaveIcon}
                                                        style={{ color: isOwn ? "#fff" : token.colorSuccess }}
                                                        onClick={handleEditSubmit}
                                                    />
                                                </Tooltip>
                                            </div>
                                        </div>
                                    ) : (
                                        <Text
                                            className={styles.messageText}
                                            style={{
                                                color: textColor,
                                                fontSize: isEmojiOnly(message.body ?? "") ? "30px" : '14px' ,
                                                lineHeight: isEmojiOnly(message.body ?? "") ? "1.2" : undefined,
                                            }}
                                        >
                                            {message.body}
                                            {message.is_edited && (
                                                <Text
                                                    className={styles.editedLabel}
                                                    style={{ color: subtleColor }}
                                                >
                                                    (edited)
                                                </Text>
                                            )}
                                        </Text>
                                    )
                                )}
                            </>
                        )}

                        {/* Timestamp — always visible */}
                        <div className={styles.timestampRow}>
                            <Text
                                className={styles.timestampText}
                                style={{ color: subtleColor }}
                            >
                                {time}
                            </Text>
                            <MessageTicks
                                isOwn={isOwn}
                                isDelivered={message.is_delivered}
                                isRead={message.is_read}
                            />
                        </div>
                    </div>
                </Dropdown>
            </div>

            {/* ── Video modal ────────────────────────────────────────────── */}
            <Modal
                open={!!videoModal}
                onCancel={() => setVideoModal(null)}
                footer={null}
                centered
                title={videoModal?.name}
                width={640}
                destroyOnHidden
            >
                {videoModal && (
                    <video controls className={styles.videoPlayer}>
                        <source src={videoModal.url} type={videoModal.mimeType} />
                    </video>
                )}
            </Modal>

            {/* ── Re-download confirm modal ──────────────────────────────── */}
            <Modal
                open={!!redownloadTarget}
                onCancel={() => setRedownloadTarget(null)}
                title="File already downloaded"
                centered
                footer={null}
            >
                {redownloadTarget && (
                    <div className={styles.redownloadBody}>
                        <Text
                            className={styles.redownloadDescription}
                            style={{ color: token.colorTextSecondary }}
                        >
                            <strong>{redownloadTarget.name}</strong> has already been downloaded. What would you like to do?
                        </Text>
                        <div className={styles.redownloadOptions}>
                            <button
                                className={styles.redownloadButton}
                                style={{
                                    border: `1px solid ${token.colorBorder}`,
                                    background: token.colorBgContainer,
                                    color: token.colorText,
                                }}
                                onClick={() => {
                                    const f = redownloadTarget;
                                    setRedownloadTarget(null);
                                    triggerSaveToDisk(downloadedFiles[f.key].blobUrl, f.name);
                                }}
                            >
                                Replace (download again with same name)
                            </button>
                            <button
                                className={styles.redownloadButton}
                                style={{
                                    border: `1px solid ${token.colorBorder}`,
                                    background: token.colorBgContainer,
                                    color: token.colorText,
                                }}
                                onClick={() => {
                                    const f = redownloadTarget;
                                    setRedownloadTarget(null);
                                    handleDownload(f, true);
                                }}
                            >
                                Save as new file
                            </button>
                            <button
                                className={styles.redownloadButton}
                                style={{
                                    border: `1px solid ${token.colorBorder}`,
                                    background: token.colorBgContainer,
                                    color: token.colorTextSecondary,
                                }}
                                onClick={() => setRedownloadTarget(null)}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}
            </Modal>
        </>
    );
};

export default MessageBubble;