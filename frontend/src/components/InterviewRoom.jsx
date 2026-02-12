import { useState, useEffect, useCallback, useRef } from 'react'
import { useWebSocket } from '../hooks/useWebSocket'
import { useAudioRecorder } from '../hooks/useAudioRecorder'
import AudioControls from './AudioControls'
import Transcript from './Transcript'

/*
  InterviewRoom — the main interview screen.

  This component orchestrates everything:
  1. Connects WebSocket to backend
  2. Sends setup data to start the interview
  3. Captures mic audio → sends to backend (STT)
  4. Receives agent responses (text + audio)
  5. Plays agent audio through speakers
  6. Displays live transcript
  7. Handles "End Interview" → receives feedback

  Audio playback flow:
  - Backend sends binary audio (PCM16 at 24kHz) over WebSocket
  - We create a WAV blob (adding a WAV header to the raw PCM)
  - Create an Audio element and play it
  - When audio finishes playing, user can speak again
*/
function InterviewRoom({ setupData, onEnd }) {
  const [messages, setMessages] = useState([])
  const [interimText, setInterimText] = useState('')
  const [statusMessage, setStatusMessage] = useState('Connecting...')
  const [isProcessing, setIsProcessing] = useState(false)
  const [isAgentSpeaking, setIsAgentSpeaking] = useState(false)
  const audioQueueRef = useRef([])
  const isPlayingRef = useRef(false)

  // --- Audio Playback ---
  // Converts raw PCM16 bytes into a playable WAV file
  const createWavBlob = useCallback((pcmData) => {
    const numChannels = 1
    const sampleRate = 24000 // TTS outputs at 24kHz
    const bitsPerSample = 16
    const byteRate = sampleRate * numChannels * (bitsPerSample / 8)
    const blockAlign = numChannels * (bitsPerSample / 8)
    const dataSize = pcmData.byteLength

    // WAV file = 44-byte header + raw audio data
    // The header tells audio players: "this is PCM, mono, 24kHz, 16-bit"
    const buffer = new ArrayBuffer(44 + dataSize)
    const view = new DataView(buffer)

    // Helper to write ASCII strings into the buffer
    const writeString = (offset, str) => {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i))
      }
    }

    // WAV header format (RIFF standard)
    writeString(0, 'RIFF')                          // File type
    view.setUint32(4, 36 + dataSize, true)           // File size minus 8 bytes
    writeString(8, 'WAVE')                           // Format
    writeString(12, 'fmt ')                          // Subchunk1 ID
    view.setUint32(16, 16, true)                     // Subchunk1 size (16 for PCM)
    view.setUint16(20, 1, true)                      // Audio format (1 = PCM)
    view.setUint16(22, numChannels, true)            // Number of channels
    view.setUint32(24, sampleRate, true)             // Sample rate
    view.setUint32(28, byteRate, true)               // Byte rate
    view.setUint16(32, blockAlign, true)             // Block align
    view.setUint16(34, bitsPerSample, true)          // Bits per sample
    writeString(36, 'data')                          // Subchunk2 ID
    view.setUint32(40, dataSize, true)               // Subchunk2 size

    // Copy PCM audio data after the header
    new Uint8Array(buffer, 44).set(new Uint8Array(pcmData))

    return new Blob([buffer], { type: 'audio/wav' })
  }, [])

  // Play audio blobs in sequence (queue-based to handle multiple chunks)
  const playNextAudio = useCallback(() => {
    if (audioQueueRef.current.length === 0) {
      isPlayingRef.current = false
      setIsAgentSpeaking(false)
      return
    }

    isPlayingRef.current = true
    setIsAgentSpeaking(true)
    const blob = audioQueueRef.current.shift()
    const url = URL.createObjectURL(blob)
    const audio = new Audio(url)

    audio.onended = () => {
      URL.revokeObjectURL(url) // Free memory
      playNextAudio() // Play next in queue (or stop)
    }

    audio.onerror = (e) => {
      console.error('Audio playback error:', e)
      URL.revokeObjectURL(url)
      playNextAudio()
    }

    audio.play().catch(e => {
      console.error('Audio play failed:', e)
      playNextAudio()
    })
  }, [])

  const queueAudio = useCallback((blob) => {
    audioQueueRef.current.push(blob)
    if (!isPlayingRef.current) {
      playNextAudio()
    }
  }, [playNextAudio])

  // --- WebSocket Message Handlers ---
  const handleMessage = useCallback((data) => {
    switch (data.type) {
      case 'transcript':
        if (data.is_final) {
          // Final transcript — add to messages and clear interim
          setMessages(prev => [...prev, { role: 'user', content: data.text }])
          setInterimText('')
        } else {
          // Interim transcript — show as "typing" indicator
          setInterimText(data.text)
        }
        break

      case 'agent_response':
        setMessages(prev => [...prev, { role: 'assistant', content: data.text }])
        setIsProcessing(false)
        setStatusMessage(`Question ${data.question_number}`)
        break

      case 'feedback':
        onEnd(data.data)
        break

      case 'status':
        setStatusMessage(data.message)
        if (data.message === 'Thinking...') {
          setIsProcessing(true)
        }
        break

      case 'error':
        setStatusMessage(`Error: ${data.message}`)
        setIsProcessing(false)
        break
    }
  }, [onEnd])

  const handleAudioMessage = useCallback((blob) => {
    blob.arrayBuffer().then(buffer => {
      const wavBlob = createWavBlob(buffer)
      queueAudio(wavBlob)
    })
  }, [createWavBlob, queueAudio])

  // --- WebSocket Connection ---
  const { connect, disconnect, sendJson, sendAudio, status: wsStatus } = useWebSocket({
    onMessage: handleMessage,
    onAudioMessage: handleAudioMessage,
  })

  // --- Audio Recording ---
  const { isRecording, permissionDenied, startRecording, stopRecording } = useAudioRecorder({
    onAudioChunk: sendAudio,
  })

  // Connect WebSocket and send setup when component mounts
  useEffect(() => {
    connect()
    return () => disconnect()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Send setup data once WebSocket is connected
  const setupSentRef = useRef(false)
  useEffect(() => {
    if (wsStatus === 'connected' && setupData && !setupSentRef.current) {
      setupSentRef.current = true
      sendJson({
        type: 'setup',
        ...setupData,
      })
    }
  }, [wsStatus, setupData, sendJson])

  // Toggle microphone
  const handleMicToggle = () => {
    if (isRecording) {
      stopRecording()
    } else {
      startRecording()
    }
  }

  // End interview
  const handleEndInterview = () => {
    stopRecording()
    sendJson({ type: 'end_interview' })
    setStatusMessage('Generating feedback...')
  }

  return (
    <div className="interview-room">
      <div className="interview-header">
        <div className="connection-status">
          <span className={`status-dot ${wsStatus}`} />
          <span>{wsStatus === 'connected' ? statusMessage : 'Connecting...'}</span>
        </div>
        <button className="btn-danger" onClick={handleEndInterview}>
          End Interview
        </button>
      </div>

      <Transcript messages={messages} interimText={interimText} />

      <AudioControls
        isRecording={isRecording}
        isProcessing={isProcessing || isAgentSpeaking}
        permissionDenied={permissionDenied}
        onToggle={handleMicToggle}
        disabled={wsStatus !== 'connected'}
      />
    </div>
  )
}

export default InterviewRoom
