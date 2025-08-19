"use client"

interface SoundCloudEmbedProps {
  embedUrl: string
  title: string
  artist: string
  height?: number
}

export function SoundCloudEmbed({ embedUrl, title, artist, height = 166 }: SoundCloudEmbedProps) {
  return (
    <div className="w-full">
      <div className="mb-2">
        <h4 className="font-semibold text-sm">{title}</h4>
        <p className="text-xs text-gray-600">by {artist}</p>
      </div>
      <iframe
        width="100%"
        height={height}
        scrolling="no"
        frameBorder="no"
        allow="autoplay"
        src={embedUrl}
        className="rounded-lg"
        title={`${title} by ${artist}`}
      />
    </div>
  )
}
