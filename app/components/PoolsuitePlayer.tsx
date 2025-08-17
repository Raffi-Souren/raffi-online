'use client'

export default function PoolsuitePlayer() {
  return (
    <div className="w-full h-full bg-black">
      <iframe 
        src="https://poolsuite.net"
        className="w-full h-full"
        allow="autoplay"
        style={{ border: 'none' }}
      />
    </div>
  )
}
