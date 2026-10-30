import { ImageResponse } from "next/og"
import { getLabPost, type LabSlug } from "@/data/lab"

export const alt = "Raffi’s lab — small experiments in sound, hardware and research"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

function Artwork({ slug }: { slug: LabSlug }) {
  if (slug === "tape-shelf") {
    return (
      <svg width="480" height="350" viewBox="0 0 480 350">
        <rect x="26" y="22" width="76" height="263" rx="7" fill="#ce5a37" />
        <rect x="111" y="10" width="69" height="280" rx="7" fill="#b9bf89" />
        <rect x="187" y="30" width="67" height="260" rx="7" fill="#d8b64f" />
        <path d="M42 58h44M42 67h44M42 76h44M125 48h41M125 57h41M200 67h40" stroke="#f4e5c1" strokeWidth="5" />
        <g transform="rotate(-7 250 200)">
          <rect x="72" y="110" width="365" height="206" rx="18" fill="#25352f" />
          <rect x="87" y="125" width="335" height="129" rx="8" fill="#f3e8c7" />
          <rect x="87" y="150" width="335" height="12" fill="#d25938" />
          <rect x="87" y="164" width="335" height="8" fill="#d5b443" />
          <rect x="87" y="174" width="335" height="6" fill="#557ba0" />
          <path d="M108 140h55M172 140h34M365 140h35" stroke="#25352f" strokeWidth="5" />
          <rect x="130" y="194" width="249" height="48" rx="24" fill="#263b33" />
          <circle cx="159" cy="218" r="31" fill="#e2d8b8" stroke="#25352f" strokeWidth="4" />
          <circle cx="349" cy="218" r="31" fill="#e2d8b8" stroke="#25352f" strokeWidth="4" />
          <circle cx="159" cy="218" r="11" fill="#25352f" />
          <circle cx="349" cy="218" r="11" fill="#25352f" />
          <path d="M181 282l12-24h125l14 24z" fill="#52624d" />
          <path d="M119 271h-13v20h13M130 271h12v20h-12M130 271v10h12M155 271h12v20h-12z" fill="none" stroke="#f3e8c7" strokeWidth="3" />
          <circle cx="95" cy="294" r="3" fill="#1b2924" />
          <circle cx="414" cy="294" r="3" fill="#1b2924" />
        </g>
      </svg>
    )
  }

  if (slug === "gear-anatomy") {
    return (
      <svg width="480" height="350" viewBox="0 0 480 350">
        <rect x="8" y="28" width="464" height="294" rx="18" fill="#243b34" />
        <rect x="25" y="74" width="174" height="214" rx="8" fill="#a8b9a1" />
        <rect x="281" y="74" width="174" height="214" rx="8" fill="#a8b9a1" />
        <rect x="208" y="96" width="65" height="176" rx="6" fill="#f4f0dd" />
        <circle cx="112" cy="175" r="67" fill="#b99b54" />
        <circle cx="112" cy="175" r="57" fill="#293a34" />
        <circle cx="112" cy="175" r="48" fill="none" stroke="#556055" strokeWidth="2" />
        <circle cx="112" cy="175" r="17" fill="#d4bc78" />
        <circle cx="112" cy="175" r="4" fill="#293a34" />
        <circle cx="368" cy="175" r="67" fill="#b99b54" />
        <circle cx="368" cy="175" r="57" fill="#293a34" />
        <circle cx="368" cy="175" r="48" fill="none" stroke="#556055" strokeWidth="2" />
        <circle cx="368" cy="175" r="17" fill="#d4bc78" />
        <circle cx="368" cy="175" r="4" fill="#293a34" />
        <path d="M174 102v89l-26 28M430 102v89l-26 28" fill="none" stroke="#dfc887" strokeWidth="7" strokeLinecap="round" />
        <circle cx="174" cy="102" r="10" fill="#6e7b62" stroke="#dfc887" strokeWidth="3" />
        <circle cx="430" cy="102" r="10" fill="#6e7b62" stroke="#dfc887" strokeWidth="3" />
        <rect x="219" y="111" width="43" height="24" rx="2" fill="#284c4d" />
        <path d="M225 154v64M239 154v64M253 154v64" stroke="#b2b3a3" strokeWidth="3" />
        <path d="M220 178h10M234 192h10M248 170h10" stroke="#354a3d" strokeWidth="6" />
        <circle cx="231" cy="245" r="7" fill="#a28b50" />
        <circle cx="252" cy="245" r="7" fill="#354a3d" />
        <rect x="39" y="258" width="25" height="12" rx="2" fill="#d6c485" />
        <rect x="295" y="258" width="25" height="12" rx="2" fill="#d6c485" />
        <path d="M28 52h53M91 52h27M128 52h53" stroke="#d4d9c8" strokeWidth="4" />
      </svg>
    )
  }

  if (slug === "research") {
    return (
      <svg width="480" height="350" viewBox="0 0 480 350">
        <g transform="rotate(-9 210 170)">
          <rect x="58" y="42" width="269" height="266" rx="4" fill="#cdd7c1" stroke="#87977a" strokeWidth="2" />
          <path d="M84 83h181M84 98h181M84 113h140" stroke="#a7b297" strokeWidth="5" />
        </g>
        <g transform="rotate(7 269 170)">
          <rect x="132" y="26" width="273" height="280" rx="4" fill="#fffdf4" stroke="#bfbba8" strokeWidth="2" />
          <rect x="157" y="52" width="72" height="8" fill="#748366" />
          <path d="M157 88h142M157 101h102" stroke="#2d4033" strokeWidth="8" />
          <path d="M157 121h218M157 133h218M157 145h168" stroke="#c9c5b5" strokeWidth="4" />
          <rect x="157" y="169" width="98" height="58" fill="#e3e9db" />
          <path d="M268 175h107M268 187h107M268 199h107M268 211h79M157 248h218M157 260h218M157 272h151" stroke="#c9c5b5" strokeWidth="4" />
          <path d="M169 196h74M169 206h54" stroke="#8f9d7d" strokeWidth="4" />
        </g>
        <g transform="rotate(-12 346 283)">
          <rect x="275" y="260" width="143" height="45" rx="2" fill="#f0ebd7" stroke="#758565" strokeWidth="3" />
          <path d="M290 282l7 7 14-17M324 278h77M324 287h63" fill="none" stroke="#657952" strokeWidth="4" />
        </g>
      </svg>
    )
  }

  return (
    <svg width="480" height="350" viewBox="0 0 480 350">
      <path d="M12 220L217 91l251 115-211 131z" fill="#d8e3e4" stroke="#a5b6b8" strokeWidth="2" />
      <path d="M66 225l178-105M154 280l179-110M83 176l251 115M162 128l251 115" stroke="#bdcccf" strokeWidth="2" />
      <path d="M97 220l97-54 79 41 91-48" fill="none" stroke="#f9fbf9" strokeWidth="12" strokeLinejoin="round" />
      <g>
        <path d="M47 151l75 35v66l-75-35z" fill="#99b4a8" />
        <path d="M122 186l69-41v66l-69 41z" fill="#719383" />
        <path d="M47 151l70-41 74 35-69 41z" fill="#d6e5d7" />
        <path d="M65 152l54 25v45l-54-25z" fill="#f2f5e9" />
        <path d="M73 183l34 16M73 191l24 12" stroke="#3c6654" strokeWidth="3" />
      </g>
      <g>
        <path d="M210 96l79 38v72l-79-38z" fill="#a6b8c4" />
        <path d="M289 134l64-38v72l-64 38z" fill="#839bac" />
        <path d="M210 96l65-39 78 39-64 38z" fill="#e2eced" />
        <path d="M225 103l48 23v49l-48-23z" fill="#f6f7ec" />
        <path d="M234 137l29 14M234 145l21 10" stroke="#557888" strokeWidth="3" />
      </g>
      <g>
        <path d="M263 229l80 38v53l-80-38z" fill="#cbbf99" />
        <path d="M343 267l70-43v53l-70 43z" fill="#b2a578" />
        <path d="M263 229l70-42 80 37-70 43z" fill="#e9e0bd" />
        <path d="M280 235l47 22v32l-47-22z" fill="#f8f5e7" />
        <path d="M288 249l29 14M288 257l20 10" stroke="#7c704b" strokeWidth="3" />
      </g>
      <circle cx="218" cy="237" r="9" fill="#d17c52" />
      <circle cx="218" cy="237" r="3" fill="#fff8e6" />
    </svg>
  )
}

