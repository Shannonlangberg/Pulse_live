import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

const ThreeParticleEffect = ({ isRecording, isHovered, children }) => {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const particlesRef = useRef(null);
  const animationRef = useRef(null);
  const targetPositionsRef = useRef(null);
  const originalPositionsRef = useRef(null);

  // Vertex shader
  const vertexShader = `
    attribute float size;
    attribute float alpha;
    varying float vAlpha;
    varying vec3 vColor;
    
    void main() {
      vAlpha = alpha;
      vColor = vec3(0.7, 0.9, 1.0); // Light blue color
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      gl_PointSize = size * (300.0 / -mvPosition.z);
      gl_Position = projectionMatrix * mvPosition;
    }
  `;

  // Fragment shader
  const fragmentShader = `
    varying float vAlpha;
    varying vec3 vColor;
    
    void main() {
      vec2 center = gl_PointCoord - vec2(0.5);
      float dist = length(center);
      
      if (dist > 0.35) discard; // Slightly smaller particles
      
      // Create a softer, more subtle effect
      float intensity = 1.0 - smoothstep(0.0, 0.35, dist);
      intensity = pow(intensity, 1.5); // Softer falloff
      
      // Add a softer core for less harsh definition
      float core = 1.0 - smoothstep(0.0, 0.15, dist);
      intensity = max(intensity, core * 0.6); // Reduced core intensity
      
      gl_FragColor = vec4(vColor, vAlpha * intensity * 0.7); // Reduced overall intensity
    }
  `;

  useEffect(() => {
    if (!mountRef.current) return;

    // Scene setup
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Camera setup
    const camera = new THREE.PerspectiveCamera(
      75,
      mountRef.current.clientWidth / mountRef.current.clientHeight,
      0.1,
      1000
    );
    camera.position.z = 5;

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({ 
      alpha: true, 
      antialias: true 
    });
    renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    renderer.setClearColor(0x000000, 0); // Transparent background
    rendererRef.current = renderer;
    mountRef.current.appendChild(renderer.domElement);

    // Create particles
    const particleCount = 150; // Reduced from 300 to 150
    const positions = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);
    const alphas = new Float32Array(particleCount);
    const velocities = new Float32Array(particleCount * 3);

    // Initialize particles in a circular area
    for (let i = 0; i < particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.random() * 1.2; // Reduced from 1.5 to 1.2 for less spread
      
      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = Math.sin(angle) * radius;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 0.3; // Reduced depth
      
      sizes[i] = Math.random() * 0.5 + 0.2; // Reduced size
      alphas[i] = Math.random() * 0.5 + 0.2; // Reduced alpha for subtlety
      
      velocities[i * 3] = (Math.random() - 0.5) * 0.005; // Slower movement
      velocities[i * 3 + 1] = (Math.random() - 0.5) * 0.005;
      velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.005;
    }

    // Store original positions for smooth transitions
    originalPositionsRef.current = new Float32Array(positions);
    targetPositionsRef.current = new Float32Array(positions);

    // Create geometry and material
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute('alpha', new THREE.BufferAttribute(alphas, 1));

    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    const particles = new THREE.Points(geometry, material);
    scene.add(particles);
    particlesRef.current = particles;

    // Animation loop
    const animate = () => {
      animationRef.current = requestAnimationFrame(animate);

      const positions = particles.geometry.attributes.position.array;
      const alphas = particles.geometry.attributes.alpha.array;
      const originalPositions = originalPositionsRef.current;
      const targetPositions = targetPositionsRef.current;

      for (let i = 0; i < particleCount; i++) {
        // Update position with smooth transitions
        positions[i * 3] += velocities[i * 3];
        positions[i * 3 + 1] += velocities[i * 3 + 1];
        positions[i * 3 + 2] += velocities[i * 3 + 2];

        // Keep particles in bounds
        const x = positions[i * 3];
        const y = positions[i * 3 + 1];
        const z = positions[i * 3 + 2];

        if (Math.abs(x) > 1.5) velocities[i * 3] *= -1; // Changed from 1 to 1.5
        if (Math.abs(y) > 1.5) velocities[i * 3 + 1] *= -1; // Changed from 1 to 1.5
        if (Math.abs(z) > 0.5) velocities[i * 3 + 2] *= -1;

        // Smooth hover effect - gradually move towards center
        if (isHovered) {
          const centerAttraction = 0.015; // Increased for smoother, faster movement
          const targetX = originalPositions[i * 3] * 0.5; // Move towards center but not all the way
          const targetY = originalPositions[i * 3 + 1] * 0.5;
          
          // Use lerp for smoother interpolation
          positions[i * 3] += (targetX - positions[i * 3]) * centerAttraction;
          positions[i * 3 + 1] += (targetY - positions[i * 3 + 1]) * centerAttraction;
        } else {
          // Smooth return to original positions
          const returnSpeed = 0.02; // Increased for faster, smoother return
          positions[i * 3] += (originalPositions[i * 3] - positions[i * 3]) * returnSpeed;
          positions[i * 3 + 1] += (originalPositions[i * 3 + 1] - positions[i * 3 + 1]) * returnSpeed;
          positions[i * 3 + 2] += (originalPositions[i * 3 + 2] - positions[i * 3 + 2]) * returnSpeed;
        }

        // Enhanced movement during recording
        if (isRecording) {
          // Add more dynamic movement
          const recordingIntensity = 0.015;
          positions[i * 3] += (Math.random() - 0.5) * recordingIntensity;
          positions[i * 3 + 1] += (Math.random() - 0.5) * recordingIntensity;
          
          // Increase velocity during recording
          velocities[i * 3] *= 1.02;
          velocities[i * 3 + 1] *= 1.02;
          
          // Limit maximum velocity
          velocities[i * 3] = Math.max(-0.03, Math.min(0.03, velocities[i * 3]));
          velocities[i * 3 + 1] = Math.max(-0.03, Math.min(0.03, velocities[i * 3 + 1]));
        } else {
          // Gradually return to normal velocity
          velocities[i * 3] *= 0.99;
          velocities[i * 3 + 1] *= 0.99;
        }

        // Update alpha based on recording state
        if (isRecording) {
          alphas[i] = Math.min(0.9, alphas[i] + 0.02); // More intense during recording
        } else {
          alphas[i] = Math.max(0.2, alphas[i] - 0.008);
        }
      }

      particles.geometry.attributes.position.needsUpdate = true;
      particles.geometry.attributes.alpha.needsUpdate = true;

      // Rotate particles slightly
      particles.rotation.z += 0.001;

      renderer.render(scene, camera);
    };

    animate();

    // Handle resize
    const handleResize = () => {
      if (!mountRef.current) return;
      
      const width = mountRef.current.clientWidth;
      const height = mountRef.current.clientHeight;
      
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [isRecording, isHovered]);

  return (
    <div className="relative w-full h-full">
      <div 
        ref={mountRef} 
        className="absolute inset-0 pointer-events-none"
        style={{ zIndex: 20 }}
      />
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
};

export default ThreeParticleEffect; 