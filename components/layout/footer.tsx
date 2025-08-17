import Link from "next/link"
import { Github, Linkedin, Twitter, Mail } from "lucide-react"

const footerLinks = [
  { name: "Web Crates", href: "/projects" },
  { name: "DJ Sets", href: "/music" },
  { name: "Newsletter", href: "#newsletter" },
  { name: "Booking", href: "/about#booking" },
]

const socialLinks = [
  { name: "GitHub", href: "https://github.com/raffi-souren", icon: Github },
  { name: "LinkedIn", href: "https://linkedin.com/in/raffi-souren", icon: Linkedin },
  { name: "Twitter", href: "https://twitter.com/raffi_souren", icon: Twitter },
  { name: "Email", href: "mailto:hello@raffi-souren.com", icon: Mail },
]

export function Footer() {
  return (
    <footer className="border-t border-border bg-secondary/20">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <h3 className="font-heading text-lg font-semibold text-accent mb-4">Raffi Souren</h3>
            <p className="text-muted text-sm">
              AI Architect × DJ × Creative Technologist
              <br />
              Building the future of enterprise AI while spinning records in NYC.
            </p>
          </div>

          <div>
            <h4 className="font-heading text-sm font-semibold text-foreground mb-4">Quick Links</h4>
            <ul className="space-y-2">
              {footerLinks.map((link) => (
                <li key={link.name}>
                  <Link href={link.href} className="text-muted text-sm hover:text-accent transition-colors">
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-heading text-sm font-semibold text-foreground mb-4">Connect</h4>
            <div className="flex space-x-4">
              {socialLinks.map((link) => (
                <Link
                  key={link.name}
                  href={link.href}
                  className="text-muted hover:text-accent transition-colors"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <link.icon className="h-5 w-5" />
                  <span className="sr-only">{link.name}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div className="ascii-divider">▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓</div>

        <div className="mt-8 pt-8 border-t border-border">
          <p className="text-center text-muted text-sm">
            © {new Date().getFullYear()} Raffi Souren Khatchadourian. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}
