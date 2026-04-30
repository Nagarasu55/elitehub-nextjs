"use client";

import { Button, Flex, Form, Input, Typography, Result } from "antd";
import styles from "./SignUp.module.css";
import { useRouter } from "next/navigation"
import { useState } from "react";
import axiosInstance from "../../service/axios";
import type { createUser } from "../../types/types";
import { AxiosError } from "axios";
import { message } from "antd";
import Link from "next/link";

interface ApiError {
    error: "USERNAME_EXISTS" | "MOBILE_EXISTS" | "Server error";
}


const SignUp = () => {
    const [form] = Form.useForm();
    const { Title } = Typography;
    const router = useRouter();
    const [isSuccess, setIsSuccess] = useState(false);

    const handleSignUp = async (values: createUser) => {

        try {

            await axiosInstance.post('/signup', values);
            setIsSuccess(true)
        } catch (error) {

            const err = error as AxiosError<ApiError>;
            const errorCode = err.response?.data?.error;

            if (errorCode === "USERNAME_EXISTS") {
                form.setFields([{ name: "username", errors: ["Username already exists"] }]);
            } else if (errorCode === "MOBILE_EXISTS") {
                form.setFields([{ name: "mobile", errors: ["Mobile already exists"] }]);
            } else {
                message.error("Something went wrong. Please try again.");
            }
        }
    };


    if (isSuccess) {
        return (
            <Result
                status="success"
                title="Account Created Successfully!"
                subTitle="Your account is ready. You can now log in."
                extra={
                    <Button type="primary" onClick={() => router.replace("/")}>
                        Go to Login
                    </Button>
                }
            />
        );
    }

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

                    onFinish={handleSignUp}
                    autoComplete="off"
                >
                    <img src='/assets/elitehub_logo.svg' alt="EliteHub" className={styles.logo} />

                    <Title
                        level={2}
                        className={styles.formTitle}
                    >
                        Create account
                    </Title>

                    <div className={styles.NameInputs}>
                        <Form.Item
                            name="firstname"
                            label="First name"
                            rules={[{ required: true, message: "Required" },
                            {
                                pattern: /^[A-Za-z]+$/,
                                message: "Only letters are allowed",
                            },
                            ]}
                            style={{ marginBottom: 14 }}
                        >
                            <Input placeholder="enter first name" />
                        </Form.Item>
                        <Form.Item
                            name="lastname"
                            label="Last name"
                            rules={[
                                {
                                    pattern: /^[A-Za-z]+$/,
                                    message: "Only letters are allowed",
                                },
                            ]}
                            style={{ marginBottom: 14 }}
                        >
                            <Input placeholder="enter last name" />
                        </Form.Item>
                    </div>

                    <Form.Item
                        label="Username"
                        name="username"
                        rules={[{ required: true, message: "Please enter username" },
                        {
                            pattern: /^[a-zA-Z0-9@]+$/,
                            message:
                                "no spaces or other special characters except @ ",
                        },
                        ]}
                    >
                        <Input placeholder="enter username" />
                    </Form.Item>

                    <Form.Item
                        label="Mobile"
                        name="mobile"
                        rules={[
                            { required: true, message: "Please enter your mobile number" },
                            { pattern: /^\d{10}$/, message: "Please enter a valid 10-digit mobile number" },
                        ]}
                    >
                        <Input placeholder="enter mobile number" />
                    </Form.Item>

                    <Form.Item
                        label="Password"
                        name="password"
                        rules={[{ required: true, message: "Please enter password" },
                        {
                            pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).{8,}$/,
                            message:
                                "Password must be at least 8 characters and include uppercase, lowercase, number and special character",
                        }
                        ]}>
                        <Input.Password placeholder="enter password" />
                    </Form.Item>

                    <Form.Item
                        label="confirmPassword"
                        name="confirmPassword"
                        dependencies={["password"]}
                        rules={[
                            {
                                validator: (_, value) => {
                                    const password = form.getFieldValue("password");

                                    if (!value) {
                                        return Promise.reject("Please enter confirm password");
                                    }

                                    if (value !== password) {
                                        return Promise.reject("Passwords do not match");
                                    }

                                    return Promise.resolve();
                                }
                            }

                        ]}>
                        <Input.Password placeholder="enter confirm password" />
                    </Form.Item>

                    <Form.Item>
                        <Button type="primary" htmlType="submit" block loading={false}>Create account</Button>
                    </Form.Item>

                    <div className={styles.signUpLine}>
                        Already have an account
                        <Link href="/" className={styles.signUpLink}>Sign In</Link>
                    </div>

                </Form>
            </div>
        </Flex >

    )
}

export default SignUp;




