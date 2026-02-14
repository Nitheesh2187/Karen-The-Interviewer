import { useState, useRef, useCallback, useEffect } from 'react';

type WebSocketStatus = 'disconnected' | 'connecting' | 'connected';

interface UseWebSocketOptions {
  onMessage?: (data: any) => void;
  onAudioMessage?: (blob: Blob) => void;
  onStatusChange?: (status: WebSocketStatus) => void;
}

export function useWebSocket({ onMessage, onAudioMessage, onStatusChange }: UseWebSocketOptions) {
  const [status, setStatus] = useState<WebSocketStatus>('disconnected');
  const wsRef = useRef<WebSocket | null>(null);

  const updateStatus = useCallback((newStatus: WebSocketStatus) => {
    setStatus(newStatus);
    onStatusChange?.(newStatus);
  }, [onStatusChange]);

  const connect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
    }

    updateStatus('connecting');

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/interview`;

    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('WebSocket connected');
      updateStatus('connected');
    };

    ws.onmessage = (event) => {
      if (typeof event.data === 'string') {
        try {
          const data = JSON.parse(event.data);
          onMessage?.(data);
        } catch (e) {
          console.error('Failed to parse WebSocket message:', e);
        }
      } else if (event.data instanceof Blob) {
        onAudioMessage?.(event.data);
      }
    };

    ws.onclose = (event) => {
      if (wsRef.current === ws) {
        console.log('WebSocket closed:', event.code, event.reason);
        updateStatus('disconnected');
        wsRef.current = null;
      }
    };

    ws.onerror = (error) => {
      if (wsRef.current === ws) {
        console.error('WebSocket error:', error);
      }
    };

    wsRef.current = ws;
  }, [updateStatus, onMessage, onAudioMessage]);

  const sendJson = useCallback((data: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  const sendAudio = useCallback((audioData: ArrayBuffer) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(audioData);
    }
  }, []);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    updateStatus('disconnected');
  }, [updateStatus]);

  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  return { connect, disconnect, sendJson, sendAudio, status };
}
