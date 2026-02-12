/*
  AudioControls — mic toggle button with visual state.

  Shows different states:
  - Not recording: grey mic icon, "Click to speak"
  - Recording: red pulsing mic icon, "Listening..."
  - Processing: spinner, "Agent is thinking..."
  - Permission denied: error message

  The "pulsing" effect is done with CSS animation (see index.css).
*/
function AudioControls({ isRecording, isProcessing, permissionDenied, onToggle, disabled }) {
  return (
    <div className="audio-controls">
      <button
        className={`mic-button ${isRecording ? 'recording' : ''} ${isProcessing ? 'processing' : ''}`}
        onClick={onToggle}
        disabled={disabled || isProcessing}
        title={isRecording ? 'Click to stop' : 'Click to speak'}
      >
        {isProcessing ? (
          // Spinner icon when agent is thinking
          <span className="spinner">&#9696;</span>
        ) : isRecording ? (
          // Filled mic icon when recording
          <span className="mic-icon active">&#127908;</span>
        ) : (
          // Outline mic icon when not recording
          <span className="mic-icon">&#127908;</span>
        )}
      </button>

      <div className="audio-status">
        {permissionDenied && (
          <p className="error-text">Microphone access denied. Please allow microphone access and try again.</p>
        )}
        {isProcessing && <p className="status-text">Agent is thinking...</p>}
        {isRecording && !isProcessing && <p className="status-text recording-text">Listening... (click to stop)</p>}
        {!isRecording && !isProcessing && !permissionDenied && (
          <p className="status-text">Click the microphone to start speaking</p>
        )}
      </div>
    </div>
  )
}

export default AudioControls
