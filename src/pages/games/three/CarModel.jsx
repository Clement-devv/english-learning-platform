import React, { forwardRef } from "react";
import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";

const CarModel = forwardRef((props, ref) => {
  const { scene } = useGLTF("/src/assets/models/car.glb");
  const carRef = ref || useRef();

  // Optional: simple bounce animation
  useFrame((state) => {
    if (carRef.current) {
      const t = state.clock.getElapsedTime();
      carRef.current.rotation.y = Math.sin(t * 0.5) * 0.1; // gentle tilt
    }
  });

  return (
    <primitive
      ref={carRef}
      object={scene}
      position={[0, 0.3, 0]}
      scale={[0.8, 0.8, 0.8]}
      {...props}
    />
  );
});

export default CarModel;

// Optional performance optimization
useGLTF.preload("/src/assets/models/car.glb");
