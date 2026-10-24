export const FIELD = { width: 960, height: 640 } as const;

export type GameStatus = "ready" | "playing" | "paused" | "over";
export type TrailId = "ion" | "solar" | "nova" | "prism";

export interface Vector {
  x: number;
  y: number;
}

export interface Hazard extends Vector {
  id: number;
  radius: number;
  vx: number;
  vy: number;
  rotation: number;
  spin: number;
}

export interface Spark extends Vector {
  id: number;
  radius: number;
  vx: number;
  vy: number;
  phase: number;
}

export interface GameSnapshot {
  status: GameStatus;
  player: Vector & { radius: number; invulnerable: boolean };
  hazards: Hazard[];
  sparks: Spark[];
  score: number;
  elapsed: number;
  combo: number;
  multiplier: number;
  sparksCollected: number;
  bestScore: number;
  dashCooldown: number;
  dashReady: boolean;
  trail: TrailId;
}

const PLAYER_RADIUS = 10;
const PLAYER_MARGIN = 24;
const TRAIL_COLORS: Record<TrailId, string> = {
  ion: "#6bf1ff",
  solar: "#ffbd67",
  nova: "#c69cff",
  prism: "#73f4c0",
};

export const TRAILS: { id: TrailId; name: string; unlockAt: number }[] = [
  { id: "ion", name: "Ion", unlockAt: 0 },
  { id: "solar", name: "Solar", unlockAt: 10 },
  { id: "nova", name: "Nova", unlockAt: 30 },
  { id: "prism", name: "Prism", unlockAt: 60 },
];

export function getTrailColor(trail: TrailId): string {
  return TRAIL_COLORS[trail];
}

export function getUnlockedTrails(totalSparks: number): TrailId[] {
  return TRAILS.filter((trail) => totalSparks >= trail.unlockAt).map(
    (trail) => trail.id,
  );
}

export class OrbitGame {
  private state: GameSnapshot;
  private pointerTarget: Vector | null = null;
  private keyboardInput: Vector = { x: 0, y: 0 };
  private velocity: Vector = { x: 0, y: 0 };
  private hazards: Hazard[] = [];
  private sparks: Spark[] = [];
  private nextId = 1;
  private hazardTimer = 0.8;
  private sparkTimer = 1.25;
  private comboTimer = 0;
  private dashTime = 0;
  private invulnerabilityTime = 0;
  private lastDirection: Vector = { x: 1, y: 0 };
  private sparkPoints = 0;
  private bestScore: number;
  private trail: TrailId;

  constructor(bestScore = 0, trail: TrailId = "ion") {
    this.bestScore = bestScore;
    this.trail = trail;
    this.state = this.initialState();
  }

  private initialState(): GameSnapshot {
    return {
      status: "ready",
      player: {
        x: FIELD.width / 2,
        y: FIELD.height / 2,
        radius: PLAYER_RADIUS,
        invulnerable: false,
      },
      hazards: [],
      sparks: [],
      score: 0,
      elapsed: 0,
      combo: 0,
      multiplier: 1,
      sparksCollected: 0,
      bestScore: this.bestScore,
      dashCooldown: 0,
      dashReady: true,
      trail: this.trail,
    };
  }

  getSnapshot(): GameSnapshot {
    return this.state;
  }

  setTrail(trail: TrailId): void {
    this.trail = trail;
    this.state = { ...this.state, trail };
  }

  start(): void {
    this.pointerTarget = null;
    this.keyboardInput = { x: 0, y: 0 };
    this.velocity = { x: 0, y: 0 };
    this.hazards = [];
    this.sparks = [];
    this.nextId = 1;
    this.hazardTimer = 0.7;
    this.sparkTimer = 1.1;
    this.comboTimer = 0;
    this.dashTime = 0;
    this.invulnerabilityTime = 0;
    this.lastDirection = { x: 1, y: 0 };
    this.sparkPoints = 0;
    this.state = {
      ...this.initialState(),
      status: "playing",
    };
  }

