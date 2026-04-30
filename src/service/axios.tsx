import axios, { AxiosError } from "axios";

const axiosInstance = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_BASE_URL,
    timeout: 10000,
    headers: {
        "Content-Type": "application/json",
    }
})

axiosInstance.interceptors.request.use((config) => {
    const token = localStorage.getItem("token");
    if(token){
        config.headers.Authorization = `Bearer ${token}`
    }
    return config;
})

axiosInstance.interceptors.response.use(
    (response) => response,
    (error: AxiosError) => {
        // if(error.response?.status === 401){
        //     localStorage.removeItem("token"),
        //     window.location.href = "/login"
        // }
        return Promise.reject(error)
    }
)


export default axiosInstance;