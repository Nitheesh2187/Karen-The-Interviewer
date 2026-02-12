import { useState } from 'react'
import SetupForm from './components/SetupForm'
import InterviewRoom from './components/InterviewRoom'
import FeedbackReport from './components/FeedbackReport'

/*
  App has 3 screens, managed by a simple state variable:
    "setup"     → user fills in JD, resume, role
    "interview" → live voice interview
    "feedback"  → scorecard after interview ends

  Data flows DOWN via props:
    - setupData: the form values (passed to InterviewRoom so it can send to backend)
    - feedbackData: the scoring JSON (passed to FeedbackReport to render)
*/
function App() {
  const [screen, setScreen] = useState('setup') // "setup" | "interview" | "feedback"
  const [setupData, setSetupData] = useState(null)
  const [feedbackData, setFeedbackData] = useState(null)

  // Called when user submits the setup form
  const handleSetupComplete = (data) => {
    setSetupData(data)
    setScreen('interview')
  }

  // Called when the interview ends and feedback is received
  const handleInterviewEnd = (feedback) => {
    setFeedbackData(feedback)
    setScreen('feedback')
  }

  // Called when user wants to start a new interview from the feedback screen
  const handleRestart = () => {
    setSetupData(null)
    setFeedbackData(null)
    setScreen('setup')
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>Interview Voice Agent</h1>
        <p>AI-powered mock interview practice</p>
      </header>

      <main className="app-main">
        {screen === 'setup' && (
          <SetupForm onComplete={handleSetupComplete} />
        )}
        {screen === 'interview' && (
          <InterviewRoom
            setupData={setupData}
            onEnd={handleInterviewEnd}
          />
        )}
        {screen === 'feedback' && (
          <FeedbackReport
            data={feedbackData}
            onRestart={handleRestart}
          />
        )}
      </main>
    </div>
  )
}

export default App
