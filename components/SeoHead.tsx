import Head from "next/head"

interface SeoHeadProps {
  title?: string
  description?: string
  ogImage?: string
  ogUrl?: string
}

export default function SeoHead({
  title = "Raffi WW Web",
  description = "AI Architect & Technology Consultant based in New York City.",
  ogImage = "/windows-2000-background.png",
  ogUrl = "https://raffi-souren.vercel.app/",
}: SeoHeadProps) {
  return (
    <Head>
      <title>{title}</title>
      <meta name="description" content={description} />

      {/* Open Graph Tags */}
      <meta property="og:type" content="website" />
      <meta property="og:url" content={ogUrl} />
      <meta property="og:title" content="Raffi Web" />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:image:alt" content="Windows XP desktop background" />

      {/* Twitter Tags */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content="Raffi Web" />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />
    </Head>
  )
}
