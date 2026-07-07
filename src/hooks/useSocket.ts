import { useSocket as useSocketContext } from '@/contexts/SocketContext';
import { useEffect } from 'react';

export const useSocket = (sportName?: string, onUpdate?: (data: any) => void, eventType: string = 'availability_changed') => {
  const { socket, isConnected } = useSocketContext();

  useEffect(() => {
    if (socket && isConnected && sportName) {
      socket.emit('join_sport', sportName);

      if (onUpdate) {
        const wrappedUpdate = (data: any) => {
          onUpdate(data);
        };
        socket.on(eventType, wrappedUpdate);
        return () => {
          socket.off(eventType, wrappedUpdate);
        };
      }
    }
  }, [socket, isConnected, sportName, onUpdate, eventType]);

  return { socket, isConnected };
};
