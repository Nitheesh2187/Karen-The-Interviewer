import { useState, useRef, useCallback, useEffect } from 'react'

/*
  useWebSocket — manages a WebSocket connection to the backend.

  Why a custom hook?
  - Encapsulates connection lifecycle (connect/disconnect/reconnect)
  - Handles both text (JSON) and binary (audio) messages
  - Exposes a clean API to components: { sendJson, sendAudio, status }

  How WebSocket messages work in our app:
  - OUTGOING text (JSON):  { type: "setup", ... } or { type: "end_interview" }
  - OUTGOING binary:       raw audio bytes from the microphone
  - INCOMING text (JSON):  { type: "transcript"|"agent_response"|"feedback"|"status"|"error", ... }
  - INCOMING binary:       audio bytes from TTS (the agent's voice)
*/
export function useWebSocket({ onMessage, onAudioMessage, onStatusChange }) {
  const [status, setStatus] = useState('disconnected') // "disconnected" | "connecting" | "connected"
  const wsRef = useRef(null)
  const reconnectTimeout = useRef(null)

  const updateStatus = useCallback((newStatus) => {
    setStatus(newStatus)
    onStatusChange?.(newStatus)
  }, [onStatusChange])

  const connect = useCallback(() => {
    // Close existing connection if any
    if (wsRef.current) {
      wsRef.current.close()
    }

    updateStatus('connecting')

    // Build WebSocket URL
    // In dev, Vite proxy handles "/ws/..." → backend
    // In production, you'd use the actual backend URL
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${protocol}//${window.location.host}/ws/interview`

    const ws = new WebSocket(wsUrl)

    ws.onopen = () => {
      console.log('WebSocket connected')
      updateStatus('connected')
    }

    ws.onmessage = (event) => {
      if (typeof event.data === 'string') {
        // JSON text message from backend
        try {
          const data = JSON.parse(event.data)
          onMessage?.(data)
        } catch (e) {
          console.error('Failed to parse WebSocket message:', e)
        }
      } else if (event.data instanceof Blob) {
        // Binary audio data from TTS
        onAudioMessage?.(event.data)
      }
    }

    ws.onclose = (event) => {
      // Only log if this is still the active WebSocket (not a StrictMode cleanup)
      if (wsRef.current === ws) {
        console.log('WebSocket closed:', event.code, event.reason)
        updateStatus('disconnected')
        wsRef.current = null
      }
    }

    ws.onerror = (error) => {
      // Suppress errors from connections closed by StrictMode cleanup
      if (wsRef.current === ws) {
        console.error('WebSocket error:', error)
      }
    }

    wsRef.current = ws
  }, [updateStatus, onMessage, onAudioMessage])

  // Send a JSON message (for control messages like setup, end_interview)
  const sendJson = useCallback((data) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data))
    }
  }, [])

  // Send binary audio data (mic chunks)
  const sendAudio = useCallback((audioData) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(audioData)
    }
  }, [])

  // Disconnect manually
  const disconnect = useCallback(() => {
    if (reconnectTimeout.current) {
      clearTimeout(reconnectTimeout.current)
    }
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    updateStatus('disconnected')
  }, [updateStatus])

  // Clean up on unmount (when the component using this hook is removed)
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close()
      }
    }
  }, [])

  return { connect, disconnect, sendJson, sendAudio, status }
}
