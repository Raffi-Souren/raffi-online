"use client"

/**
 * Collapse floors, in CSS pixels — same reasoning as DoomGame.
 *
 * Note: this embed is served by retrogames.cc, which injects third-party ad
 * frames (emulatorjs.com/ad.html, googlesyndication). That is a known trust
 * concern, reported rather than silently swapped — replacing the source is a
 * separate decision, not a layout fix.
 */
const XMEN_MIN_PLAYFIELD = 260
const XMEN_MIN_FRAME = 300

export default function XMenArcade() {
  return (
    // grow + shrink-0 + minHeight: fills a tall window, holds a usable play
    // area in short landscape, and lets the window scroll rather than crushing
    // the iframe. The retrogames.cc embed letterboxes its own canvas, so the
    // iframe simply fills the space it is given — no CSS zoom is applied.
    <div
      className="flex w-full shrink-0 grow flex-col bg-black p-2 sm:p-3"
      style={{ minHeight: XMEN_MIN_FRAME }}
    >
      <iframe
        src="https://www.retrogames.cc/embed/10727-x-men-2-players-ver-eaa.html"
        className="w-full flex-1 rounded-lg border-2 border-blue-500"
        style={{ minHeight: XMEN_MIN_PLAYFIELD }}
        title="X-Men Arcade Game"
        allowFullScreen
      />
    </div>
  )
}
