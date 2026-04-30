// src/app/AntdProvider.tsx
"use client";
import { ConfigProvider, theme } from "antd";

export default function AntdProvider({ children }: { children: React.ReactNode }) {
    
    return (
        <ConfigProvider theme={{ algorithm: theme.compactAlgorithm }}>
            {children}
        </ConfigProvider>
    );
}