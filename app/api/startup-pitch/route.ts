import { NextResponse } from "next/server"
import OpenAI from "openai"
import { PineconeClient } from "@pinecone-database/pinecone"

const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const INDEX_NAME = "startup-pitches"

const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
})

async function getEmbedding(text: string) {
  try {
    const response = await openai.embeddings.create({
      model: "text-embedding-ada-002",
      input: text,
    })
    return response.data[0].embedding
  } catch (error) {
    console.error("Error creating embedding:", error)
    throw new Error("Failed to create embedding")
  }
}

async function initPinecone() {
  const pinecone = new PineconeClient()
  await pinecone.init({
    environment: process.env.PINECONE_ENVIRONMENT!,
    apiKey: process.env.PINECONE_API_KEY!,
  })
  return pinecone
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const pitch = formData.get("pitch") as string
    const file = formData.get("file") as File | null

    if (!pitch) {
      return NextResponse.json({ error: "No pitch provided" }, { status: 400 })
    }

    let fileContent = ""
    if (file && file.size > 0) {
      // Instead of parsing PDF, we'll just use the file name
      fileContent = `File attached: ${file.name}`
    }

    const fullPitch = fileContent ? `${pitch}\n\n${fileContent}` : pitch

    let embedding
    try {
      embedding = await getEmbedding(fullPitch)
    } catch (error) {
      console.error("Error getting embedding:", error)
      return NextResponse.json({ error: "Failed to process pitch text" }, { status: 500 })
    }

    let pinecone
    try {
      pinecone = await initPinecone()
    } catch (error) {
      console.error("Error initializing Pinecone:", error)
      return NextResponse.json({ error: "Failed to initialize database" }, { status: 500 })
    }

    const index = pinecone.Index(INDEX_NAME)

    let queryResponse
    try {
      queryResponse = await index.query({
        vector: embedding,
        topK: 5,
        includeMetadata: true,
      })
    } catch (error) {
      console.error("Error querying Pinecone:", error)
      return NextResponse.json({ error: "Failed to query database" }, { status: 500 })
    }

    const retrievedDocs = queryResponse.matches.map((match) => match.metadata.text).join("\n\n")

    const prompt = `
You are reviewing a startup pitch based on previous feedback and similar pitches. Here are some relevant examples:

${retrievedDocs}

Now, provide feedback for the following startup pitch:

"${fullPitch}"

Your feedback should be detailed, constructive, and consider the context of similar pitches. Include specific suggestions for improvement and highlight any unique aspects of this pitch compared to the examples.
    `

    let completion
    try {
      completion = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content:
              "You are an experienced startup advisor providing detailed and constructive feedback on startup pitches. You have access to a database of previous pitches and feedback to inform your responses.",
          },
          { role: "user", content: prompt },
        ],
        max_tokens: 750,
        temperature: 0.7,
      })
    } catch (error) {
      console.error("Error creating chat completion:", error)
      return NextResponse.json({ error: "Failed to generate feedback" }, { status: 500 })
    }

    const feedback = completion.choices[0].message.content.trim()

    return NextResponse.json({ feedback })
  } catch (error) {
    console.error("Error processing pitch:", error)
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 })
  }
}
