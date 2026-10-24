import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import {
  AppState,
  PanResponder,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
} from "react-native";
import Svg, {
  Circle,
  Defs,
  G,
  Line,
  Path,
  Polygon,
  RadialGradient,
  Rect,
  Stop,
} from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FIELD,
  getTrailColor,
  getUnlockedTrails,
  OrbitGame,
  TRAILS,
  type GameSnapshot,
  type TrailId,
  type Vector,
} from "../game/engine";
import {
  DEFAULT_PROGRESS,
  loadProgress,
  saveProgress,
  type Progress,
} from "../game/progress";
import { useColors } from "@/hooks/useColors";

const STARS = [
  [28, 52, 1.4],
  [86, 94, 1.1],
  [144, 38, 1.3],
  [204, 78, 1.1],
  [332, 54, 1.3],
  [390, 112, 1.5],
  [58, 184, 1.1],
  [372, 218, 1.1],
  [110, 282, 1.3],
  [316, 326, 1.2],
  [34, 424, 1.5],
  [148, 484, 1.1],
  [266, 432, 1.3],
  [390, 502, 1.2],
  [210, 526, 1.1],
] as const;

const FONT_DISPLAY = "SpaceGrotesk_600SemiBold";
const FONT_MEDIUM = "SpaceGrotesk_500Medium";
const FONT_BODY = "SpaceGrotesk_400Regular";
const FONT_MONO = "DMMono_400Regular";

