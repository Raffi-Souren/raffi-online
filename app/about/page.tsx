export default function AboutPage() {
  return (
    <div className="container mx-auto px-4 py-16">
      <div className="max-w-4xl mx-auto">
        <h1 className="font-heading text-4xl font-bold mb-8 text-center">About Raffi</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="glass-card p-6">
              <h2 className="font-heading text-2xl font-semibold mb-4 text-accent">Bio</h2>
              <p className="text-muted leading-relaxed mb-4">
                Raffi is an AI architect and creative technologist based in New York City. By day,
                he builds enterprise AI solutions at IBM, focusing on watsonx deployments and machine learning
                infrastructure. By night, he crafts sonic experiences as a DJ and producer in NYC's underground
                electronic music scene.
              </p>
              <p className="text-muted leading-relaxed">
                His work spans the intersection of artificial intelligence, blockchain technology, and creative
                expression. Through his writing series "From Consumer Buzz to Enterprise Adoption," he explores the
                practical realities of implementing AI in large-scale enterprise environments.
              </p>
            </div>

            <div className="glass-card p-6">
              <h2 className="font-heading text-2xl font-semibold mb-4 text-accent">Experience</h2>
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold">AI Architect • IBM</h3>
                  <p className="text-muted text-sm">2022 - Present</p>
                  <p className="text-muted text-sm mt-1">Leading enterprise AI implementations with watsonx platform</p>
                </div>
                <div>
                  <h3 className="font-semibold">Creative Technologist • Various</h3>
                  <p className="text-muted text-sm">2020 - Present</p>
                  <p className="text-muted text-sm mt-1">Startup consulting, DJ/producer, creative tech projects</p>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="glass-card p-6">
              <h2 className="font-heading text-2xl font-semibold mb-4 text-accent">Press Kit</h2>
              <p className="text-muted text-sm mb-4">
                High-resolution photos, logos, and bio variations available for press use.
              </p>
              <p className="text-muted text-sm">Contact for press materials and interview requests.</p>
            </div>

            <div className="glass-card p-6">
              <h2 className="font-heading text-2xl font-semibold mb-4 text-accent">Booking</h2>
              <p className="text-muted text-sm mb-4">
                Available for DJ bookings, speaking engagements, and consulting projects.
              </p>
              <p className="text-muted text-sm">Email: raffi@notgoodcompany.com</p>
            </div>

            <div className="glass-card p-6">
              <h2 className="font-heading text-2xl font-semibold mb-4 text-accent">Contact</h2>
              <div className="space-y-2 text-sm text-muted">
                <p>Professional inquiries: raffi@notgoodcompany.com</p>
                <p>DJ bookings: raffi@notgoodcompany.com</p>
                <p>Press: raffi@notgoodcompany.com</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
