'use client';

import { createContext, useContext } from 'react';
import { useWebSocket, type WSMessage, type WSConnectionState, type WSSubscriber } from '@/hooks/useWebSocket';

interface WebSocketContextValue {
  isConnected: boolean;
  connectionState: WSConnectionState;
  lastMessage: WSMessage | null;
  sendMessage: (data: Record<string, unknown>) => void;
  subscribe: (callback: WSSubscriber) => () => void;
}

const WebSocketContext = createContext<WebSocketContextValue | null>(null);

export function useWS() {
  const ctx = useContext(WebSocketContext);
  if (!ctx) throw new Error('useWS must be used within WebSocketProvider');
  return ctx;
}

export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const ws = useWebSocket();

  return (
    <WebSocketContext.Provider value={ws}>
      {children}
    </WebSocketContext.Provider>
  );
}
