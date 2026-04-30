"use client";
import { Button, Flex, Form, Input, Typography } from "antd";
import styles from "./SignIn.module.css";
import { useRouter } from "next/navigation"
import { useAuthStore } from "../../store/authStore";
import axiosInstance from "../../service/axios";
import type { AxiosError } from "axios";
import { useState } from "react";
import Link from "next/link"



interface User {
    username: string;
    password: string;
}

interface ApiError {
    error: "USER_NOT_FOUND" | "INVALID_PASSWORD" | "Server error";
}


const SignIn = () => {
    const [form] = Form.useForm();
    const { Title } = Typography;
    const router = useRouter();

    const [loading, setLoading] = useState<boolean>(false)

    const { setUser } = useAuthStore();


    const handleLogin = async (values: User): Promise<void> => {
        const { username, password } = values;
        setLoading(true);

        try {
            const response = await axiosInstance.post('/login', { username, password });
            setUser(response.data.user);
            router.push("/chatpage");

        } catch (error) {
            const err = error as AxiosError<ApiError>;
            const errorCode = err.response?.data?.error;

            if (errorCode === "USER_NOT_FOUND") {
                form.setFields([{
                    name: "username",
                    errors: ["User does not exist"]
                }]);
            }
            if (errorCode === "INVALID_PASSWORD") {
                form.setFields([{
                    name: "password",
                    errors: ["Incorrect password"]
                }]);
            }

        } finally {
            setLoading(false);
        }
    };

    return (

        <Flex
            className={styles.container}
            justify="center"
            align="center"
        >
            <div className={styles.form}>
                <Form
                    form={form}
                    layout="vertical"
                    // className={styles.form}
                    onFinish={handleLogin}
                    autoComplete="off"
                >
                    <img src='/assets/elitehub_logo.svg' alt="EliteHub" className={styles.logo} />

                    <Title
                        level={2}
                        className={styles.formTitle}
                    >
                        Log In
                    </Title>
                    <Form.Item
                        label="Username"
                        name="username"
                        rules={[{ required: true, message: "Please enter username" }]}
                    >
                        <Input />
                    </Form.Item>

                    <Form.Item
                        label="Password"
                        name="password"
                        rules={[{ required: true, message: "Please enter password" }]}>
                        <Input.Password />
                    </Form.Item>

                    <Form.Item>
                        <Button type="primary" htmlType="submit" block loading={loading} disabled={loading}>Log In</Button>
                    </Form.Item>


                    <div className={styles.signUpLine}>
                        Don't have an account?
                        <Link href="/signup" className={styles.signUpLink}>Create one</Link>
                    </div>

                    <div style={{ textAlign: 'center', fontSize: '10px' }}>
                        version 1.0.3
                    </div>

                </Form>
            </div>

        </Flex >

    )
}

export default SignIn;




