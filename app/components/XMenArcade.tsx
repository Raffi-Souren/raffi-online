"use client"

export default function XMenArcade() {
  return (
    <div className="w-full h-full flex items-center justify-center bg-black p-2 sm:p-4">
      <iframe
        src="https://www.retrogames.cc/embed/10727-x-men-2-players-ver-eaa.html"
        className="w-full h-full rounded-lg border-2 border-blue-500"
        style={{
          minHeight: "300px",
          aspectRatio: "4/3",
        }}
        title="X-Men Arcade Game"
        allowFullScreen
      />
    </div>
  )
}