  pause(): void {
    if (this.state.status === "playing") {
      this.state = { ...this.state, status: "paused" };
      this.pointerTarget = null;
      this.keyboardInput = { x: 0, y: 0 };
    }
  }

  resume(): void {
    if (this.state.status === "paused") {
      this.state = { ...this.state, status: "playing" };
    }
  }

  setPointerTarget(target: Vector | null): void {
    this.pointerTarget = target;
  }

  setKeyboardInput(input: Vector): void {
    this.keyboardInput = normalize(input);
  }

  dash(): void {
    if (this.state.status !== "playing" || !this.state.dashReady) return;

    let direction = this.pointerTarget
      ? normalize({
          x: this.pointerTarget.x - this.state.player.x,
          y: this.pointerTarget.y - this.state.player.y,
        })
      : normalize(this.keyboardInput);
    if (direction.x === 0 && direction.y === 0) direction = this.lastDirection;

    this.velocity = { x: direction.x * 700, y: direction.y * 700 };
    this.dashTime = 0.19;
    this.invulnerabilityTime = 0.48;
    this.state = { ...this.state, dashCooldown: 3, dashReady: false };
  }

  update(deltaSeconds: number): GameSnapshot {
    if (this.state.status !== "playing") return this.state;

    const dt = Math.min(Math.max(deltaSeconds, 0), 0.05);
    if (dt === 0) return this.state;

    const elapsed = this.state.elapsed + dt;
    let { x, y } = this.state.player;
    const input = this.pointerTarget
      ? normalize({
          x: this.pointerTarget.x - x,
          y: this.pointerTarget.y - y,
        })
      : this.keyboardInput;
    const speed = this.dashTime > 0 ? 700 : 340;

    if (input.x || input.y) {
      this.lastDirection = input;
      const targetVx = input.x * speed;
      const targetVy = input.y * speed;
      const steering = this.dashTime > 0 ? 16 : 10;
      this.velocity.x += (targetVx - this.velocity.x) * Math.min(1, steering * dt);
      this.velocity.y += (targetVy - this.velocity.y) * Math.min(1, steering * dt);
    } else {
      const friction = Math.exp(-7 * dt);
      this.velocity.x *= friction;
      this.velocity.y *= friction;
    }

    x = clamp(x + this.velocity.x * dt, PLAYER_MARGIN, FIELD.width - PLAYER_MARGIN);
    y = clamp(y + this.velocity.y * dt, PLAYER_MARGIN, FIELD.height - PLAYER_MARGIN);

    this.dashTime = Math.max(0, this.dashTime - dt);
    this.invulnerabilityTime = Math.max(0, this.invulnerabilityTime - dt);

    this.hazardTimer -= dt;
    if (this.hazardTimer <= 0) {
      this.spawnHazard(elapsed, x, y);
      this.hazardTimer = Math.max(0.35, 0.94 - elapsed * 0.006) * (0.82 + Math.random() * 0.36);
    }

    this.sparkTimer -= dt;
    if (this.sparkTimer <= 0) {
      this.spawnSpark();
      this.sparkTimer = 1.2 + Math.random() * 0.7;
    }

    this.hazards = this.hazards
      .map((hazard) => ({
        ...hazard,
        x: hazard.x + hazard.vx * dt,
        y: hazard.y + hazard.vy * dt,
        rotation: hazard.rotation + hazard.spin * dt,
      }))
      .filter(
        (hazard) =>
          hazard.x > -60 &&
          hazard.x < FIELD.width + 60 &&
          hazard.y > -60 &&
          hazard.y < FIELD.height + 60,
      );

    this.sparks = this.sparks
      .map((spark) => ({
        ...spark,
        x: spark.x + spark.vx * dt,
        y: spark.y + spark.vy * dt,
        phase: spark.phase + dt * 3,
      }))
      .filter(
        (spark) =>
          spark.x > -40 &&
          spark.x < FIELD.width + 40 &&
          spark.y > -40 &&
          spark.y < FIELD.height + 40,
      );

    let combo = this.state.combo;
    let multiplier = this.state.multiplier;
    let sparksCollected = this.state.sparksCollected;
    let score = elapsed * 7 + this.sparkPoints;
    this.comboTimer = Math.max(0, this.comboTimer - dt);
    if (this.comboTimer === 0 && combo > 0) {
      combo = 0;
      multiplier = 1;
    }

    const collected = new Set<number>();
    for (const spark of this.sparks) {
      if (distance(x, y, spark.x, spark.y) < PLAYER_RADIUS + spark.radius + 3) {
        collected.add(spark.id);
        combo += 1;
        multiplier = Math.min(5, 1 + Math.floor((combo - 1) / 3));
        sparksCollected += 1;
        this.sparkPoints += 65 * multiplier;
        score += 65 * multiplier;
        this.comboTimer = 3.6;
      }
    }
    if (collected.size) this.sparks = this.sparks.filter((spark) => !collected.has(spark.id));

    const invulnerable = this.invulnerabilityTime > 0;
    const hit = !invulnerable && this.hazards.some(
      (hazard) =>
        distance(x, y, hazard.x, hazard.y) <
        PLAYER_RADIUS + hazard.radius * 0.76,
    );

    const nextScore = Math.floor(score);
    const bestScore = hit ? Math.max(this.bestScore, nextScore) : this.bestScore;
    if (hit) this.bestScore = bestScore;

    const cooldown = Math.max(0, this.state.dashCooldown - dt);
    this.state = {
      status: hit ? "over" : "playing",
      player: { x, y, radius: PLAYER_RADIUS, invulnerable },
      hazards: this.hazards,
      sparks: this.sparks,
      score: nextScore,
      elapsed,
      combo,
      multiplier,
      sparksCollected,
      bestScore,
      dashCooldown: cooldown,
      dashReady: cooldown <= 0,
      trail: this.trail,
    };
    return this.state;
  }

