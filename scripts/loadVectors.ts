import { loadVectorsIntoPinecone } from '../utils/pinecone';

async function main() {
  const INDEX_NAME = "startup-pitches";
  await loadVectorsIntoPinecone(INDEX_NAME);
}

main().catch(console.error);
