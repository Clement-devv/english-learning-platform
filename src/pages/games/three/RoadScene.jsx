import React from "react";
import { useFrame } from "@react-three/fiber";

export default function RoadScene() {
  return (
    <group>
      {/* Ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial color="#4ECA78" />
      </mesh>

      {/* Road */}
      <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[10, 100]} />
        <meshStandardMaterial color="#3A3A3A" />
      </mesh>
    </group>
  );
}
