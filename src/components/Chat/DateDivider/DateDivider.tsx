"use client";

import { Typography, theme } from "antd";
import styles from "./DateDivider.module.css";

const { Text } = Typography;

const DateDivider = ({ label }: { label: string }) => {
    const { token } = theme.useToken();

    const dynamicLineStyle = {
        background: token.colorBorderSecondary,
    };

    const dynamicLabelStyle = {
        color: token.colorTextSecondary,
        background: token.colorBgLayout,
        border: `1px solid ${token.colorBorderSecondary}`,
    };

    return (
        <div className={styles.container}>
            <div className={styles.line} style={dynamicLineStyle} />
            <Text className={styles.label} style={dynamicLabelStyle}>
                {label}
            </Text>
            <div className={styles.line} style={dynamicLineStyle} />
        </div>
    );
};

export default DateDivider;