"use client"

/**
 * Collapse floors, in CSS pixels.
 *
 * The DOOM captcha is a third-party embed with no intrinsic height, so without
 * a floor a short landscape viewport (568x320, 667x375) shrank the iframe
 * toward nothing. We never CSS-zoom the embed — we guarantee it room and let
 * the window scroll when the viewport genuinely cannot fit it.
 */
const DOOM_MIN_PLAYFIELD = 260
const DOOM_MIN_FRAME = 360

export default function DoomGame() {
  return (
    // grow + shrink-0 + minHeight: fills a tall window, but in a short landscape
    // viewport the floor holds and WindowShell's content area scrolls instead of
    // crushing the iframe. `h-full` alone had no floor at all.
    <div
      className="flex w-full shrink-0 grow flex-col bg-gradient-to-b from-red-950 via-gray-900 to-black p-2 sm:p-3"
      style={{ minHeight: DOOM_MIN_FRAME }}
    >
      {/* Logo/Title — shrink-0 so the chrome never steals from the game.
          Below 520px of viewport height the credit line and the oversized
          wordmark give their space back to the play area. */}
      <div className="shrink-0 pb-2 text-center [@media(max-height:520px)]:pb-1">
        <h1
          className="text-2xl font-bold text-red-600 drop-shadow-[0_0_20px_rgba(220,38,38,0.5)] sm:text-3xl md:text-4xl [@media(max-height:520px)]:text-base"
          style={{ fontFamily: "monospace" }}
        >
          DOOM <span className="text-green-500">CAPTCHA</span>
        </h1>
        <p className="font-mono text-[10px] text-gray-400 sm:text-xs [@media(max-height:520px)]:hidden">
          Prove you are human by slaying demons. Credit:{" "}
          <a
            href="https://x.com/rauchg/status/1874130110120706556"
            target="_blank"
            rel="noopener noreferrer"
            className="text-red-400 hover:underline"
          >
            Guillermo Rauch
          </a>
        </p>
      </div>

      {/* Game embed — takes every pixel the header and footer don't.
          No min-height ladder: those were overriding the flex sizing and
          pinning the frame to 500px inside a much taller window. */}
      {/* Capped width on purpose: the embed is a narrow fixed-width captcha
          card on a white page, so a full-bleed iframe just renders a wide white
          margin. Constraining it lets the DOOM chrome frame the game instead. */}
      <div
        className="relative mx-auto w-full max-w-[720px] flex-1 overflow-hidden rounded-lg border-2 border-red-900 shadow-2xl"
        style={{ minHeight: DOOM_MIN_PLAYFIELD }}
      >
        <iframe
          src="https://doom-captcha.vercel.app/"
          className="absolute inset-0 h-full w-full"
          allow="fullscreen; autoplay"
          title="DOOM CAPTCHA - Prove you are human by slaying demons"
        />
      </div>

      {/* Controls Guide */}
      <div className="flex-shrink-0 pt-2 text-center font-mono text-[10px] text-gray-500 sm:text-xs">
        <span className="hidden sm:inline">Use arrow keys or WASD to move, space to shoot</span>
        <span className="sm:hidden">Touch controls on screen</span>
      </div>
    </div>
  )
}
