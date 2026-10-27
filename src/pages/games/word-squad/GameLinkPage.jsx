// src/pages/games/word-squad/GameLinkPage.jsx
// Public page for a Word Squad game link (managed students — no login), at /g/:token.
// Same name check as homework and quiz links (HeroLinkKit), then the normal game,
// playing through /games/link/<token>/word-squad. Server side: "Play by link" in
// server/routes/gameRoutes.js.
import { lazy, Suspense, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { HeroPage, HeroGate, HeroNotice, HeroLoading, useShareLinkSession } from '../../../components/hero/HeroLinkKit';

const WordSquadPage = lazy(() => import('./WordSquadPage'));

export default function GameLinkPage() {
  const { token } = useParams();
  const basePath = `/games/link/${token}`;
  const s = useShareLinkSession({ basePath, dataKey: 'game', storageKey: `gmAccess:${token?.slice(0, 12)}` });
  const access = s.phase === 'view' ? s.headers() : null;
  const accessKey = access && Object.values(access)[0];
  // Stable while the access token is the same, so the game doesn't reload its list
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const link = useMemo(() => (accessKey ? { base: `${basePath}/word-squad`, headers: access } : null), [accessKey, basePath]);

  if (link) {
    return (
      <Suspense fallback={<HeroPage><HeroLoading text="Getting the squad ready…" /></HeroPage>}>
        <WordSquadPage link={link} />
      </Suspense>
    );
  }
  return (
    <HeroPage>
      {s.phase === 'loading' && <HeroLoading text="Loading your game…" />}
      {s.phase === 'invalid' && <HeroNotice title="Oops! This link doesn't work" text={s.message || "Please ask your teacher for a new link."} />}
      {s.phase === 'expired' && <HeroNotice title="This game has ended" text={s.message || 'Ask your teacher if you want to play again.'} />}
      {s.phase === 'gate' && (
        <HeroGate unlockPath={`${basePath}/unlock`} subtitle="Your teacher sent you a Word Squad game!"
          onUnlocked={s.onUnlocked} onFailure={s.onFailure} buttonLabel="Play Word Squad!" />
      )}
    </HeroPage>
  );
}
