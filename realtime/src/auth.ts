import jwt from "jsonwebtoken";
import type { Socket } from "socket.io";

export interface SocketUser {
  id: string;
  role: "ADMIN" | "PROCTOR" | "STUDENT";
  name: string;
}

declare module "socket.io" {
  interface Socket {
    user?: SocketUser;
  }
}

export function socketAuthMiddleware(socket: Socket, next: (err?: Error) => void) {
  const secret = process.env.SOCKET_JWT_SECRET;
  const token = socket.handshake.auth?.token as string | undefined;

  if (!secret || !token) {
    next(new Error("Unauthorized: missing token"));
    return;
  }

  try {
    const payload = jwt.verify(token, secret) as { sub: string; role: string; name: string };
    socket.user = { id: payload.sub, role: payload.role as SocketUser["role"], name: payload.name };
    next();
  } catch {
    next(new Error("Unauthorized: invalid token"));
  }
}
