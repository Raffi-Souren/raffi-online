import type { Metadata } from "next"
import NotFoundDeck from "./components/NotFoundDeck"

export const metadata: Metadata = {
  title: "Page not found · raffi.computer",
  description: "That page is missing. The mix isn’t.",
}

export default function NotFound() {
  return <NotFoundDeck />
}
