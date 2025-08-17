import Link from 'next/link'
import { useState } from 'react'
import { Menu, X } from 'lucide-react'
import Image from 'next/image'

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  return (
    <header className="bg-white shadow-md">
      <div className="container mx-auto px-4 py-4 flex justify-between items-center">
        <Link href="/" className="flex items-center">
          <Image src="/placeholder.svg?height=50&width=50" alt="Logo" width={50} height={50} className="mr-2" />
          <span className="text-2xl font-bold">Raffi Sourenkhatchadourian</span>
        </Link>
        <nav className="hidden md:flex space-x-6">
          <Link href="/" className="hover:text-gray-600">Home</Link>
          <Link href="#services" className="hover:text-gray-600">Services</Link>
          <Link href="#portfolio" className="hover:text-gray-600">Portfolio</Link>
          <Link href="#about" className="hover:text-gray-600">About</Link>
          <Link href="#contact" className="hover:text-gray-600">Contact</Link>
        </nav>
        <button
          className="md:hidden"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
        >
          {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>
      {isMenuOpen && (
        <nav className="md:hidden bg-white py-2">
          <Link href="/" className="block px-4 py-2 hover:bg-gray-100">Home</Link>
          <Link href="#services" className="block px-4 py-2 hover:bg-gray-100">Services</Link>
          <Link href="#portfolio" className="block px-4 py-2 hover:bg-gray-100">Portfolio</Link>
          <Link href="#about" className="block px-4 py-2 hover:bg-gray-100">About</Link>
          <Link href="#contact" className="block px-4 py-2 hover:bg-gray-100">Contact</Link>
        </nav>
      )}
    </header>
  )
}

export default Header

