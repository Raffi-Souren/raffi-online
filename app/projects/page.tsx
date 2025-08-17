export default function ProjectsPage() {
  return (
    <div className="container mx-auto px-4 py-16">
      <div className="max-w-4xl mx-auto text-center">
        <h1 className="font-heading text-4xl font-bold mb-4">Projects & Portfolio</h1>
        <p className="text-muted text-lg mb-8">Enterprise AI, startups, open source, and creative tech work</p>

        <div className="glass-card p-8">
          <p className="text-muted">Projects section coming soon. Will showcase:</p>
          <ul className="text-left text-muted mt-4 space-y-2">
            <li>• IBM/watsonx enterprise deployments</li>
            <li>• Startup work (indify, Bad Company collective)</li>
            <li>• Open source contributions</li>
            <li>• Creative tech installations</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
