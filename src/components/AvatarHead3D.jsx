import { Suspense, useRef, useEffect, useState, lazy } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";

// ── Neutral teacher avatar from Ready Player Me ────────────────────────────
// To use your own avatar: create one at https://readyplayer.me, then replace the ID below
const AVATAR_URL =
  "https://models.readyplayer.me/6386aff88e9db6c4f73f3fa2.glb" +
  "?morphTargets=ARKit&textureAtlas=1024";

// Pre-warm the GLTF loader so the model is cached on first render
useGLTF.preload(AVATAR_URL);

// ── The actual 3D mesh ─────────────────────────────────────────────────────
function AvatarMesh({ isSpeaking }) {
  const { scene } = useGLTF(AVATAR_URL);
  const headRef   = useRef(null);   // the SkinnedMesh with morph targets
  const jawIdx    = useRef(null);   // index of the jawOpen morph target
  const clock     = useRef(0);

  // Find the face mesh and jaw morph target once the scene loads
  useEffect(() => {
    scene.traverse(node => {
      if (node.isMesh && node.morphTargetDictionary) {
        // RPM ARKit avatars expose "jawOpen"; some older ones use "mouthOpen"
        const idx =
          node.morphTargetDictionary["jawOpen"] ??
          node.morphTargetDictionary["mouthOpen"] ??
          null;
        if (idx !== null) {
          headRef.current = node;
          jawIdx.current  = idx;
        }
      }
    });
  }, [scene]);

  // Animate the jaw every frame
  useFrame((_, delta) => {
    if (!headRef.current || jawIdx.current === null) return;
    clock.current += delta;

    const influences = headRef.current.morphTargetInfluences;
    if (isSpeaking) {
      // Oscillate jaw open/close ~4–5 times per second
      influences[jawIdx.current] =
        (Math.sin(clock.current * 9) * 0.5 + 0.5) * 0.55;
    } else {
      // Smoothly close mouth
      influences[jawIdx.current] *= 0.8;
    }
  });

  return <primitive object={scene} />;
}

// ── Scene lighting + avatar ────────────────────────────────────────────────
function AvatarScene({ isSpeaking }) {
  return (
    <>
      <ambientLight intensity={1.1} />
      <directionalLight position={[0.5, 2, 1.5]} intensity={1.2} />
      <pointLight position={[-1, 1, 1]} intensity={0.4} />
      <Suspense fallback={null}>
        <AvatarMesh isSpeaking={isSpeaking} />
      </Suspense>
    </>
  );
}

// ── Loading spinner shown while GLTF downloads ────────────────────────────
function Spinner({ isDarkMode }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", height: "100%", gap: 10,
      color: isDarkMode ? "#a78bfa" : "#7c3aed", fontSize: 13, fontWeight: 700,
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: "50%",
        border: "3px solid #7c3aed30",
        borderTopColor: "#7c3aed",
        animation: "spin3d 0.9s linear infinite",
      }} />
      Loading avatar…
      <style>{`@keyframes spin3d { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ── Public component ───────────────────────────────────────────────────────
export default function AvatarHead3D({ isSpeaking, isDarkMode }) {
  const [webGlError, setWebGlError] = useState(false);

  if (webGlError) {
    return (
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        height: "100%", flexDirection: "column", gap: 8,
        color: isDarkMode ? "#a78bfa" : "#7c3aed", fontSize: 13, fontWeight: 700,
      }}>
        <span style={{ fontSize: 32 }}>🤖</span>
        3D not supported on this device
      </div>
    );
  }

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <Suspense fallback={<Spinner isDarkMode={isDarkMode} />}>
        <Canvas
          // Frame the avatar's head — RPM head centre is around y=1.63
          camera={{ position: [0, 1.63, 0.62], fov: 28 }}
          gl={{ antialias: true, failIfMajorPerformanceCaveat: false }}
          onCreated={({ gl }) => {
            if (!gl) setWebGlError(true);
          }}
          style={{ width: "100%", height: "100%", borderRadius: 16 }}
        >
          <AvatarScene isSpeaking={isSpeaking} />
        </Canvas>
      </Suspense>
    </div>
  );
}
