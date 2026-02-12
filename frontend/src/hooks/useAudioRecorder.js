import { useState, useRef, useCallback } from 'react'

/*
  useAudioRecorder — captures microphone audio and streams it as PCM16 chunks.

  How browser audio capture works:
  1. navigator.mediaDevices.getUserMedia() — asks user for mic permission, returns a MediaStream
  2. AudioContext + ScriptProcessorNode — processes raw audio samples in real-time
  3. We convert Float32 samples → Int16 (PCM16) which is what Deepgram expects
  4. Each chunk is sent via the onAudioChunk callback (which sends it over WebSocket)

  Why not MediaRecorder?
  MediaRecorder outputs compressed formats (WebM/opus). Deepgram's streaming API
  works best with raw PCM (linear16) audio. Using AudioContext gives us raw samples.
*/
export function useAudioRecorder({ onAudioChunk }) {
  const [isRecording, setIsRecording] = useState(false)
  const [permissionDenied, setPermissionDenied] = useState(false)
  const streamRef = useRef(null)
  const audioContextRef = useRef(null)
  const processorRef = useRef(null)

  const startRecording = useCallback(async () => {
    try {
      // Step 1: Request microphone access
      // The browser shows a permission popup the first time
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,       // Deepgram expects 16kHz
          channelCount: 1,          // Mono audio (one channel)
          echoCancellation: true,   // Reduce echo from speakers
          noiseSuppression: true,   // Reduce background noise
        },
      })
      streamRef.current = stream

      // Step 2: Create an AudioContext to process the raw audio
      // AudioContext is the Web Audio API's main object — it represents
      // an audio processing graph
      const audioContext = new AudioContext({ sampleRate: 16000 })
      audioContextRef.current = audioContext

      // Step 3: Create a source node from the mic stream
      const source = audioContext.createMediaStreamSource(stream)

      // Step 4: Create a ScriptProcessor to get raw audio samples
      // bufferSize=4096 means we get chunks of 4096 samples (~256ms at 16kHz)
      const processor = audioContext.createScriptProcessor(4096, 1, 1)
      processorRef.current = processor

      // Step 5: Process each audio chunk
      processor.onaudioprocess = (event) => {
        // event.inputBuffer contains Float32 samples (-1.0 to 1.0)
        const float32Data = event.inputBuffer.getChannelData(0)

        // Convert Float32 → Int16 (PCM16)
        // Deepgram expects linear16 encoding = signed 16-bit integers
        const int16Data = new Int16Array(float32Data.length)
        for (let i = 0; i < float32Data.length; i++) {
          // Clamp to [-1, 1] then scale to Int16 range [-32768, 32767]
          const s = Math.max(-1, Math.min(1, float32Data[i]))
          int16Data[i] = s < 0 ? s * 0x8000 : s * 0x7FFF
        }

        // Send the raw bytes to the callback (which sends them over WebSocket)
        onAudioChunk?.(int16Data.buffer)
      }

      // Step 6: Connect the audio graph: mic → processor → destination
      // (destination is needed to keep the graph alive, even though we don't play audio)
      source.connect(processor)
      processor.connect(audioContext.destination)

      setIsRecording(true)
      setPermissionDenied(false)
    } catch (error) {
      console.error('Failed to start recording:', error)
      if (error.name === 'NotAllowedError') {
        setPermissionDenied(true)
      }
    }
  }, [onAudioChunk])

  const stopRecording = useCallback(() => {
    // Clean up all audio resources
    if (processorRef.current) {
      processorRef.current.disconnect()
      processorRef.current = null
    }
    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }
    if (streamRef.current) {
      // Stop all tracks to release the microphone
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    setIsRecording(false)
  }, [])

  return { isRecording, permissionDenied, startRecording, stopRecording }
}
