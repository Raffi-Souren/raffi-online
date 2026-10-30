import type { Metadata } from "next"
import { notFound } from "next/navigation"
import Home from "@/app/page"
import { getLabPost, LAB_POSTS } from "@/data/lab"

export function generateStaticParams() {
  return LAB_POSTS.map(({ slug }) => ({ slug }))
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const post = getLabPost(params.slug)
  if (!post) return {}
  const image = { url: `/lab/${post.slug}/opengraph-image`, width: 1200, height: 630, alt: `${post.title} · ${post.caption}` }
  return {
    title: `${post.title} · Raffi’s lab`,
    description: post.description,
    alternates: { canonical: `/lab/${post.slug}` },
    openGraph: { title: `${post.title} · Raffi’s lab`, description: post.description, url: `/lab/${post.slug}`, images: [image] },
    twitter: { card: "summary_large_image", title: `${post.title} · Raffi’s lab`, description: post.description, images: [image] },
  }
}

export default function LabPage({ params }: { params: { slug: string } }) {
  if (!getLabPost(params.slug)) notFound()
  return <Home />
}
