import React, { useRef, useState, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import wordChallenges from "../data/wordchallenges";

export default function WordSigns({ carRef, onScoreChange }) {
  const [currentChallenge, setCurrentChallenge] = useState(null);
  const [signs, setSigns] = useState([]);
  const groupRef = useRef();

  // Spawn signs for each challenge
  useEffect(() => {
    const challenge =
      wordChallenges[Math.floor(Math.random() * wordChallenges.length)];
    setCurrentChallenge(challenge);

    const newSigns = challenge.options.map((word, index) => ({
      word,
      z: -index * 10 - 10,
      x: (index - 1) * 4,
    }));
    setSigns(newSigns);
  }, []);

  // Collision + movement
  useFrame(() => {
    if (!carRef.current) return;

    const carPos = carRef.current.position;

    // Move signs toward player (simulate car driving)
    groupRef.current.children.forEach((child) => {
      child.position.z += 0.1;

      // Collision detection
      const distance = carPos.distanceTo(child.position);
      if (distance < 1) {
        const word = child.userData.word;
        if (word === currentChallenge.correct) {
          onScoreChange((prev) => prev + 1);
          child.visible = false;
        } else {
          onScoreChange((prev) => Math.max(0, prev - 1));
          child.visible = false;
        }
      }

      // Reset if out of view
      if (child.position.z > 5) child.visible = false;
    });
  });

  return (
    <group ref={groupRef}>
      {signs.map((sign, i) => (
        <mesh
          key={i}
          position={[sign.x, 1, sign.z]}
          userData={{ word: sign.word }}
        >
          <boxGeometry args={[2, 1, 0.2]} />
          <meshStandardMaterial color="#FFD93D" />

          {/* Text label */}
          <TextLabel text={sign.word} />
        </mesh>
      ))}
    </group>
  );
}

function TextLabel({ text }) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  ctx.font = "60px Comic Sans MS";
  ctx.fillStyle = "black";
  ctx.fillText(text, 10, 70);
  const texture = new THREE.CanvasTexture(canvas);

  return (
    <mesh position={[0, 0, 0.11]}>
      <planeGeometry args={[1.8, 0.5]} />
      <meshBasicMaterial map={texture} transparent />
    </mesh>
  );
}
