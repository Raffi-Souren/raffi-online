import { PineconeClient } from "@pinecone-database/pinecone"
import { parse } from "csv-parse/sync"
import fetch from "node-fetch"

const pinecone = new PineconeClient()

export async function initPinecone() {
  await pinecone.init({
    apiKey: process.env.PINECONE_API_KEY!,
    environment: process.env.PINECONE_ENVIRONMENT!,
  })
  return pinecone
}

export async function createIndex(pinecone: PineconeClient, indexName: string, dimension = 1536) {
  const existingIndexes = await pinecone.listIndexes()
  if (!existingIndexes.includes(indexName)) {
    await pinecone.createIndex({
      createRequest: {
        name: indexName,
        dimension,
        metric: "cosine",
      },
    })
  }
}

export function getIndex(pinecone: PineconeClient, indexName: string) {
  return pinecone.Index(indexName)
}

export async function loadVectorsIntoPinecone(indexName: string) {
  const pinecone = await initPinecone()
  const index = getIndex(pinecone, indexName)

  const response = await fetch(
    "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/text_vectors-TMBn3On3cqL8dJKRR2tIvkc1BNoIh3.csv",
  )
  const csvData = await response.text()

  const records = parse(csvData, {
    columns: true,
    skip_empty_lines: true,
  })

  for (const record of records) {
    const vector = JSON.parse(record.vector)
    await index.upsert({
      upsertRequest: {
        vectors: [
          {
            id: record.file_name,
            values: vector,
            metadata: { text: record.text },
          },
        ],
      },
    })
  }

  console.log(`Loaded ${records.length} vectors into Pinecone index ${indexName}`)
}

