import { Suspense, useRef, useEffect, useState, Component } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import AvatarPuppet from "./AvatarPuppet";

// Catches Three.js render errors so they don't crash the whole page
class AvatarErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { failed: false }; }
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return this.props.fallback;
    return this.props.children;
  }
}

// ── Neutral teacher avatar from Ready Player Me ────────────────────────────
// To use your own avatar: create one at https://readyplayer.me, then replace the ID below
const AVATAR_URL =
  "https://models.readyplayer.me/6386aff88e9db6c4f73f3fa2.glb" +
  "?morphTargets=ARKit&textureAtlas=1024";

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
// Checks URL reachability first — avoids React Suspense throw + error banner
// when the RPM domain is blocked or offline.
export default function AvatarHead3D({ isSpeaking, isDarkMode }) {
  // "checking" | "ok" | "failed"
  const [urlStatus, setUrlStatus] = useState("checking");
  const [webGlError, setWebGlError] = useState(false);

  useEffect(() => {
    const ctrl = new AbortController();
    fetch(AVATAR_URL, { method: "HEAD", mode: "no-cors", signal: ctrl.signal })
      .then(() => { if (!ctrl.signal.aborted) setUrlStatus("ok"); })
      .catch(() => { if (!ctrl.signal.aborted) setUrlStatus("failed"); });
    return () => ctrl.abort();
  }, []);

  // Puppet in all failure cases — no error banner, no React Suspense throw
  if (urlStatus === "failed" || webGlError) {
    return <AvatarPuppet isSpeaking={isSpeaking} isDarkMode={isDarkMode} />;
  }

  // Still probing the network
  if (urlStatus === "checking") {
    return <Spinner isDarkMode={isDarkMode} />;
  }

  // URL reachable — attempt Three.js; AvatarErrorBoundary catches any GL errors
  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <AvatarErrorBoundary fallback={<AvatarPuppet isSpeaking={isSpeaking} isDarkMode={isDarkMode} />}>
        <Suspense fallback={<Spinner isDarkMode={isDarkMode} />}>
          <Canvas
            camera={{ position: [0, 1.63, 0.62], fov: 28 }}
            gl={{ antialias: true, failIfMajorPerformanceCaveat: false }}
            onCreated={({ gl }) => {
              if (!gl) { setWebGlError(true); return; }
              gl.domElement.addEventListener("webglcontextlost", (e) => {
                e.preventDefault();
                setWebGlError(true);
              }, { once: true });
            }}
            style={{ width: "100%", height: "100%", borderRadius: 16 }}
          >
            <AvatarScene isSpeaking={isSpeaking} />
          </Canvas>
        </Suspense>
      </AvatarErrorBoundary>
    </div>
  );
}
