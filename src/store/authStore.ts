import { create } from "zustand";
import { persist } from "zustand/middleware";

interface User {
    id: number;
    firstname: string;
    lastname: string;
    username: string;
    mobile: string;
}

interface AuthStore {
    user: User | null;
    setUser: (user: User) => void;
    clearUser: () => void;
}

export const useAuthStore = create<AuthStore>()(
    persist(
        (set) => ({
            user: null,
            setUser: (user) => set({ user }),
            clearUser: () => set({ user: null }),
        }),
        {
            name: "auth-storage",
        }
    )
);