export default function Image({ params }: { params: { slug: string } }) {
  const post = getLabPost(params.slug)
  if (!post) return new Response("Not found", { status: 404 })

  return new ImageResponse(
    (
      <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", padding: "42px 48px 34px", background: "#f2efe6", color: "#273d31", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: 20, borderBottom: "2px solid #bfc7b5" }}>
          <div style={{ display: "flex", fontSize: 22, fontWeight: 700, letterSpacing: 4 }}>RAFFI / LAB</div>
          <div style={{ display: "flex", fontSize: 17, color: "#61735d" }}>{post.medium}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flex: 1 }}>
          <div style={{ display: "flex", flexDirection: "column", width: 570, paddingRight: 18 }}>
            <div style={{ display: "flex", fontSize: 72, fontWeight: 700, lineHeight: 1.05, letterSpacing: -3 }}>{post.title}</div>
            <div style={{ display: "flex", marginTop: 24, fontSize: 25, lineHeight: 1.4, color: "#64705e" }}>{post.caption}</div>
          </div>
          <div style={{ display: "flex", width: 480, height: 350, flexShrink: 0 }}><Artwork slug={post.slug} /></div>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 14, borderTop: "1px solid #c8ccbd", fontSize: 16, color: "#64705e" }}>
          <div style={{ display: "flex" }}>raffi.computer</div>
          <div style={{ display: "flex" }}>/lab/{post.slug}</div>
        </div>
      </div>
    ),
    size,
  )
}
