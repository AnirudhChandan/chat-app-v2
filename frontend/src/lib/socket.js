import { io } from "socket.io-client";

// Connect to backend URL
export const socket = io("http://localhost:5001", {
  autoConnect: false, // We connect manually when user logs in
});
