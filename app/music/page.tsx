export default function MusicPage() {
  return (
    <div className="container mx-auto px-4 py-16">
      <div className="max-w-4xl mx-auto text-center">
        <h1 className="font-heading text-4xl font-bold mb-4">Music & DJ Sets</h1>
        <p className="text-muted text-lg mb-8">Deep house, techno, and underground sounds from NYC and beyond</p>

        <div className="glass-card p-8">
          <p className="text-muted">Music section coming soon. Will feature:</p>
          <ul className="text-left text-muted mt-4 space-y-2">
            <li>• Mixcloud/SoundCloud embeds</li>
            <li>• Spotify productions</li>
            <li>• Live set recordings</li>
            <li>• Curated playlists</li>
            <li>• Sticky audio player</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
