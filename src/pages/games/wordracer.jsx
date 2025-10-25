import React, { useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Sky } from "@react-three/drei";
import RoadScene from "./three/RoadScene";
import CarModel from "./three/CarModel";
import WordSigns from "./three/WordSigns";
import UIOverlay from "./three/UIOverlay";

export default function WordRacer() {
  const carRef = useRef();
  const [score, setScore] = useState(0);

  return (
    <div className="relative w-screen h-screen bg-sky-200">
      <Canvas camera={{ position: [0, 2, 8], fov: 60 }}>
        <Sky sunPosition={[100, 20, 100]} />
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={1.5} />

        <RoadScene />
        <CarModel ref={carRef} />
        <WordSigns carRef={carRef} onScoreChange={setScore} />
      </Canvas>

      <UIOverlay score={score} />
    </div>
  );
}
