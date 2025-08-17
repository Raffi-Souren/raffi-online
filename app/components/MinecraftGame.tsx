'use client'

import React, { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'

const WORLD_SIZE = 20
const BLOCK_SIZE = 1

export default function MinecraftGame() {
  const mountRef = useRef<HTMLDivElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  useEffect(() => {
    if (!mountRef.current || !isPlaying) return

    // Scene setup
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x87CEEB) // Sky blue

    // Camera setup
    const aspect = mountRef.current.clientWidth / mountRef.current.clientHeight
    const camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000)
    camera.position.set(WORLD_SIZE / 2, WORLD_SIZE / 2, WORLD_SIZE / 2)

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight)
    mountRef.current.appendChild(renderer.domElement)

    // Controls setup
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.25
    controls.screenSpacePanning = false
    controls.maxPolarAngle = Math.PI / 2

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
    scene.add(ambientLight)

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6)
    directionalLight.position.set(10, 20, 0)
    scene.add(directionalLight)

    // Create ground
    const groundGeometry = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE)
    const groundMaterial = new THREE.MeshLambertMaterial({ color: 0x3a8024 }) // Grass green
    const ground = new THREE.Mesh(groundGeometry, groundMaterial)
    ground.rotation.x = -Math.PI / 2
    ground.position.y = -0.5
    scene.add(ground)

    // Create blocks
    const blockGeometry = new THREE.BoxGeometry(BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE)
    const blockMaterial = new THREE.MeshLambertMaterial({ color: 0x8b4513 }) // Brown

    for (let i = 0; i < 50; i++) {
      const block = new THREE.Mesh(blockGeometry, blockMaterial)
      block.position.set(
        Math.floor(Math.random() * WORLD_SIZE) - WORLD_SIZE / 2,
        Math.floor(Math.random() * 5),
        Math.floor(Math.random() * WORLD_SIZE) - WORLD_SIZE / 2
      )
      scene.add(block)
    }

    // Raycaster for block placement
    const raycaster = new THREE.Raycaster()
    const mouse = new THREE.Vector2()

    // Block placement function
    const placeBlock = (event: MouseEvent | Touch) => {
      const rect = renderer.domElement.getBoundingClientRect()
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1

      raycaster.setFromCamera(mouse, camera)

      const intersects = raycaster.intersectObjects(scene.children)

      if (intersects.length > 0) {
        const intersect = intersects[0]
        const newBlock = new THREE.Mesh(blockGeometry, blockMaterial)
        newBlock.position.copy(intersect.point).add(intersect.face!.normal)
        newBlock.position.divideScalar(BLOCK_SIZE).floor().multiplyScalar(BLOCK_SIZE).addScalar(BLOCK_SIZE / 2)
        scene.add(newBlock)
      }
    }

    // Event listeners
    renderer.domElement.addEventListener('click', placeBlock)
    renderer.domElement.addEventListener('touchstart', (e) => placeBlock(e.touches[0]))

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate)
      controls.update()
      renderer.render(scene, camera)
    }
    animate()

    // Handle window resize
    const handleResize = () => {
      if (!mountRef.current) return
      const newAspect = mountRef.current.clientWidth / mountRef.current.clientHeight
      camera.aspect = newAspect
      camera.updateProjectionMatrix()
      renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight)
    }
    window.addEventListener('resize', handleResize)

    // Cleanup
    return () => {
      if (mountRef.current) {
        mountRef.current.removeChild(renderer.domElement)
      }
      window.removeEventListener('resize', handleResize)
      renderer.domElement.removeEventListener('click', placeBlock)
      renderer.domElement.removeEventListener('touchstart', (e) => placeBlock(e.touches[0]))
    }
  }, [isPlaying])

  return (
    <div ref={mountRef} className="w-full h-full relative">
      {!isPlaying && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-70">
          <button
            className="px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
            onClick={() => setIsPlaying(true)}
          >
            Start Minecraft
          </button>
        </div>
      )}
      {isPlaying && (
        <div className="absolute bottom-4 left-4 right-4 flex justify-center">
          <div className="bg-black bg-opacity-50 text-white p-2 rounded">
            {isMobile ? 'Tap to place blocks' : 'Click to place blocks'}
          </div>
        </div>
      )}
    </div>
  )
}
