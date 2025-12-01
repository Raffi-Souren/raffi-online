import { neon } from "@neondatabase/serverless"
import { NextResponse } from "next/server"

const sql = neon(process.env.DATABASE_URL!)

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const game = searchParams.get("game")
    const limit = Number.parseInt(searchParams.get("limit") || "10")

    if (!game) {
      return NextResponse.json({ error: "Game name required" }, { status: 400 })
    }

    const scores = await sql`
      SELECT player_name, score, level, created_at
      FROM game_scores
      WHERE game_name = ${game}
      ORDER BY score DESC, created_at ASC
      LIMIT ${limit}
    `

    return NextResponse.json({ scores })
  } catch (error) {
    console.error("Error fetching scores:", error)
    return NextResponse.json({ error: "Failed to fetch scores" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { playerName, gameName, score, level } = body

    if (!playerName || !gameName || typeof score !== "number") {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 })
    }

    // Truncate player name to 50 chars
    const truncatedName = playerName.substring(0, 50)

    const result = await sql`
      INSERT INTO game_scores (player_name, game_name, score, level)
      VALUES (${truncatedName}, ${gameName}, ${score}, ${level || 1})
      RETURNING id, player_name, score, level, created_at
    `

    return NextResponse.json({ success: true, score: result[0] })
  } catch (error) {
    console.error("Error saving score:", error)
    return NextResponse.json({ error: "Failed to save score" }, { status: 500 })
  }
}
