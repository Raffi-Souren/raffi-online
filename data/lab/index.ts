import tapeShelf from "./tape-shelf"
import gearAnatomy from "./gear-anatomy"
import research from "./research"
import researchArchitecture from "./research-architecture"

export const LAB_POSTS = [tapeShelf, gearAnatomy, research, researchArchitecture] as const
export type LabPost = (typeof LAB_POSTS)[number]
export type LabSlug = LabPost["slug"]
export const DEFAULT_LAB_SLUG: LabSlug = "tape-shelf"

export function getLabPost(slug: string) {
  return LAB_POSTS.find((post) => post.slug === slug)
}

export function labSlugFromPath(pathname: string): LabSlug | null {
  const match = /^\/lab\/([^/]+)\/?$/.exec(pathname)
  return match ? getLabPost(match[1])?.slug ?? null : null
}
