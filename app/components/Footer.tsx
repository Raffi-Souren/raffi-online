import { Facebook, Instagram, Twitter } from 'lucide-react'
import Link from 'next/link'

const Footer = () => {
  return (
    <footer className="bg-black text-white py-12">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <h3 className="text-xl font-bold mb-4">Raffi Sourenkhatchadourian</h3>
            <p className="mb-4">Capturing life's moments, one frame at a time.</p>
            <div className="flex space-x-4">
              <a href="#" className="text-white hover:text-gray-300">
                <Facebook size={20} />
              </a>
              <a href="#" className="text-white hover:text-gray-300">
                <Instagram size={20} />
              </a>
              <a href="#" className="text-white hover:text-gray-300">
                <Twitter size={20} />
              </a>
            </div>
          </div>
          <div>
            <h3 className="text-xl font-bold mb-4">Quick Links</h3>
            <nav className="flex flex-col space-y-2">
              <Link href="/" className="hover:text-gray-300">Home</Link>
              <Link href="#services" className="hover:text-gray-300">Services</Link>
              <Link href="#portfolio" className="hover:text-gray-300">Portfolio</Link>
              <Link href="#about" className="hover:text-gray-300">About</Link>
              <Link href="#contact" className="hover:text-gray-300">Contact</Link>
            </nav>
          </div>
          <div>
            <h3 className="text-xl font-bold mb-4">Contact Information</h3>
            <p className="mb-2">123 Photography St, New York, NY 10001</p>
            <p className="mb-2">Phone: (123) 456-7890</p>
            <p>Email: info@raffisourenkhatchadourian.com</p>
          </div>
        </div>
        <div className="mt-8 pt-8 border-t border-gray-700 text-center">
          <p className="text-sm">
            © {new Date().getFullYear()} Raffi Sourenkhatchadourian. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}

export default Footer