export default function OrbitRushMobileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [progress, setProgress] = useState<Progress>(DEFAULT_PROGRESS);
  const progressRef = useRef<Progress>(DEFAULT_PROGRESS);
  const [snapshot, setSnapshot] = useState<GameSnapshot | null>(null);
  const snapshotRef = useRef<GameSnapshot | null>(null);
  const gameRef = useRef<OrbitGame | null>(null);
  const savedRunRef = useRef(false);
  const boardSizeRef = useRef({ width: 0, height: 0 });
  const [boardSize, setBoardSize] = useState({ width: 0, height: 0 });
  const [progressLoaded, setProgressLoaded] = useState(false);
  const [storageAvailable, setStorageAvailable] = useState(true);

  const setCurrentSnapshot = useCallback((next: GameSnapshot) => {
    snapshotRef.current = next;
    setSnapshot(next);
  }, []);

  useEffect(() => {
    let mounted = true;
    void loadProgress().then((loaded) => {
      if (!mounted) return;
      progressRef.current = loaded;
      setProgress(loaded);
      const game = new OrbitGame(loaded.bestScore, loaded.selectedTrail);
      gameRef.current = game;
      setCurrentSnapshot(game.getSnapshot());
      setProgressLoaded(true);
    });
    return () => {
      mounted = false;
    };
  }, [setCurrentSnapshot]);

  const recordRun = useCallback((result: GameSnapshot) => {
    if (savedRunRef.current) return;
    savedRunRef.current = true;

    const current = progressRef.current;
    const updated: Progress = {
      ...current,
      bestScore: Math.max(current.bestScore, result.score),
      totalSparks: current.totalSparks + result.sparksCollected,
      totalRuns: current.totalRuns + 1,
    };
    progressRef.current = updated;
    setProgress(updated);
    void saveProgress(updated).then(setStorageAvailable);
  }, []);

  useEffect(() => {
    const currentGame = gameRef.current;
    if (!currentGame || snapshot?.status !== "playing") return;

    let frameId = 0;
    let lastFrame = 0;
    let frameCount = 0;
    let lastSparkCount = currentGame.getSnapshot().sparksCollected;

    const frame = (now: number) => {
      if (lastFrame === 0) lastFrame = now;
      const deltaSeconds = (now - lastFrame) / 1000;
      lastFrame = now;

      const next = currentGame.update(deltaSeconds);
      frameCount += 1;

      if (next.sparksCollected > lastSparkCount) {
        lastSparkCount = next.sparksCollected;
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }

      if (next.status === "over") {
        setCurrentSnapshot(next);
        recordRun(next);
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return;
      }

      if (frameCount % 2 === 0) setCurrentSnapshot(next);
      frameId = requestAnimationFrame(frame);
    };

    frameId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(frameId);
  }, [recordRun, setCurrentSnapshot, snapshot?.status]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      const game = gameRef.current;
      if (
        nextState !== "active" &&
        game?.getSnapshot().status === "playing"
      ) {
        game.pause();
        setCurrentSnapshot(game.getSnapshot());
      }
    });
    return () => subscription.remove();
  }, [setCurrentSnapshot]);

  const steerTo = useCallback((localX: number, localY: number) => {
    const size = boardSizeRef.current;
    if (size.width <= 0 || size.height <= 0) return;
    const target: Vector = {
      x: (localX / size.width) * FIELD.width,
      y: (localY / size.height) * FIELD.height,
    };
    gameRef.current?.setPointerTarget(target);
  }, []);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () =>
          gameRef.current?.getSnapshot().status === "playing",
        onMoveShouldSetPanResponder: () =>
          gameRef.current?.getSnapshot().status === "playing",
        onPanResponderGrant: ({ nativeEvent }) =>
          steerTo(nativeEvent.locationX, nativeEvent.locationY),
        onPanResponderMove: ({ nativeEvent }) =>
          steerTo(nativeEvent.locationX, nativeEvent.locationY),
        onPanResponderRelease: () => gameRef.current?.setPointerTarget(null),
        onPanResponderTerminate: () => gameRef.current?.setPointerTarget(null),
      }),
    [steerTo],
  );

  const onBoardLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    const size = { width, height };
    boardSizeRef.current = size;
    setBoardSize(size);
  }, []);

  const startRun = useCallback(() => {
    if (!gameRef.current || !progressLoaded) return;
    savedRunRef.current = false;
    gameRef.current.start();
    setCurrentSnapshot(gameRef.current.getSnapshot());
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [progressLoaded, setCurrentSnapshot]);

  const pauseRun = useCallback(() => {
    const game = gameRef.current;
    if (!game) return;
    game.pause();
    setCurrentSnapshot(game.getSnapshot());
    void Haptics.selectionAsync();
  }, [setCurrentSnapshot]);

  const resumeRun = useCallback(() => {
    const game = gameRef.current;
    if (!game) return;
    game.resume();
    setCurrentSnapshot(game.getSnapshot());
    void Haptics.selectionAsync();
  }, [setCurrentSnapshot]);

  const dash = useCallback(() => {
    const game = gameRef.current;
    if (!game) return;
    game.dash();
    setCurrentSnapshot(game.getSnapshot());
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [setCurrentSnapshot]);

  const finishRun = useCallback(() => {
    const current = snapshotRef.current;
    if (current) recordRun(current);
    const latest = progressRef.current;
    const game = new OrbitGame(latest.bestScore, latest.selectedTrail);
    gameRef.current = game;
    savedRunRef.current = true;
    setCurrentSnapshot(game.getSnapshot());
  }, [recordRun, setCurrentSnapshot]);

  const selectTrail = useCallback(
    (trail: TrailId) => {
      if (!getUnlockedTrails(progressRef.current.totalSparks).includes(trail)) {
        return;
      }
      const updated = { ...progressRef.current, selectedTrail: trail };
      progressRef.current = updated;
      setProgress(updated);
      gameRef.current?.setTrail(trail);
      if (gameRef.current) setCurrentSnapshot(gameRef.current.getSnapshot());
      void saveProgress(updated).then(setStorageAvailable);
      void Haptics.selectionAsync();
    },
    [setCurrentSnapshot],
  );

  const status = snapshot?.status ?? "ready";
  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const webBottomInset = Platform.OS === "web" ? 34 : 0;
  const safeHeight =
    windowHeight - insets.top - insets.bottom - webTopInset - webBottomInset;
  const fieldAspectHeight = (Math.max(220, windowWidth - 28) * FIELD.height) / FIELD.width;
  const boardHeight = Math.max(
    220,
    Math.min(470, safeHeight - 245, fieldAspectHeight),
  );
  const boardWidth = (boardHeight * FIELD.width) / FIELD.height;
  const activeRun = status === "playing";

  if (!progressLoaded || !snapshot) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <StatusBar barStyle="light-content" />
        <View style={[styles.loadingMark, { borderColor: colors.primary }]}>
          <Feather name="navigation" size={23} color={colors.primary} />
        </View>
        <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
          Preparing your orbit…
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={[colors.background, colors.card, colors.background]}
        locations={[0, 0.52, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View
        style={[
          styles.content,
          {
            paddingTop: insets.top + webTopInset + 8,
            paddingBottom: insets.bottom + webBottomInset + 8,
          },
        ]}
      >
        <View style={styles.topbar}>
          <View style={styles.brand}>
            <View
              style={[
                styles.brandMark,
                { borderColor: colors.primary, backgroundColor: colors.card },
              ]}
            >
              <Feather name="navigation" size={17} color={colors.primary} />
            </View>
            <View>
              <Text style={[styles.brandName, { color: colors.foreground }]}>
                ORBIT <Text style={{ color: colors.primary }}>RUSH</Text>
              </Text>
              <Text style={[styles.brandKicker, { color: colors.mutedForeground }]}>
                A LITTLE FURTHER, EVERY RUN
              </Text>
            </View>
          </View>
          {activeRun ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Pause run"
              testID="button-pause-run"
              onPress={pauseRun}
              hitSlop={10}
              style={({ pressed }) => [
                styles.iconButton,
                { backgroundColor: colors.card, borderColor: colors.border },
                pressed && styles.pressed,
              ]}
            >
              <Feather name="pause" size={17} color={colors.foreground} />
            </Pressable>
          ) : (
            <View
              style={[
                styles.saveStatus,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: storageAvailable ? colors.primary : colors.destructive },
                ]}
              />
              <Text style={[styles.saveStatusText, { color: colors.mutedForeground }]}>
                {storageAvailable ? "SAVED ON THIS PHONE" : "SAVE UNAVAILABLE"}
              </Text>
            </View>
          )}
        </View>

        <View
          style={[
            styles.metrics,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Metric
            label={activeRun ? "SCORE" : "PERSONAL BEST"}
            value={formatScore(activeRun ? snapshot.score : progress.bestScore)}
            colors={colors}
            testID="text-current-score"
          />
          <View style={[styles.metricDivider, { backgroundColor: colors.border }]} />
          <Metric
            label={activeRun ? "SPARKS" : "LIFETIME SPARKS"}
            value={formatScore(
              activeRun ? snapshot.sparksCollected : progress.totalSparks,
            )}
            colors={colors}
            testID="text-total-sparks"
          />
          <View style={[styles.metricDivider, { backgroundColor: colors.border }]} />
          <Metric
            label={activeRun && snapshot.combo > 0 ? "CHAIN" : "RUNS"}
            value={
              activeRun && snapshot.combo > 0
                ? `×${snapshot.multiplier}`
                : formatScore(progress.totalRuns)
            }
            colors={colors}
            testID="text-run-metric"
            highlight={activeRun && snapshot.combo > 0}
          />
        </View>

        <View
          style={[
            styles.boardFrame,
            {
              width: boardWidth,
              height: boardHeight,
              borderColor: colors.border,
              backgroundColor: colors.background,
            },
          ]}
          onLayout={onBoardLayout}
          testID="game-board"
        >
          <GameScene snapshot={snapshot} colors={colors} />
          <View
            style={styles.touchPlane}
            pointerEvents={activeRun ? "auto" : "none"}
            accessibilityLabel="Drag your finger here to steer"
            {...panResponder.panHandlers}
          />
          {status === "ready" && (
            <View style={styles.overlay}>
              <View
                style={[
                  styles.overlayCard,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <View
                  style={[
                    styles.overlayIcon,
                    { backgroundColor: colors.secondary },
                  ]}
                >
                  <Feather name="navigation" size={19} color={colors.primary} />
                </View>
                <Text style={[styles.overlayTitle, { color: colors.foreground }]}>
                  Your first flight
                </Text>
                <Text style={[styles.overlayIntro, { color: colors.mutedForeground }]}>
                  Three things to know. Then you’re flying.
                </Text>
                <Instruction
                  number="01"
                  icon="move"
                  text="Drag anywhere in the field to steer."
                  colors={colors}
                />
                <Instruction
                  number="02"
                  icon="circle"
                  text="Collect the mint sparks to grow your score."
                  colors={colors}
                />
                <Instruction
                  number="03"
                  icon="zap"
                  text="Tap Dash to slip past danger. Pause any time."
                  colors={colors}
                />
                <Pressable
                  accessibilityRole="button"
                  testID="button-start-run"
                  onPress={startRun}
                  style={({ pressed }) => [
                    styles.primaryButton,
                    { backgroundColor: colors.primary },
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={[styles.primaryButtonText, { color: colors.primaryForeground }]}>
                    Start a run
                  </Text>
                  <Feather name="arrow-up-right" size={17} color={colors.primaryForeground} />
                </Pressable>
                <Text style={[styles.shieldNote, { color: colors.mutedForeground }]}>
                  You begin with a brief shield to get moving.
                </Text>
              </View>
            </View>
          )}
          {status === "paused" && (
            <View style={styles.overlay}>
              <View
                style={[
                  styles.overlayCard,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <View
                  style={[
                    styles.overlayIcon,
                    { backgroundColor: colors.secondary },
                  ]}
                >
                  <Feather name="pause" size={19} color={colors.primary} />
                </View>
                <Text style={[styles.overlayTitle, { color: colors.foreground }]}>
                  Paused
                </Text>
                <Text style={[styles.overlayIntro, { color: colors.mutedForeground }]}>
                  Take your time. Your progress is safe here.
                </Text>
                <Pressable
                  accessibilityRole="button"
                  testID="button-resume-run"
                  onPress={resumeRun}
                  style={({ pressed }) => [
                    styles.primaryButton,
                    { backgroundColor: colors.primary },
                    pressed && styles.pressed,
                  ]}
                >
                  <Feather name="play" size={17} color={colors.primaryForeground} />
                  <Text style={[styles.primaryButtonText, { color: colors.primaryForeground }]}>
                    Resume flight
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  testID="button-end-run"
                  onPress={finishRun}
                  style={({ pressed }) => [
                    styles.secondaryButton,
                    { borderColor: colors.border },
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={[styles.secondaryButtonText, { color: colors.foreground }]}>
                    Save and leave run
                  </Text>
                </Pressable>
              </View>
            </View>
          )}
          {status === "over" && (
            <View style={styles.overlay}>
              <View
                style={[
                  styles.overlayCard,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <View
                  style={[
                    styles.overlayIcon,
                    { backgroundColor: colors.secondary },
                  ]}
                >
                  <Feather name="award" size={19} color={colors.accent} />
                </View>
                <Text style={[styles.overlayTitle, { color: colors.foreground }]}>
                  Flight complete
                </Text>
                <Text style={[styles.finalScore, { color: colors.primary }]}>
                  {formatScore(snapshot.score)}
                </Text>
                <Text style={[styles.overlayIntro, { color: colors.mutedForeground }]}>
                  {snapshot.score >= progress.bestScore && snapshot.score > 0
                    ? "A new personal best."
                    : "Every flight moves your record forward."}
                </Text>
                <View style={styles.endStats}>
                  <Text style={[styles.endStat, { color: colors.mutedForeground }]}>
                    {formatScore(snapshot.sparksCollected)} sparks collected
                  </Text>
                  <Text style={[styles.endStat, { color: colors.mutedForeground }]}>
                    Best: {formatScore(progress.bestScore)}
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  testID="button-play-again"
                  onPress={startRun}
                  style={({ pressed }) => [
                    styles.primaryButton,
                    { backgroundColor: colors.primary },
                    pressed && styles.pressed,
                  ]}
                >
                  <Feather name="rotate-cw" size={17} color={colors.primaryForeground} />
                  <Text style={[styles.primaryButtonText, { color: colors.primaryForeground }]}>
                    Fly again
                  </Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>

        <View style={styles.bottomPanel}>
          {activeRun ? (
            <View style={styles.dashRow}>
              <View style={styles.dashCopy}>
                <Text style={[styles.dashTitle, { color: colors.foreground }]}>
                  Need room?
                </Text>
                <Text style={[styles.dashSubcopy, { color: colors.mutedForeground }]}>
                  Dash gives a short shield.
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  snapshot.dashReady
                    ? "Dash now"
                    : `Dash recharging, ${snapshot.dashCooldown.toFixed(1)} seconds`
                }
                accessibilityState={{ disabled: !snapshot.dashReady }}
                testID="button-dash"
                disabled={!snapshot.dashReady}
                onPress={dash}
                style={({ pressed }) => [
                  styles.dashButton,
                  {
                    backgroundColor: snapshot.dashReady ? colors.primary : colors.secondary,
                    borderColor: snapshot.dashReady ? colors.primary : colors.border,
                  },
                  pressed && snapshot.dashReady && styles.pressed,
                ]}
              >
                <Feather
                  name="zap"
                  size={18}
                  color={snapshot.dashReady ? colors.primaryForeground : colors.mutedForeground}
                />
                <Text
                  style={[
                    styles.dashButtonText,
                    {
                      color: snapshot.dashReady
                        ? colors.primaryForeground
                        : colors.mutedForeground,
                    },
                  ]}
                >
                  {snapshot.dashReady
                    ? "DASH"
                    : `${snapshot.dashCooldown.toFixed(1)}s`}
                </Text>
              </Pressable>
            </View>
          ) : (
            <TrailPicker
              progress={progress}
              selected={progress.selectedTrail}
              colors={colors}
              onSelect={selectTrail}
            />
          )}
        </View>

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: colors.mutedForeground }]}>
            YOUR ORBIT, YOUR PACE
          </Text>
          <Text style={[styles.footerText, { color: colors.mutedForeground }]}>
            NO STREAKS · NO LOST PROGRESS
          </Text>
        </View>
      </View>
    </View>
  );
}

function Metric({
  label,
  value,
  colors,
  testID,
  highlight = false,
}: {
  label: string;
  value: string;
  colors: ReturnType<typeof useColors>;
  testID: string;
  highlight?: boolean;
}) {
  return (
    <View style={styles.metric}>
      <Text style={[styles.metricLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text
        accessibilityLabel={`${label}: ${value}`}
        testID={testID}
        style={[
          styles.metricValue,
          { color: highlight ? colors.primary : colors.foreground },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

function Instruction({
  number,
  icon,
  text,
  colors,
}: {
  number: string;
  icon: React.ComponentProps<typeof Feather>["name"];
  text: string;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={styles.instruction}>
      <Text style={[styles.instructionNumber, { color: colors.primary }]}>{number}</Text>
      <Feather name={icon} size={15} color={colors.accent} />
      <Text style={[styles.instructionText, { color: colors.foreground }]}>{text}</Text>
    </View>
  );
}

function TrailPicker({
  progress,
  selected,
  colors,
  onSelect,
}: {
  progress: Progress;
  selected: TrailId;
  colors: ReturnType<typeof useColors>;
  onSelect: (trail: TrailId) => void;
}) {
  const unlocked = getUnlockedTrails(progress.totalSparks);
  const nextTrail = TRAILS.find((trail) => trail.unlockAt > progress.totalSparks);
  const remaining = nextTrail ? nextTrail.unlockAt - progress.totalSparks : 0;

  return (
    <View style={styles.trailPanel}>
      <View style={styles.trailHeader}>
        <Text style={[styles.trailTitle, { color: colors.foreground }]}>
          Pilot trail
        </Text>
        <Text style={[styles.trailProgress, { color: colors.mutedForeground }]}>
          {nextTrail ? `${remaining} TO NEXT` : "ALL UNLOCKED"}
        </Text>
      </View>
      <View style={styles.trailOptions}>
        {TRAILS.map((trail) => {
          const isUnlocked = unlocked.includes(trail.id);
          const isSelected = selected === trail.id;
          const trailColor = getTrailColor(trail.id);
          return (
            <Pressable
              key={trail.id}
              accessibilityRole="button"
              accessibilityState={{ disabled: !isUnlocked, selected: isSelected }}
              accessibilityLabel={
                isUnlocked
                  ? `${trail.name} trail${isSelected ? ", equipped" : ""}`
                  : `${trail.name} trail, unlock at ${trail.unlockAt} sparks`
              }
              testID={`button-trail-${trail.id}`}
              disabled={!isUnlocked}
              onPress={() => onSelect(trail.id)}
              style={({ pressed }) => [
                styles.trailOption,
                {
                  borderColor: isSelected ? colors.primary : colors.border,
                  backgroundColor: isSelected ? colors.secondary : "transparent",
                  opacity: isUnlocked ? 1 : 0.42,
                },
                pressed && isUnlocked && styles.pressed,
              ]}
            >
              <View style={[styles.trailDot, { backgroundColor: trailColor }]} />
              <Text
                style={[
                  styles.trailName,
                  { color: isSelected ? colors.foreground : colors.mutedForeground },
                ]}
              >
                {trail.name}
              </Text>
              {isSelected ? (
                <Feather name="check" size={12} color={colors.primary} />
              ) : !isUnlocked ? (
                <Feather name="lock" size={11} color={colors.mutedForeground} />
              ) : null}
            </Pressable>
          );
        })}
      </View>
      {nextTrail ? (
        <Text style={[styles.trailHint, { color: colors.mutedForeground }]}>
          Collect {remaining} more {remaining === 1 ? "spark" : "sparks"} to unlock {nextTrail.name}.
        </Text>
      ) : (
        <Text style={[styles.trailHint, { color: colors.mutedForeground }]}>
          Every trail is yours. Choose the one you like.
        </Text>
      )}
    </View>
  );
}

function GameScene({
  snapshot,
  colors,
}: {
  snapshot: GameSnapshot;
  colors: ReturnType<typeof useColors>;
}) {
  const shipColor = getTrailColor(snapshot.trail);
  return (
    <Svg
      width="100%"
      height="100%"
      viewBox={`0 0 ${FIELD.width} ${FIELD.height}`}
      preserveAspectRatio="xMidYMid meet"
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
    >
      <Defs>
        <RadialGradient id="fieldGlow" cx="50%" cy="48%" r="70%">
          <Stop offset="0%" stopColor={colors.accent} stopOpacity={0.12} />
          <Stop offset="100%" stopColor={colors.background} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect width={FIELD.width} height={FIELD.height} fill={colors.background} />
      <Rect width={FIELD.width} height={FIELD.height} fill="url(#fieldGlow)" />
      <Circle
        cx={FIELD.width / 2}
        cy={FIELD.height / 2}
        r={FIELD.width * 0.34}
        stroke={colors.border}
        strokeOpacity={0.43}
        strokeWidth={1}
        fill="none"
      />
      <Circle
        cx={FIELD.width / 2}
        cy={FIELD.height / 2}
        r={FIELD.width * 0.22}
        stroke={colors.border}
        strokeOpacity={0.28}
        strokeWidth={1}
        fill="none"
      />
      {STARS.map(([x, y, radius], index) => (
        <Circle
          key={`star-${index}`}
          cx={x}
          cy={y}
          r={radius}
          fill={colors.star}
          opacity={index % 3 === 0 ? 0.76 : 0.42}
        />
      ))}
      <Line
        x1={FIELD.width / 2}
        y1={FIELD.height * 0.12}
        x2={FIELD.width / 2}
        y2={FIELD.height * 0.88}
        stroke={colors.border}
        strokeOpacity={0.16}
        strokeWidth={1}
        strokeDasharray="2 12"
      />
      {snapshot.sparks.map((spark) => (
        <G key={`spark-${spark.id}`} transform={`translate(${spark.x} ${spark.y})`}>
          <Circle r={spark.radius + 7} fill={colors.primary} opacity={0.09} />
          <Circle r={spark.radius + 2} fill="none" stroke={colors.primary} strokeOpacity={0.54} />
          <Circle r={spark.radius * 0.55} fill={colors.primary} />
        </G>
      ))}
      {snapshot.hazards.map((hazard) => (
        <G
          key={`hazard-${hazard.id}`}
          transform={`translate(${hazard.x} ${hazard.y}) rotate(${(hazard.rotation * 180) / Math.PI})`}
        >
          <Polygon
            points={hazardPoints(hazard.radius)}
            fill={colors.hazard}
            fillOpacity={0.12}
            stroke={colors.hazard}
            strokeWidth={1.6}
            strokeOpacity={0.88}
          />
          <Circle r={hazard.radius * 0.24} fill={colors.hazard} opacity={0.7} />
        </G>
      ))}
      {snapshot.player.invulnerable && (
        <Circle
          cx={snapshot.player.x}
          cy={snapshot.player.y}
          r={snapshot.player.radius + 12}
          fill="none"
          stroke={shipColor}
          strokeWidth={1.4}
          strokeDasharray="3 5"
          opacity={0.8}
        />
      )}
      <G transform={`translate(${snapshot.player.x} ${snapshot.player.y})`}>
        <Circle r={snapshot.player.radius + 13} fill={shipColor} opacity={0.1} />
        <Path
          d="M 0 -15 L 9 9 L 0 6 L -9 9 Z"
          fill={shipColor}
          stroke={colors.foreground}
          strokeWidth={1}
          strokeLinejoin="round"
        />
        <Circle cy={-2} r={2.3} fill={colors.background} opacity={0.76} />
      </G>
    </Svg>
  );
}

function hazardPoints(radius: number): string {
  return Array.from({ length: 10 }, (_, index) => {
    const angle = (index * Math.PI * 2) / 10 - Math.PI / 2;
    const pointRadius = index % 2 === 0 ? radius : radius * 0.72;
    return `${Math.cos(angle) * pointRadius},${Math.sin(angle) * pointRadius}`;
  }).join(" ");
}

function formatScore(value: number): string {
  return Math.floor(value).toLocaleString("en-US");
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    gap: 9,
  },
  loading: { flex: 1, justifyContent: "center", alignItems: "center", gap: 16 },
  loadingMark: {
    width: 52,
    height: 52,
    borderWidth: 1,
    borderRadius: 17,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: { fontFamily: FONT_BODY, fontSize: 14 },
  topbar: {
    width: "100%",
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  brand: { flexDirection: "row", alignItems: "center", gap: 10 },
  brandMark: {
    width: 36,
    height: 36,
    borderWidth: 1,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  brandName: { fontFamily: FONT_DISPLAY, fontSize: 16, letterSpacing: -0.6 },
  brandKicker: { marginTop: 2, fontFamily: FONT_MONO, fontSize: 7, letterSpacing: 1.2 },
  iconButton: {
    width: 40,
    height: 40,
    borderWidth: 1,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  saveStatus: {
    minHeight: 30,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  saveStatusText: { fontFamily: FONT_MONO, fontSize: 7, letterSpacing: 0.7 },
  metrics: {
    width: "100%",
    minHeight: 56,
    borderWidth: 1,
    borderRadius: 15,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 13,
  },
  metric: { flex: 1, alignItems: "center", gap: 3 },
  metricLabel: { fontFamily: FONT_MONO, fontSize: 7, letterSpacing: 0.7 },
  metricValue: { fontFamily: FONT_MEDIUM, fontSize: 15 },
  metricDivider: { width: 1, height: 27 },
  boardFrame: {
    borderWidth: 1,
    borderRadius: 21,
    overflow: "hidden",
    alignSelf: "center",
    position: "relative",
  },
  touchPlane: {
    ...StyleSheet.absoluteFill,
    zIndex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 2,
    justifyContent: "center",
    alignItems: "center",
    padding: 11,
    backgroundColor: "rgba(5, 8, 20, 0.58)",
  },
  overlayCard: {
    width: "100%",
    maxWidth: 360,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 15,
    alignItems: "center",
  },
  overlayIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 7,
  },
  overlayTitle: { fontFamily: FONT_DISPLAY, fontSize: 21, textAlign: "center" },
  overlayIntro: {
    fontFamily: FONT_BODY,
    fontSize: 12,
    lineHeight: 17,
    textAlign: "center",
    marginTop: 4,
    marginBottom: 12,
  },
  instruction: {
    width: "100%",
    minHeight: 33,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(160, 173, 205, 0.15)",
    paddingVertical: 5,
  },
  instructionNumber: { fontFamily: FONT_MONO, fontSize: 8, width: 20 },
  instructionText: { fontFamily: FONT_BODY, fontSize: 11, flex: 1, lineHeight: 15 },
  primaryButton: {
    width: "100%",
    minHeight: 48,
    borderRadius: 14,
    marginTop: 11,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
  },
  primaryButtonText: { fontFamily: FONT_DISPLAY, fontSize: 14 },
  secondaryButton: {
    width: "100%",
    minHeight: 42,
    borderWidth: 1,
    borderRadius: 13,
    marginTop: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  secondaryButtonText: { fontFamily: FONT_MEDIUM, fontSize: 12 },
  shieldNote: { fontFamily: FONT_BODY, fontSize: 9, marginTop: 8, textAlign: "center" },
  finalScore: { fontFamily: FONT_MONO, fontSize: 31, marginTop: 10 },
  endStats: {
    width: "100%",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(160, 173, 205, 0.15)",
    paddingTop: 9,
    gap: 4,
  },
  endStat: { fontFamily: FONT_MONO, fontSize: 9, textAlign: "center" },
  bottomPanel: { width: "100%", minHeight: 63, justifyContent: "center" },
  dashRow: { width: "100%", flexDirection: "row", alignItems: "center", gap: 12 },
  dashCopy: { flex: 1, gap: 3 },
  dashTitle: { fontFamily: FONT_MEDIUM, fontSize: 12 },
  dashSubcopy: { fontFamily: FONT_BODY, fontSize: 10 },
  dashButton: {
    width: 112,
    height: 49,
    borderWidth: 1,
    borderRadius: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  dashButtonText: { fontFamily: FONT_MONO, fontSize: 11, letterSpacing: 0.5 },
  trailPanel: { width: "100%", gap: 5 },
  trailHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  trailTitle: { fontFamily: FONT_MEDIUM, fontSize: 11 },
  trailProgress: { fontFamily: FONT_MONO, fontSize: 7, letterSpacing: 0.7 },
  trailOptions: { flexDirection: "row", gap: 6 },
  trailOption: {
    flex: 1,
    height: 31,
    borderWidth: 1,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingHorizontal: 4,
  },
  trailDot: { width: 6, height: 6, borderRadius: 3 },
  trailName: { fontFamily: FONT_MEDIUM, fontSize: 9 },
  trailHint: { fontFamily: FONT_BODY, fontSize: 8 },
  footer: {
    width: "100%",
    minHeight: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  footerText: { fontFamily: FONT_MONO, fontSize: 7, letterSpacing: 0.6 },
  pressed: { opacity: 0.76, transform: [{ scale: 0.98 }] },
});
