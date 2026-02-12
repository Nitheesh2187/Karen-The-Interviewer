/*
  FeedbackReport — displays the post-interview scorecard.

  data = {
    overall_score: 7.5,
    overall_assessment: "The candidate demonstrated...",
    strengths: ["Good communication", ...],
    improvements: ["Could improve...", ...],
    question_feedback: [
      { question, answer, scores: { relevance, depth, clarity, technical_accuracy }, comments }
    ]
  }

  The score bars use CSS width percentage — a score of 7 out of 10 = 70% width.
*/
function FeedbackReport({ data, onRestart }) {
  if (!data) return null

  // Helper to render a colored score bar
  const ScoreBar = ({ label, score }) => {
    const percentage = (score / 10) * 100
    // Color: green for high scores, yellow for mid, red for low
    const color = score >= 7 ? '#4caf50' : score >= 5 ? '#ff9800' : '#f44336'

    return (
      <div className="score-bar">
        <div className="score-label">
          <span>{label}</span>
          <span>{score.toFixed(1)}/10</span>
        </div>
        <div className="score-track">
          <div
            className="score-fill"
            style={{ width: `${percentage}%`, backgroundColor: color }}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="feedback-report">
      <h2>Interview Feedback</h2>

      {/* Overall Score — big number display */}
      <div className="overall-score">
        <div className="score-circle">
          <span className="score-number">{data.overall_score?.toFixed(1)}</span>
          <span className="score-max">/10</span>
        </div>
        <p className="overall-assessment">{data.overall_assessment}</p>
      </div>

      {/* Strengths & Improvements side by side */}
      <div className="feedback-columns">
        <div className="feedback-column">
          <h3>Strengths</h3>
          <ul>
            {data.strengths?.map((s, i) => (
              <li key={i} className="strength-item">{s}</li>
            ))}
          </ul>
        </div>
        <div className="feedback-column">
          <h3>Areas for Improvement</h3>
          <ul>
            {data.improvements?.map((s, i) => (
              <li key={i} className="improvement-item">{s}</li>
            ))}
          </ul>
        </div>
      </div>

      {/* Per-question breakdown */}
      <h3>Question-by-Question Breakdown</h3>
      {data.question_feedback?.map((qf, index) => (
        <div key={index} className="question-feedback">
          <h4>Q{index + 1}: {qf.question}</h4>
          <p className="answer-text"><strong>Your answer:</strong> {qf.answer}</p>
          <div className="scores-grid">
            <ScoreBar label="Relevance" score={qf.scores.relevance} />
            <ScoreBar label="Depth" score={qf.scores.depth} />
            <ScoreBar label="Clarity" score={qf.scores.clarity} />
            <ScoreBar label="Technical Accuracy" score={qf.scores.technical_accuracy} />
          </div>
          <p className="feedback-comments">{qf.comments}</p>
        </div>
      ))}

      <button className="btn-primary" onClick={onRestart}>
        Start New Interview
      </button>
    </div>
  )
}

export default FeedbackReport
