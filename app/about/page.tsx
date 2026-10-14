import { redirect } from "next/navigation"

// The desktop is the site; this old standalone page now opens its window instead.
export default function AboutPage() {
  redirect("/?app=about")
}