  private spawnHazard(elapsed: number, playerX: number, playerY: number): void {
    const side = Math.floor(Math.random() * 4);
    const edgeInset = 16;
    let x = 0;
    let y = 0;
    if (side === 0) {
      x = Math.random() * FIELD.width;
      y = -edgeInset;
    } else if (side === 1) {
      x = FIELD.width + edgeInset;
      y = Math.random() * FIELD.height;
    } else if (side === 2) {
      x = Math.random() * FIELD.width;
      y = FIELD.height + edgeInset;
    } else {
      x = -edgeInset;
      y = Math.random() * FIELD.height;
    }

    const direction = normalize({
      x: playerX + (Math.random() - 0.5) * 150 - x,
      y: playerY + (Math.random() - 0.5) * 150 - y,
    });
    const speed = 95 + Math.min(110, elapsed * 1.1) + Math.random() * 35;
    const radius = 12 + Math.random() * 10;
    this.hazards.push({
      id: this.nextId++,
      x,
      y,
      radius,
      vx: direction.x * speed,
      vy: direction.y * speed,
      rotation: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 3,
    });
  }

  private spawnSpark(): void {
    const side = Math.floor(Math.random() * 4);
    const centerX = FIELD.width / 2;
    const centerY = FIELD.height / 2;
    const x = side === 1 ? FIELD.width + 18 : side === 3 ? -18 : Math.random() * FIELD.width;
    const y = side === 0 ? -18 : side === 2 ? FIELD.height + 18 : Math.random() * FIELD.height;
    const direction = normalize({ x: centerX - x, y: centerY - y });
    this.sparks.push({
      id: this.nextId++,
      x,
      y,
      radius: 6,
      vx: direction.x * (20 + Math.random() * 18),
      vy: direction.y * (20 + Math.random() * 18),
      phase: Math.random() * Math.PI * 2,
    });
  }
}

function normalize(vector: Vector): Vector {
  const length = Math.hypot(vector.x, vector.y);
  if (!length) return { x: 0, y: 0 };
  return { x: vector.x / length, y: vector.y / length };
}

function distance(x1: number, y1: number, x2: number, y2: number): number {
  return Math.hypot(x2 - x1, y2 - y1);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
