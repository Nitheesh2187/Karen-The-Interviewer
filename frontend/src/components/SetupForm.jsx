import { useState } from 'react'

/*
  SetupForm — collects interview configuration from the user.

  Props:
    onComplete(data) — called when user submits with valid data.
      data = { job_description, resume, role, experience_level }
*/
function SetupForm({ onComplete }) {
  const [formData, setFormData] = useState({
    job_description: '',
    resume: '',
    role: '',
    experience_level: 'mid',
  })

  const handleChange = (e) => {
    const { name, value } = e.target
    // Computed property name: [name] uses the input's name attribute as the key
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = (e) => {
    e.preventDefault() // Prevent page reload (default form behavior)
    onComplete(formData)
  }

  // Check if required fields are filled
  const isValid = formData.job_description.trim() && formData.resume.trim() && formData.role.trim()

  return (
    <div className="setup-form">
      <h2>Set Up Your Interview</h2>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="role">Job Role / Title</label>
          <input
            type="text"
            id="role"
            name="role"
            value={formData.role}
            onChange={handleChange}
            placeholder="e.g. Senior Frontend Engineer"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="experience_level">Experience Level</label>
          <select
            id="experience_level"
            name="experience_level"
            value={formData.experience_level}
            onChange={handleChange}
          >
            <option value="junior">Junior (0-2 years)</option>
            <option value="mid">Mid-Level (2-5 years)</option>
            <option value="senior">Senior (5+ years)</option>
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="job_description">Job Description</label>
          <textarea
            id="job_description"
            name="job_description"
            value={formData.job_description}
            onChange={handleChange}
            placeholder="Paste the job description here..."
            rows={6}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="resume">Your Resume</label>
          <textarea
            id="resume"
            name="resume"
            value={formData.resume}
            onChange={handleChange}
            placeholder="Paste your resume content here..."
            rows={6}
            required
          />
        </div>

        <button type="submit" className="btn-primary" disabled={!isValid}>
          Start Interview
        </button>
      </form>
    </div>
  )
}

export default SetupForm
