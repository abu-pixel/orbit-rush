import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react';
import { Route, Switch, Router as WouterRouter } from 'wouter';
import { Check, CircleHelp, Gamepad2, Pause, Play, RotateCcw, Sparkles, Trophy, Zap } from 'lucide-react';
import { FIELD, OrbitGame, TRAILS, getTrailColor, getUnlockedTrails, type GameSnapshot, type TrailId, type Vector } from './game/engine';
import { DEFAULT_PROGRESS, loadProgress, saveProgress, type Progress } from './game/progress';

function App() {
  return (
    <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
      <Switch>
        <Route path="/" component={OrbitRush} />
        <Route><OrbitRush /></Route>
      </Switch>
    </WouterRouter>
  );
}

function OrbitRush() {
  const [progress, setProgress] = useState<Progress>(() => loadProgress() ?? { ...DEFAULT_PROGRESS });
  const gameRef = useRef<OrbitGame | null>(null);
  if (!gameRef.current) gameRef.current = new OrbitGame(progress.bestScore, progress.selectedTrail);
  const [snapshot, setSnapshot] = useState<GameSnapshot>(() => gameRef.current!.getSnapshot());
  const snapshotRef = useRef(snapshot);
  const [storageAvailable, setStorageAvailable] = useState(true);
  const [now, setNow] = useState(0);
  const handledRun = useRef(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const keyState = useRef({ x: 0, y: 0 });

  const publish = useCallback((next: GameSnapshot) => {
    snapshotRef.current = next;
    setSnapshot(next);
    if (next.status === 'playing') setNow(next.elapsed);
    if (next.status === 'over' && !handledRun.current) {
      handledRun.current = true;
      setProgress((previous) => {
        const updated: Progress = {
          ...previous,
          bestScore: Math.max(previous.bestScore, next.score),
          totalSparks: previous.totalSparks + next.sparksCollected,
          totalRuns: previous.totalRuns + 1,
        };
        setStorageAvailable(saveProgress(updated));
        return updated;
      });
    }
  }, []);

  const startRun = useCallback(() => {
    handledRun.current = false;
    gameRef.current?.setTrail(progress.selectedTrail);
    gameRef.current?.start();
    const next = gameRef.current!.getSnapshot();
    publish(next);
    setNow(0);
  }, [progress.selectedTrail, publish]);

  const pauseGame = useCallback(() => {
    gameRef.current?.pause();
    publish(gameRef.current!.getSnapshot());
  }, [publish]);

  const resumeGame = useCallback(() => {
    gameRef.current?.resume();
    publish(gameRef.current!.getSnapshot());
  }, [publish]);

  const dash = useCallback(() => {
    gameRef.current?.dash();
    publish(gameRef.current!.getSnapshot());
  }, [publish]);

  const selectTrail = useCallback((trail: TrailId) => {
    const unlocked = getUnlockedTrails(progress.totalSparks);
    if (!unlocked.includes(trail)) return;
    const updated = { ...progress, selectedTrail: trail };
    setProgress(updated);
    gameRef.current?.setTrail(trail);
    publish(gameRef.current!.getSnapshot());
    setStorageAvailable(saveProgress(updated));
  }, [progress, publish]);

  useEffect(() => {
    let frame = 0;
    let last = 0;
    let lastUi = 0;
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;

    const draw = (time: number) => {
      const dt = last ? Math.min((time - last) / 1000, 0.05) : 0;
      last = time;
      const game = gameRef.current!;
      if (snapshotRef.current.status === 'playing') {
        const updated = game.update(dt);
        snapshotRef.current = updated;
        if (updated.status === 'over' || time - lastUi > 90) {
          publish(updated);
          lastUi = time;
        }
      }
      const s = snapshotRef.current;
      drawArena(context, s, time);
      if (s.status === 'playing' && time - lastUi > 90) {
        setNow(s.elapsed);
        lastUi = time;
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [publish]);

  const updatePointer = (event: PointerEvent<HTMLCanvasElement>) => {
    if (snapshotRef.current.status !== 'playing') return;
    const rect = event.currentTarget.getBoundingClientRect();
    const target: Vector = {
      x: Math.max(0, Math.min(FIELD.width, ((event.clientX - rect.left) / rect.width) * FIELD.width)),
      y: Math.max(0, Math.min(FIELD.height, ((event.clientY - rect.top) / rect.height) * FIELD.height)),
    };
    gameRef.current?.setPointerTarget(target);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(key)) event.preventDefault();
      if (key === 'p' || key === 'escape') {
        if (snapshotRef.current.status === 'playing') pauseGame();
        else if (snapshotRef.current.status === 'paused') resumeGame();
        return;
      }
      if (key === ' ' && snapshotRef.current.status === 'playing') {
        dash();
        return;
      }
      if (key === 'arrowup' || key === 'w') keyState.current.y = -1;
      if (key === 'arrowdown' || key === 's') keyState.current.y = 1;
      if (key === 'arrowleft' || key === 'a') keyState.current.x = -1;
      if (key === 'arrowright' || key === 'd') keyState.current.x = 1;
      gameRef.current?.setPointerTarget(null);
      gameRef.current?.setKeyboardInput(keyState.current);
    };
    const onKeyUp = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (key === 'arrowup' || key === 'w') keyState.current.y = keyState.current.y === -1 ? 0 : keyState.current.y;
      if (key === 'arrowdown' || key === 's') keyState.current.y = keyState.current.y === 1 ? 0 : keyState.current.y;
      if (key === 'arrowleft' || key === 'a') keyState.current.x = keyState.current.x === -1 ? 0 : keyState.current.x;
      if (key === 'arrowright' || key === 'd') keyState.current.x = keyState.current.x === 1 ? 0 : keyState.current.x;
      gameRef.current?.setKeyboardInput(keyState.current);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [dash, pauseGame, resumeGame]);

  const unlocked = getUnlockedTrails(progress.totalSparks);
  const nextTrail = TRAILS.find((trail) => progress.totalSparks < trail.unlockAt);
  const progressStart = nextTrail ? TRAILS[TRAILS.indexOf(nextTrail) - 1]?.unlockAt ?? 0 : 60;
  const progressPercent = nextTrail ? Math.min(100, ((progress.totalSparks - progressStart) / (nextTrail.unlockAt - progressStart)) * 100) : 100;
  const currentStatus = snapshot.status;
  const formattedTime = formatTime(currentStatus === 'playing' ? now : snapshot.elapsed);
  const dashProgress = snapshot.dashReady ? 100 : Math.max(0, 100 - (snapshot.dashCooldown / 3) * 100);

  return (
    <main className="app-shell">
      <div className="app-content">
        <header className="topbar">
          <div className="brand">
            <div className="brand-mark" aria-hidden="true"><OrbitMark /></div>
            <div>
              <div className="brand-name">ORBIT <span>RUSH</span></div>
              <div className="brand-kicker">A little further, every run</div>
            </div>
          </div>
          <div className="top-status" data-testid="status-local-save"><span className="status-dot" /> {storageAvailable ? 'Local progress saved' : 'Progress stays in this session'}</div>
        </header>

        <div className="layout">
          <section className="game-column" aria-label="Orbit Rush game">
            <div className="intro-row">
              <div>
                <div className="eyebrow">SECTOR 07 / OPEN ORBIT</div>
                <h1 className="intro-title">Find your <em>flow.</em></h1>
              </div>
              <div className="run-index" data-testid="text-run-count">RUN {String(progress.totalRuns + (currentStatus === 'playing' || currentStatus === 'paused' ? 1 : 0)).padStart(2, '0')}</div>
            </div>

            <div className="arena-frame">
              <div className="arena-inner" data-testid="game-field">
                <canvas
                  ref={canvasRef}
                  width={FIELD.width}
                  height={FIELD.height}
                  className="game-canvas"
                  aria-label="Game field. Move with pointer or WASD and arrow keys. Collect sparks and avoid hazards."
                  role="img"
                  tabIndex={0}
                  onPointerMove={updatePointer}
                  onPointerDown={updatePointer}
                  onPointerLeave={() => gameRef.current?.setPointerTarget(null)}
                  data-testid="canvas-game-field"
                />
                <div className="arena-hud" aria-hidden="true">
                  <div className="hud-score">
                    <span className="hud-tag">SCORE</span>
                    <strong className="hud-value">{snapshot.score.toLocaleString()}</strong>
                  </div>
                  <div className="hud-right">
                    <div className="hud-chip"><strong>{snapshot.multiplier}×</strong><small>CHAIN</small></div>
                    <div className="hud-chip"><strong>{formattedTime}</strong><small>FLIGHT</small></div>
                  </div>
                </div>
                {currentStatus !== 'playing' && (
                  <div className="overlay" data-testid={`state-${currentStatus}`}>
                    <div className="overlay-card">
                      <div className="overlay-icon">
                        {currentStatus === 'ready' ? <Gamepad2 size={21} /> : currentStatus === 'paused' ? <Pause size={20} /> : <Sparkles size={20} />}
                      </div>
                      <h2 className="overlay-title">
                        {currentStatus === 'ready' ? 'Ready to drift?' : currentStatus === 'paused' ? 'Take your time.' : 'Run complete.'}
                      </h2>
                      <p className="overlay-copy">
                        {currentStatus === 'ready'
                          ? 'Slip through the incoming field. Gather sparks, build your chain, and see how long you can stay in orbit.'
                          : currentStatus === 'paused'
                            ? 'Your run is safely on hold. Nothing moves until you are ready.'
                            : snapshot.score > 0 && snapshot.score >= progress.bestScore
                              ? 'New personal best. Clean flying out there.'
                              : 'Every run leaves you a little sharper. Want another pass?'}
                      </p>
                      <div className="overlay-actions">
                        {currentStatus === 'ready' && <button className="button-primary" onClick={startRun} data-testid="button-start"><Play size={15} fill="currentColor" /> Start run <span aria-hidden="true">↗</span></button>}
                        {currentStatus === 'paused' && <button className="button-primary" onClick={resumeGame} data-testid="button-resume"><Play size={15} fill="currentColor" /> Resume run</button>}
                        {currentStatus === 'over' && <button className="button-primary" onClick={startRun} data-testid="button-replay"><RotateCcw size={15} /> Run it back</button>}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="arena-footer">
              <div className="controls-hint" aria-label="Controls">
                <span>STEER</span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd><span>or pointer</span>
                <span style={{ marginLeft: 5 }}>DASH</span><kbd>SPACE</kbd>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {currentStatus === 'playing' && <button className="button-quiet" onClick={pauseGame} aria-label="Pause run" data-testid="button-pause"><Pause size={14} /> Pause <kbd>P</kbd></button>}
                {currentStatus === 'playing' && <DashButton ready={snapshot.dashReady} progress={dashProgress} onClick={dash} />}
              </div>
            </div>
            {currentStatus === 'playing' && <div className="mobile-dash"><DashButton ready={snapshot.dashReady} progress={dashProgress} onClick={dash} /></div>}
          </section>

          <aside className="sidebar">
            <section className="panel" aria-label="Personal best and totals">
              <div className="panel-head"><h2 className="panel-title">Flight record</h2><span className="panel-index">01 / YOU</span></div>
              <div className="best-block">
                <div><div className="best-number" data-testid="text-best-score">{progress.bestScore.toLocaleString()}</div><div className="best-label">Personal best</div></div>
                <div className="best-medal" aria-hidden="true"><Trophy size={18} /></div>
              </div>
              <div className="stats-strip">
                <div className="stat-cell"><span className="stat-value" data-testid="text-total-sparks">{progress.totalSparks.toLocaleString()}</span><div className="stat-caption">Sparks found</div></div>
                <div className="stat-cell"><span className="stat-value" data-testid="text-total-runs">{progress.totalRuns.toLocaleString()}</span><div className="stat-caption">Runs flown</div></div>
              </div>
            </section>

            <section className="panel panel-trails" aria-label="Trail cosmetics">
              <div className="panel-head"><h2 className="panel-title">Pilot trail</h2><span className="panel-index">02 / STYLE</span></div>
              <div className="trail-list" data-testid="list-trails">
                {TRAILS.map((trail) => {
                  const isUnlocked = unlocked.includes(trail.id);
                  const selected = progress.selectedTrail === trail.id;
                  return (
                    <button
                      key={trail.id}
                      className={`trail-option ${selected ? 'selected' : ''}`}
                      disabled={!isUnlocked}
                      onClick={() => selectTrail(trail.id)}
                      aria-pressed={selected}
                      data-testid={`button-trail-${trail.id}`}
                    >
                      <span className="trail-swatch" style={{ color: getTrailColor(trail.id), background: getTrailColor(trail.id) }} />
                      <span className="trail-meta"><span className="trail-name">{trail.name}</span><span className="trail-unlock">{isUnlocked ? (selected ? 'Equipped' : 'Ready to equip') : `${trail.unlockAt} lifetime sparks`}</span></span>
                      {selected && <Check size={14} className="trail-check" />}
                      {!isUnlocked && <span aria-label="Locked" style={{ color: '#707b91', fontSize: 12 }}>LOCK</span>}
                    </button>
                  );
                })}
              </div>
              <div style={{ marginTop: 15 }}>
                <div className="progress-head"><span>TRAIL COLLECTION</span><span>{progress.totalSparks} / {nextTrail?.unlockAt ?? 60}</span></div>
                <div className="progress-track" role="progressbar" aria-label="Progress toward next trail" aria-valuemin={0} aria-valuemax={nextTrail?.unlockAt ?? 60} aria-valuenow={progress.totalSparks}><div className="progress-fill" style={{ width: `${progressPercent}%` }} /></div>
                <div className="next-unlock" data-testid="text-next-unlock">{nextTrail ? `${nextTrail.unlockAt - progress.totalSparks} more sparks to unlock ${nextTrail.name}` : 'Every trail unlocked. Nice work.'}</div>
              </div>
            </section>

            <section className="panel panel-how" aria-label="How to play">
              <div className="panel-head"><h2 className="panel-title">Quick briefing</h2><span className="panel-index">03 / HOW TO</span></div>
              <div className="how-list">
                <div className="how-row"><span className="how-num">01</span><span>Steer between hazards. One collision ends the run.</span></div>
                <div className="how-row"><span className="how-num">02</span><span>Collect sparks for <strong style={{ color: '#c8d1e1', fontWeight: 500 }}>65 × chain</strong> points. Every 3 pickups raises your multiplier.</span></div>
                <div className="how-row"><span className="how-num">03</span><span>Dash for a brief shield. It recharges in 3 seconds. Pause any time with <kbd>P</kbd>.</span></div>
              </div>
            </section>
          </aside>
        </div>

        <footer className="footnote">
          <span><strong>YOUR ORBIT, YOUR PACE.</strong> Progress lives on this device.</span>
          <span>NO ACCOUNTS · NO EXPIRY <CircleHelp size={11} style={{ verticalAlign: 'middle', marginLeft: 4 }} /></span>
        </footer>
      </div>
    </main>
  );
}

function DashButton({ ready, progress, onClick }: { ready: boolean; progress: number; onClick: () => void }) {
  return (
    <button className="button-dash" onClick={onClick} disabled={!ready} aria-label={ready ? 'Dash with shield' : `Dash recharging`} data-testid="button-dash">
      <Zap size={14} /> {ready ? 'Dash ready' : 'Recharge'}
      <span className="dash-meter"><i style={{ width: `${progress}%` }} /></span>
    </button>
  );
}

function drawArena(ctx: CanvasRenderingContext2D, s: GameSnapshot, time: number) {
  const w = FIELD.width;
  const h = FIELD.height;
  ctx.clearRect(0, 0, w, h);
  const bg = ctx.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, '#11172b');
  bg.addColorStop(.55, '#10182a');
  bg.addColorStop(1, '#11162a');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // Quiet orbital haze and a fine coordinate grid make movement easy to read.
  const haze = ctx.createRadialGradient(480, 320, 20, 480, 320, 510);
  haze.addColorStop(0, 'rgba(31,79,91,.10)');
  haze.addColorStop(1, 'rgba(7,11,23,.32)');
  ctx.fillStyle = haze;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(141,166,205,.035)';
  ctx.lineWidth = 1;
  for (let x = 48; x < w; x += 48) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
  for (let y = 48; y < h; y += 48) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
  for (let i = 0; i < 92; i++) {
    const x = (i * 173.3 + Math.sin(i * 4.4) * 11) % w;
    const y = (i * 83.7 + Math.cos(i * 3.1) * 17) % h;
    const twinkle = .25 + (Math.sin(time * .0013 + i * 2) + 1) * .22;
    ctx.fillStyle = `rgba(193,218,255,${twinkle})`;
    ctx.beginPath();
    ctx.arc(x, y, i % 9 === 0 ? 1.7 : .85, 0, Math.PI * 2);
    ctx.fill();
  }
  // Corner coordinates.
  ctx.strokeStyle = 'rgba(120,245,216,.23)';
  ctx.lineWidth = 1;
  const corners = [[17,17,1,1],[w-17,17,-1,1],[17,h-17,1,-1],[w-17,h-17,-1,-1]];
  for (const [x,y,sx,sy] of corners) {
    ctx.beginPath(); ctx.moveTo(x + sx * 18, y); ctx.lineTo(x, y); ctx.lineTo(x, y + sy * 18); ctx.stroke();
  }
  s.sparks.forEach((spark) => {
    const pulse = 1 + Math.sin(spark.phase) * .13;
    ctx.save();
    ctx.translate(spark.x, spark.y);
    ctx.rotate(Math.PI / 4);
    ctx.shadowColor = '#ffd27a'; ctx.shadowBlur = 18;
    ctx.fillStyle = '#ffd27a';
    ctx.fillRect(-spark.radius * pulse, -spark.radius * pulse, spark.radius * 2 * pulse, spark.radius * 2 * pulse);
    ctx.restore();
    ctx.beginPath(); ctx.arc(spark.x, spark.y, 13 + Math.sin(spark.phase) * 2, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,210,122,.24)'; ctx.lineWidth = 1; ctx.stroke();
  });
  s.hazards.forEach((hazard) => {
    ctx.save();
    ctx.translate(hazard.x, hazard.y);
    ctx.rotate(hazard.rotation);
    ctx.shadowColor = 'rgba(255,111,128,.35)'; ctx.shadowBlur = 16;
    ctx.fillStyle = '#f27686';
    ctx.strokeStyle = '#ffadb5';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const radius = hazard.radius * (i % 2 === 0 ? 1 : .73);
      const angle = (i / 8) * Math.PI * 2;
      const px = Math.cos(angle) * radius; const py = Math.sin(angle) * radius;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  });
  const color = getTrailColor(s.trail);
  const p = s.player;
  // Tail draws opposite recent movement using visible nearby hazard vectors / gentle time drift.
  const tailX = p.x - 15;
  const tailY = p.y + Math.sin(time * .004) * 2;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.lineWidth = 4;
  ctx.globalAlpha = .25;
  ctx.beginPath(); ctx.moveTo(tailX - 17, tailY); ctx.lineTo(tailX + 2, tailY); ctx.stroke();
  ctx.globalAlpha = .48;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(tailX - 15, tailY); ctx.lineTo(tailX + 2, tailY); ctx.stroke();
  ctx.shadowColor = color; ctx.shadowBlur = 22;
  ctx.fillStyle = s.status === 'playing' && p.invulnerable && Math.floor(time / 70) % 2 === 0 ? '#ffffff' : color;
  ctx.beginPath();
  ctx.moveTo(p.x + 13, p.y);
  ctx.lineTo(p.x - 8, p.y - 8);
  ctx.lineTo(p.x - 5, p.y);
  ctx.lineTo(p.x - 8, p.y + 8);
  ctx.closePath(); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(p.x, p.y, p.radius + 7 + Math.sin(time * .005) * 1.5, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
}

function formatTime(seconds: number) {
  const total = Math.floor(seconds);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function OrbitMark() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="7.1" stroke="currentColor" strokeWidth="1.4" opacity=".52" />
      <ellipse cx="11" cy="11" rx="10" ry="4.1" stroke="currentColor" strokeWidth="1.3" transform="rotate(-38 11 11)" />
      <circle cx="16.2" cy="5" r="1.7" fill="currentColor" />
      <path d="M10.2 8.3 14 11l-4.4 2.7.6-2.7-.6-2.7Z" fill="currentColor" />
    </svg>
  );
}

export default App;
