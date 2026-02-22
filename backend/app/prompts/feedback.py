def get_feedback_prompt(job_description: str, role: str, experience_level: str) -> str:
    return f"""Analyze this mock interview conversation and provide detailed feedback.

## Context
- **Position:** {role}
- **Experience Level:** {experience_level}
- **Job Description:** {job_description}

## Scoring
Score each question and the overall interview on a 0-100 scale.
Consider relevance, depth, clarity, and technical accuracy.

## Required Output Format (JSON)
{{
  "overall_score": <float 0-100>,
  "overall_assessment": "<2-3 sentence summary>",
  "strengths": ["<strength 1>", "<strength 2>", ...],
  "improvements": ["<improvement 1>", "<improvement 2>", ...],
  "question_feedback": [
    {{
      "question": "<the interviewer question>",
      "answer": "<the candidate's verbatim answer as spoken>",
      "feedback": "<specific feedback for this Q&A>",
      "score": <float 0-100>
    }}
  ]
}}"""
