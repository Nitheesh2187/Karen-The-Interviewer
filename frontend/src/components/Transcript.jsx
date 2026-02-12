import { useEffect, useRef } from 'react'

/*
  Transcript — displays the conversation history.

  messages = [
    { role: "assistant", content: "Tell me about yourself." },
    { role: "user", content: "I have 5 years of experience..." },
  ]

  interimText = the partial transcript while user is still speaking.
  This creates a "live typing" effect.

  Auto-scroll: useEffect + scrollIntoView keeps the latest message visible.
*/
function Transcript({ messages, interimText }) {
  const bottomRef = useRef(null)

  // Auto-scroll to bottom whenever messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, interimText])

  return (
    <div className="transcript">
      <h3>Conversation</h3>
      <div className="transcript-messages">
        {messages.map((msg, index) => (
          <div
            key={index}
            className={`message ${msg.role === 'assistant' ? 'message-agent' : 'message-user'}`}
          >
            <span className="message-role">
              {msg.role === 'assistant' ? 'Interviewer' : 'You'}
            </span>
            <p className="message-content">{msg.content}</p>
          </div>
        ))}

        {/* Show interim (partial) transcript while user is speaking */}
        {interimText && (
          <div className="message message-user interim">
            <span className="message-role">You</span>
            <p className="message-content">{interimText}</p>
          </div>
        )}

        {/* Invisible element at the bottom — scrollIntoView targets this */}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}

export default Transcript
