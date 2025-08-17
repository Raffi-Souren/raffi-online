import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { pitch, file } = await request.json()

    // Placeholder for LLM integration
    // TODO: Add your LLM implementation here
    const mockFeedback = `Analyzing pitch: "${pitch.slice(0, 50)}..."
${file ? `\nReviewing deck: ${file}` : ''}

Initial Feedback:
1. Market Analysis: Pending LLM integration
2. Business Model: Pending LLM integration
3. Technical Feasibility: Pending LLM integration
4. Investment Potential: Pending LLM integration`

    return NextResponse.json({ feedback: mockFeedback })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to process pitch' },
      { status: 500 }
    )
  }
}

