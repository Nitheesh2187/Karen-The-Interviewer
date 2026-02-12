def get_feedback_prompt(job_description: str, role: str, experience_level: str) -> str:
    return f"""Analyze this mock interview conversation and provide detailed feedback.

## Context
- **Position:** {role}
- **Experience Level:** {experience_level}
- **Job Description:** {job_description}

## Scoring Criteria (0-10 for each)
- **Relevance:** Did the answer address the question asked?
- **Depth:** How detailed and thorough was the response?
- **Clarity:** How well did the candidate communicate?
- **Technical Accuracy:** For technical questions, was the answer correct?

## Required Output Format (JSON)
Respond with ONLY valid JSON, no markdown fencing:
{{
  "overall_score": <float 0-10>,
  "overall_assessment": "<2-3 sentence summary>",
  "strengths": ["<strength 1>", "<strength 2>", ...],
  "improvements": ["<improvement 1>", "<improvement 2>", ...],
  "question_feedback": [
    {{
      "question": "<the interviewer question>",
      "answer": "<the candidate answer>",
      "scores": {{
        "relevance": <float 0-10>,
        "depth": <float 0-10>,
        "clarity": <float 0-10>,
        "technical_accuracy": <float 0-10>
      }},
      "comments": "<specific feedback for this Q&A>"
    }}
  ]
}}"""
