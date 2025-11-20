export default function GamesPage() {
  return (
    <div className="container mx-auto px-4 py-16">
      <div className="max-w-4xl mx-auto text-center">
        <h1 className="font-heading text-4xl font-bold mb-4">Retro Gaming Hub</h1>
        <p className="text-muted text-lg mb-8">Classic games reimagined for the modern web</p>

        <div className="glass-card p-8">
          <p className="text-muted">Games section coming soon. Will feature:</p>
          <ul className="text-center text-muted mt-4 space-y-2">
            <li>• Working 2048, Tetris, Snake implementations</li>
            <li>• Hextris and Pac-Man embeds</li>
            <li>• High score tracking</li>
            <li>• EmulatorJS for retro console games</li>
            <li>• Share score functionality</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
