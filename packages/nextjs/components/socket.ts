import { Socket, io } from "socket.io-client";

// "undefined" means the URL will be computed from the `window.location` object
// const URL = process.env.NODE_ENV === "production" ? undefined : "http://localhost:3001";
const URL = "http://localhost:4000";

// export const socket = io(URL);
let socket: Socket;

export async function socketInitializer() {
  // ping the server to setup a socket if not already running
  await fetch(URL);
  socket = io(URL, { path: "/api/socket/", transports: ["websocket"] });

  // Standard socket management
  socket.on("connect", () => {
    console.log("Connected to the server");
  });

  socket.on("disconnect", () => {
    console.log("Disconnected from the server");
  });

  socket.on("connect_error", error => {
    console.log("Connection error:", error);
  });

  socket.on("reconnect", attemptNumber => {
    console.log("Reconnected to the server. Attempt:", attemptNumber);
  });

  socket.on("reconnect_error", error => {
    console.log("Reconnection error:", error);
  });

  socket.on("reconnect_failed", () => {
    console.log("Failed to reconnect to the server");
  });

  socket.on("setAccount", data => {
    console.log(`n-🔴 => socket.on => "setAccount":`, "setAccount", data);
  });
}
export { socket };
