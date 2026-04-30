import { io, Socket } from "socket.io-client";

let socket: Socket;

export const getSocket = (): Socket => {
    if (!socket) {
         console.log("🔌 socket created");
        socket = io(process.env.NEXT_PUBLIC_API_BASE_URL);
    }
    return socket;
};