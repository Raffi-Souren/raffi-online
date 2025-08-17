import { WindowsIcons } from "./Icons"

interface Article {
  title: string
  url: string
  type: "LinkedIn" | "Research"
}

const articles: Article[] = [
  {
    title: "From Consumer Buzz to Enterprise Adoption v1: AI Agents in Finance and Crypto",
    url: "https://www.linkedin.com/pulse/from-consumer-buzz-enterprise-adoption-ai-agents-raffi-khatchadourian-ulpfe",
    type: "LinkedIn",
  },
  {
    title: "From Consumer Buzz to Enterprise Adoption v2: Are Todays AI Agents Actually Agentic?",
    url: "https://www.linkedin.com/pulse/from-consumer-buzz-enterprise-adoption-todays-ai-raffi-khatchadourian-zp0ke/",
    type: "LinkedIn",
  },
  {
    title: "From Consumer Buzz to Enterprise Adoption v3: Research, but make it deep",
    url: "https://www.linkedin.com/pulse/from-consumer-buzz-enterprise-adoption-v3-research-khatchadourian-nqmae/",
    type: "LinkedIn",
  },
  {
    title: "Impact of External Forces and the Digital Age on the Turkish Narrative of Armenians in Turkey's Textbooks",
    url: "https://www.academia.edu/44288138/Impact_of_External_Forces_and_the_Digital_Age_on_the_Turkish_Narrative_of_Armenians_in_Turkeys_Textbooks",
    type: "Research",
  },
  {
    title: "Ticketmaster and Live Nation Antitrust Violations",
    url: "https://www.academia.edu/95690323/Ticketmaster_and_Live_Nation_Antitrust_Violations",
    type: "Research",
  },
  {
    title: "The Effect of a US Recession and Macroeconomic Variables on Stock Market Performance",
    url: "https://www.academia.edu/127439445/The_Effect_of_a_US_Recession_and_Macroeconomic_Variables_on_Stock_Market_Performance",
    type: "Research",
  },
]

interface NotesWindowProps {
  onClose: () => void
}

export default function NotesWindow({ onClose }: NotesWindowProps) {
  return (
    <div className="window fixed inset-0 md:inset-auto md:top-20 md:left-1/2 md:-translate-x-1/2 w-full md:w-[800px] h-[90vh] md:h-auto md:max-h-[80vh] overflow-y-auto z-50">
      <div className="window-title sticky top-0 z-10">
        <span>{WindowsIcons.Notes} RAF's Notes</span>
        <button className="ml-auto" onClick={onClose}>
          {WindowsIcons.Close}
        </button>
      </div>
      <div className="window-content">
        <h2 className="pyrex-text mb-4">My Articles and Research Papers</h2>
        <div className="space-y-6">
          <div>
            <h3 className="canary-text mb-2">LinkedIn Articles</h3>
            <ul className="list-disc pl-5 space-y-2">
              {articles
                .filter((article) => article.type === "LinkedIn")
                .map((article, index) => (
                  <li key={index}>
                    <a
                      href={article.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:underline"
                    >
                      {article.title}
                    </a>
                  </li>
                ))}
            </ul>
          </div>
          <div>
            <h3 className="canary-text mb-2">Research Papers</h3>
            <ul className="list-disc pl-5 space-y-2">
              {articles
                .filter((article) => article.type === "Research")
                .map((article, index) => (
                  <li key={index}>
                    <a
                      href={article.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:underline"
                    >
                      {article.title}
                    </a>
                  </li>
                ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
