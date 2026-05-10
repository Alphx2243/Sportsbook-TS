import { useSocket as useSocketContext } from '@/contexts/SocketContext';
import { useEffect } from 'react';

export const useSocket = (sportName?: string, onUpdate?: (data: any) => void, eventType: string = 'availability_changed') => {
  const { socket, isConnected } = useSocketContext();

  useEffect(() => {
    if (socket && isConnected && sportName) {
      console.log(`[SOCKET] Emitting join_sport for: ${sportName}`);
      socket.emit('join_sport', sportName);

      if (onUpdate) {
        const wrappedUpdate = (data: any) => {
          console.log(`[SOCKET] Received ${eventType} for ${sportName}:`, data);
          onUpdate(data);
        };
        socket.on(eventType, wrappedUpdate);
        return () => {
          console.log(`[SOCKET] Cleaning up listener for ${sportName} (${eventType})`);
          socket.off(eventType, wrappedUpdate);
        };
      }
    } else if (!socket) {
      console.warn(`[SOCKET] Socket not initialized for ${sportName}`);
    } else if (!isConnected) {
      console.warn(`[SOCKET] Socket not connected for ${sportName}`);
    }
  }, [socket, isConnected, sportName, onUpdate, eventType]);

  return { socket, isConnected };
};
