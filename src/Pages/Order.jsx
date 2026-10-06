import React, { useState, useEffect, useRef } from "react";

// --- Utility Functions ---
const ri = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const nz = (min, max) => {
  let v = 0;
  while (v === 0) v = ri(min, max);
  return v;
};
const fmt = (n) => (n < 0 ? `(${n})` : `${n}`);

// Safe Scratchpad Evaluator for Easy Mode Line Verification
const evaluateLine = (str) => {
  if (!str || !str.trim()) return null;
  try {
    let cleaned = str
      .replace(/\u00b2|²/g, "**2")
      .replace(/\u00d7|×/g, "*")
      .replace(/\u00f7|÷/g, "/")
      .replace(/\u2212|−/g, "-")
      .replace(/\[/g, "(")
      .replace(/\]/g, ")")
      .replace(/\u221A\s*(\d+)/g, "Math.sqrt($1)"); // Handle square roots

    // Safely verify it contains no malicious code before evaluating
    const verifyStr = cleaned.replace(/Math\.sqrt/g, "");
    if (/[^0-9\+\-\*\/\(\)\s\.]/.test(verifyStr)) return null;

    const val = Function(`"use strict"; return (${cleaned})`)();
    if (typeof val === "number" && !isNaN(val) && isFinite(val)) {
      return Number.isInteger(val) ? val : parseFloat(val.toFixed(2));
    }
    return null;
  } catch {
    return null;
  }
};

// --- Web Audio Synth Helper ---
const playSound = (type, enabled) => {
  if (!enabled) return;
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;
    if (type === "correct" || type === "impossible") {
      osc.type = type === "impossible" ? "square" : "sine";
      osc.frequency.setValueAtTime(523.25, now);
      osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.1);
      osc.frequency.exponentialRampToValueAtTime(783.99, now + 0.2);
      if (type === "impossible")
        osc.frequency.exponentialRampToValueAtTime(1046.5, now + 0.3); // Extra chime
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(
        0.01,
        now + (type === "impossible" ? 0.5 : 0.35),
      );
      osc.start(now);
      osc.stop(now + 0.5);
    } else if (type === "victory") {
      osc.type = "triangle";
      osc.frequency.setValueAtTime(440, now); // A4
      osc.frequency.setValueAtTime(554.37, now + 0.12); // C#5
      osc.frequency.setValueAtTime(659.25, now + 0.24); // E5
      osc.frequency.setValueAtTime(880, now + 0.36); // A5
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.7);
      osc.start(now);
      osc.stop(now + 0.7);
    } else if (type === "wrong" || type === "timeout") {
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(160, now);
      osc.frequency.linearRampToValueAtTime(110, now + 0.25);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
      osc.start(now);
      osc.stop(now + 0.3);
    } else if (type === "click") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(600, now);
      gain.gain.setValueAtTime(0.04, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.04);
      osc.start(now);
      osc.stop(now + 0.04);
    }
  } catch (e) {
    // Audio blocked or unsupported
  }
};

// --- Question Templates ---

// Easy: No exponents, no roots. Basic Operations only.
const easyTemplates = [
  () => {
    const a = nz(-9, 9),
      b = nz(-9, 9),
      c = nz(-20, 20);
    const answer = a * b + c;
    const expr = `${fmt(a)} \u00d7 ${fmt(b)} + ${fmt(c)}`;
    const explain = [`= ${a * b} + ${fmt(c)}`, `= ${answer}`].join("\n");
    return { expr, answer, explain };
  },
  () => {
    const a = nz(-15, 15),
      d = nz(-9, 9) || 2,
      q = nz(-9, 9);
    const n = d * q;
    const answer = a + n / d;
    const expr = `${fmt(a)} + ${fmt(n)} \u00f7 ${fmt(d)}`;
    const explain = [`= ${fmt(a)} + ${n / d}`, `= ${answer}`].join("\n");
    return { expr, answer, explain };
  },
];

// Normal: Includes Exponents (squares)
const normalTemplates = [
  () => {
    const a = nz(-9, 9),
      b = nz(-5, 5),
      c = nz(-5, 5),
      d = nz(-10, 10);
    const answer = a * a + b * c - d;
    const expr = `${fmt(a)}\u00b2 + ${fmt(b)} \u00d7 ${fmt(c)} \u2212 ${fmt(d)}`;
    const explain = [
      `= ${a * a} + ${fmt(b)} \u00d7 ${fmt(c)} \u2212 ${fmt(d)}`,
      `= ${a * a} + ${b * c} \u2212 ${fmt(d)}`,
      `= ${a * a + b * c} \u2212 ${fmt(d)}`,
      `= ${answer}`,
    ].join("\n");
    return { expr, answer, explain };
  },
  () => {
    const a = nz(-8, 8),
      b = nz(-10, 10);
    let d = nz(-9, 9);
    if (d === 0) d = 2;
    const q = nz(-9, 9),
      n = d * q;
    const answer = a * a + b + n / d;
    const expr = `[${fmt(a)}\u00b2 + ${fmt(b)}] + ${fmt(n)} \u00f7 ${fmt(d)}`;
    const explain = [
      `= [${a * a} + ${fmt(b)}] + ${fmt(n)} \u00f7 ${fmt(d)}`,
      `= ${a * a + b} + ${fmt(n)} \u00f7 ${fmt(d)}`,
      `= ${a * a + b} + ${n / d}`,
      `= ${answer}`,
    ].join("\n");
    return { expr, answer, explain };
  },
];

// Hard: Brackets, Exponents, and Square Roots
const hardTemplates = [
  () => {
    const a = nz(-8, 8),
      b = nz(-8, 8),
      c = nz(-5, 5),
      d = nz(-4, 4);
    const answer = Math.pow(a + b, 2) - c * d;
    const expr = `[${fmt(a)} + ${fmt(b)}]\u00b2 \u2212 ${fmt(c)} \u00d7 ${fmt(d)}`;
    const explain = [
      `= [${a + b}]\u00b2 \u2212 ${fmt(c)} \u00d7 ${fmt(d)}`,
      `= ${Math.pow(a + b, 2)} \u2212 ${fmt(c)} \u00d7 ${fmt(d)}`,
      `= ${Math.pow(a + b, 2)} \u2212 ${c * d}`,
      `= ${answer}`,
    ].join("\n");
    return { expr, answer, explain };
  },
  () => {
    // Square Root Equation
    const roots = [4, 9, 16, 25, 36, 49, 64, 81, 100, 144];
    const p = roots[ri(0, roots.length - 1)];
    const rootVal = Math.sqrt(p);
    const a = nz(-5, 5),
      b = nz(-3, 3);
    const answer = rootVal + a * Math.pow(b, 2);
    const expr = `\u221A${p} + ${fmt(a)} \u00d7 ${fmt(b)}\u00b2`;
    const explain = [
      `= \u221A${p} + ${fmt(a)} \u00d7 ${b * b}`,
      `= ${rootVal} + ${fmt(a)} \u00d7 ${b * b}`,
      `= ${rootVal} + ${a * (b * b)}`,
      `= ${answer}`,
    ].join("\n");
    return { expr, answer, explain };
  },
];

const CORRECT_MSGS = [
  "Nice work!",
  "Correct!",
  "Great job!",
  "You got it!",
  "Sharp!",
];

export default function OrderOfOperations() {
  // Settings state
  const [difficulty, setDifficulty] = useState("normal");
  const [boardTheme, setBoardTheme] = useState("classic");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [timerSetting, setTimerSetting] = useState(0);
  const [targetOption, setTargetOption] = useState("10");
  const [customTarget, setCustomTarget] = useState(24);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [devMode, setDevMode] = useState(false);

  // Game state
  const [current, setCurrent] = useState(null);
  const [answerInput, setAnswerInput] = useState("");
  const [steps, setSteps] = useState([]);
  const [feedback, setFeedback] = useState({ text: "", type: "" });
  const [attempts, setAttempts] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isGameFinished, setIsGameFinished] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);

  const [stats, setStats] = useState({ streak: 0, best: 0, total: 0 });
  const inputRef = useRef(null);

  const getTargetGoal = () => {
    if (targetOption === "infinite") return "infinite";
    if (targetOption === "custom")
      return Math.max(1, parseInt(customTarget, 10) || 1);
    return parseInt(targetOption, 10);
  };

  useEffect(() => {
    document.body.className = `theme-${boardTheme}`;
  }, [boardTheme]);

  const generateProblem = (forceImpossible = false) => {
    // 1/1000 chance for an Impossible Joke Question (or forced via dev mode)
    if (forceImpossible || Math.random() < 0.001) {
      setCurrent({
        expr: "45454545!",
        answer: "impossible",
        explain: "Haha! You found the 1/1000 impossible question!",
        isImpossible: true,
      });
      setAnswerInput("");
      setSteps([]);
      setFeedback({ text: "", type: "" });
      setAttempts(0);
      setIsTransitioning(false);
      if (timerSetting > 0) setTimeLeft(timerSetting);
      setTimeout(() => inputRef.current?.focus(), 0);
      return;
    }

    let pool = normalTemplates;
    if (difficulty === "easy") pool = easyTemplates;
    if (difficulty === "hard") pool = hardTemplates;

    const t = pool[ri(0, pool.length - 1)];
    const r = t();

    setCurrent(r);
    setAnswerInput("");
    setSteps([]);
    setFeedback({ text: "", type: "" });
    setAttempts(0);
    setIsTransitioning(false);
    if (timerSetting > 0) setTimeLeft(timerSetting);

    setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
  };

  useEffect(() => {
    generateProblem();
  }, [difficulty]);

  useEffect(() => {
    if (
      timerSetting === 0 ||
      isTransitioning ||
      isGameFinished ||
      timeLeft <= 0
    )
      return;
    const timerId = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerId);
          handleTimeout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerId);
  }, [timerSetting, isTransitioning, isGameFinished, timeLeft]);

  const handleTimeout = () => {
    setIsTransitioning(true);
    playSound("timeout", soundEnabled);
    setStats((prev) => ({ ...prev, streak: 0 }));
    setFeedback({
      text: `Time's up! Step-by-step correction:\n${current?.explain || ""}`,
      type: "feedback-reveal",
    });
    setTimeout(generateProblem, 4000);
  };

  const handleAddStep = () => {
    playSound("click", soundEnabled);
    setSteps((prev) => {
      const previousLine =
        prev.length > 0 ? prev[prev.length - 1] : current.expr;
      return [...prev, previousLine];
    });
  };

  const handleStepChange = (index, value) => {
    setSteps((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const handleRemoveStep = (index) => {
    playSound("click", soundEnabled);
    setSteps((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isTransitioning || isGameFinished || !current) return;

    // --- Impossible Question Handler ---
    if (current.isImpossible) {
      const newStreak = stats.streak + 1;
      const targetGoal = getTargetGoal();
      setIsTransitioning(true);
      playSound("impossible", soundEnabled);
      setStats({
        streak: newStreak,
        best: Math.max(stats.best, newStreak),
        total: stats.total + 1,
      });
      setFeedback({
        text: `✨ ${current.explain} ✨\nFree point awarded!`,
        type: "feedback-correct",
      });

      if (targetGoal !== "infinite" && newStreak >= targetGoal) {
        setTimeout(() => setIsGameFinished(true), 2000);
      } else {
        setTimeout(generateProblem, 2500);
      }
      return;
    }
    // -----------------------------------

    const parsedAnswer = parseInt(answerInput, 10);
    const isCorrect = !isNaN(parsedAnswer) && parsedAnswer === current.answer;
    const newAttempts = attempts + 1;
    setAttempts(newAttempts);

    if (isCorrect) {
      const newStreak = stats.streak + 1;
      const targetGoal = getTargetGoal();

      if (targetGoal !== "infinite" && newStreak >= targetGoal) {
        setIsGameFinished(true);
        playSound("victory", soundEnabled);
        setStats({
          streak: newStreak,
          best: Math.max(stats.best, newStreak),
          total: stats.total + 1,
        });
        return;
      }

      setIsTransitioning(true);
      playSound("correct", soundEnabled);
      setStats({
        streak: newStreak,
        best: Math.max(stats.best, newStreak),
        total: stats.total + 1,
      });
      setFeedback({
        text: CORRECT_MSGS[Math.floor(Math.random() * CORRECT_MSGS.length)],
        type: "feedback-correct",
      });
      setTimeout(generateProblem, 850);
    } else {
      playSound("wrong", soundEnabled);
      if (newAttempts >= 2) {
        setIsTransitioning(true);
        setStats((prev) => ({ ...prev, streak: 0 }));
        // Provide the step-by-step proper correction
        setFeedback({
          text: `Not quite. Here is the correct step-by-step breakdown:\n${current.explain}`,
          type: "feedback-reveal",
        });
        setTimeout(generateProblem, 5000);
      } else {
        setFeedback({
          text: "Not quite — check your signs and order, then try again.",
          type: "feedback-retry",
        });
        setAnswerInput("");
        inputRef.current?.focus();
      }
    }
  };

  const handleSkip = () => {
    if (isTransitioning || isGameFinished) return;
    playSound("click", soundEnabled);
    setStats((prev) => ({ ...prev, streak: 0 }));
    generateProblem();
  };

  const handleDevSkip = () => {
    if (isTransitioning || isGameFinished || !current) return;
    const newStreak = stats.streak + 1;
    const targetGoal = getTargetGoal();
    if (targetGoal !== "infinite" && newStreak >= targetGoal) {
      setIsGameFinished(true);
      playSound("victory", soundEnabled);
      setStats({
        streak: newStreak,
        best: Math.max(stats.best, newStreak),
        total: stats.total + 1,
      });
      return;
    }
    setIsTransitioning(true);
    playSound("correct", soundEnabled);
    setStats({
      streak: newStreak,
      best: Math.max(stats.best, newStreak),
      total: stats.total + 1,
    });
    setFeedback({
      text: "[DEV] Question skipped +1",
      type: "feedback-correct",
    });
    setTimeout(generateProblem, 600);
  };

  const handlePlayAgain = () => {
    playSound("click", soundEnabled);
    setIsGameFinished(false);
    setStats((prev) => ({ ...prev, streak: 0 }));
    generateProblem();
  };

  const targetGoal = getTargetGoal();
  const railPercentage =
    targetGoal === "infinite"
      ? 0
      : Math.min((stats.streak / targetGoal) * 100, 100);

  return (
    <div className="wrap">
      <button
        className="settings-toggle-btn"
        onClick={() => {
          playSound("click", soundEnabled);
          setIsPanelOpen(true);
        }}
        aria-label="Open Settings"
      >
        &#9881; Settings
      </button>

      <div
        className={`drawer-overlay ${isPanelOpen ? "open" : ""}`}
        onClick={() => setIsPanelOpen(false)}
      >
        <div className="drawer-panel" onClick={(e) => e.stopPropagation()}>
          <div className="drawer-header">
            <h2>Preferences</h2>
            <button
              className="drawer-close-btn"
              onClick={() => setIsPanelOpen(false)}
            >
              &times;
            </button>
          </div>

          <div className="drawer-body">
            <div className="setting-group">
              <label className="setting-label">Line Goal (Length)</label>
              <div className="btn-segmented">
                <button
                  className={targetOption === "10" ? "active" : ""}
                  onClick={() => setTargetOption("10")}
                >
                  10
                </button>
                <button
                  className={targetOption === "20" ? "active" : ""}
                  onClick={() => setTargetOption("20")}
                >
                  20
                </button>
                <button
                  className={targetOption === "custom" ? "active" : ""}
                  onClick={() => setTargetOption("custom")}
                >
                  Custom
                </button>
                <button
                  className={targetOption === "infinite" ? "active" : ""}
                  onClick={() => setTargetOption("infinite")}
                >
                  Infinite
                </button>
              </div>
              {targetOption === "custom" && (
                <div className="custom-goal-box">
                  <label>Target Count:</label>
                  <input
                    type="number"
                    min="1"
                    max="999"
                    value={customTarget}
                    onChange={(e) =>
                      setCustomTarget(
                        Math.max(1, parseInt(e.target.value, 10) || 1),
                      )
                    }
                  />
                </div>
              )}
            </div>

            <div className="setting-group">
              <label className="setting-label">Difficulty Mode</label>
              <div className="btn-segmented">
                <button
                  className={difficulty === "easy" ? "active" : ""}
                  onClick={() => setDifficulty("easy")}
                >
                  Easy
                </button>
                <button
                  className={difficulty === "normal" ? "active" : ""}
                  onClick={() => setDifficulty("normal")}
                >
                  Normal
                </button>
                <button
                  className={difficulty === "hard" ? "active" : ""}
                  onClick={() => setDifficulty("hard")}
                >
                  Hard
                </button>
              </div>
            </div>

            <div className="setting-group">
              <label className="setting-label">Question Timer</label>
              <div className="btn-segmented">
                <button
                  className={timerSetting === 0 ? "active" : ""}
                  onClick={() => {
                    setTimerSetting(0);
                    setTimeLeft(0);
                  }}
                >
                  Off
                </button>
                <button
                  className={timerSetting === 15 ? "active" : ""}
                  onClick={() => {
                    setTimerSetting(15);
                    setTimeLeft(15);
                  }}
                >
                  15s
                </button>
                <button
                  className={timerSetting === 30 ? "active" : ""}
                  onClick={() => {
                    setTimerSetting(30);
                    setTimeLeft(30);
                  }}
                >
                  30s
                </button>
                <button
                  className={timerSetting === 60 ? "active" : ""}
                  onClick={() => {
                    setTimerSetting(60);
                    setTimeLeft(60);
                  }}
                >
                  60s
                </button>
              </div>
            </div>

            <div className="setting-group">
              <label className="setting-label">Board Style</label>
              <div className="theme-grid">
                <button
                  className={`theme-card classic ${boardTheme === "classic" ? "active" : ""}`}
                  onClick={() => setBoardTheme("classic")}
                >
                  Green Chalk
                </button>
                <button
                  className={`theme-card dark ${boardTheme === "dark" ? "active" : ""}`}
                  onClick={() => setBoardTheme("dark")}
                >
                  Dark Slate
                </button>
                <button
                  className={`theme-card whiteboard ${boardTheme === "whiteboard" ? "active" : ""}`}
                  onClick={() => setBoardTheme("whiteboard")}
                >
                  Whiteboard
                </button>
                <button
                  className={`theme-card blue ${boardTheme === "blue" ? "active" : ""}`}
                  onClick={() => setBoardTheme("blue")}
                >
                  Blue Slate
                </button>
                <button
                  className={`theme-card pink ${boardTheme === "pink" ? "active" : ""}`}
                  onClick={() => setBoardTheme("pink")}
                >
                  Pink Slate
                </button>
                <button
                  className={`theme-card violet ${boardTheme === "violet" ? "active" : ""}`}
                  onClick={() => setBoardTheme("violet")}
                >
                  Violet Slate
                </button>
              </div>
            </div>

            <div className="setting-group setting-row">
              <label className="setting-label">Sound Effects</label>
              <button
                className={`toggle-switch ${soundEnabled ? "on" : ""}`}
                onClick={() => setSoundEnabled(!soundEnabled)}
              >
                {soundEnabled ? "ON" : "OFF"}
              </button>
            </div>

            <div
              className="setting-group setting-row"
              style={{
                marginTop: "24px",
                borderTop: "1px solid rgba(255,255,255,0.1)",
                paddingTop: "16px",
              }}
            >
              <label className="setting-label" style={{ color: "#fbbf24" }}>
                Developer Mode
              </label>
              <button
                className={`toggle-switch ${devMode ? "on" : ""}`}
                onClick={() => setDevMode(!devMode)}
              >
                {devMode ? "ON" : "OFF"}
              </button>
            </div>
          </div>
        </div>
      </div>

      <header>
        <p className="eyebrow">Shri's Order of Operations &middot; Numbers</p>
        <h1>Order of Operations</h1>
        <p className="sub">
          Mixed integer expressions — brackets, exponents, and operations.
        </p>
      </header>

      <div className="board">
        {timerSetting > 0 && !isGameFinished && (
          <div className="timer-bar-wrap">
            <div
              className={`timer-bar-fill ${timeLeft <= 5 ? "urgent" : ""}`}
              style={{ width: `${(timeLeft / timerSetting) * 100}%` }}
            ></div>
          </div>
        )}

        <div className="board-inner">
          {isGameFinished ? (
            <div className="victory-view">
              <h2 className="victory-title">🎉 Good job! 🎉</h2>
              <p className="victory-sub">
                You hit your target goal of <strong>{targetGoal}</strong>{" "}
                correct in a row!
              </p>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handlePlayAgain}
              >
                Play Again
              </button>
            </div>
          ) : (
            <>
              <p className="prompt">
                Solve using correct order of operations.
                {timerSetting > 0 && (
                  <span className="timer-badge"> ⏳ {timeLeft}s</span>
                )}
              </p>

              <div className="equation">
                {current ? current.expr : "Loading…"}
              </div>

              <div className="scratchpad">
                {steps.map((step, index) => {
                  const evalResult =
                    difficulty === "easy" ? evaluateLine(step) : null;
                  return (
                    <div key={index} className="step-row">
                      <input
                        type="text"
                        className="step-input"
                        placeholder={`Step ${index + 1}...`}
                        value={step}
                        onChange={(e) =>
                          handleStepChange(index, e.target.value)
                        }
                        disabled={isTransitioning}
                      />
                      {difficulty === "easy" && evalResult !== null && (
                        <span
                          className="step-eval"
                          title="Live verification result"
                        >
                          = {evalResult}
                        </span>
                      )}
                      <button
                        type="button"
                        className="btn-remove-step"
                        onClick={() => handleRemoveStep(index)}
                        disabled={isTransitioning}
                      >
                        &times;
                      </button>
                    </div>
                  );
                })}
                <button
                  type="button"
                  className="btn-add-step"
                  onClick={handleAddStep}
                  disabled={isTransitioning}
                >
                  + Add line
                </button>
              </div>

              <form
                id="answerForm"
                className="answer-row"
                autoComplete="off"
                onSubmit={handleSubmit}
              >
                <label htmlFor="answer">Answer</label>
                <input
                  type="text"
                  id="answer"
                  name="answer"
                  autoComplete="off"
                  required
                  ref={inputRef}
                  value={answerInput}
                  onChange={(e) => setAnswerInput(e.target.value)}
                  disabled={isTransitioning}
                />
              </form>

              <div
                className={`feedback ${feedback.type}`}
                role="status"
                aria-live="polite"
              >
                {feedback.text}
              </div>

              <div className="controls">
                <button
                  type="submit"
                  form="answerForm"
                  className="btn btn-primary"
                  disabled={isTransitioning || !answerInput.trim()}
                >
                  Check
                </button>
                <button
                  type="button"
                  className="btn-ghost btn"
                  onClick={handleSkip}
                  disabled={isTransitioning}
                >
                  New question
                </button>

                {devMode && (
                  <>
                    <button
                      type="button"
                      className="btn-ghost btn"
                      onClick={handleDevSkip}
                      disabled={isTransitioning}
                      style={{ color: "#fbbf24", borderColor: "#fbbf24" }}
                    >
                      Skip (+1)
                    </button>
                    <button
                      type="button"
                      className="btn-ghost btn"
                      onClick={() => generateProblem(true)}
                      disabled={isTransitioning}
                      style={{ color: "#ef4444", borderColor: "#ef4444" }}
                    >
                      Trigger Joke
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="rail-wrap">
        {targetGoal !== "infinite" && (
          <div className="rail" aria-hidden="true">
            <div className="rail-track"></div>
            <div
              className="rail-token"
              style={{
                left: `${railPercentage}%`,
                transition: "left 0.3s ease-out",
              }}
            >
              &#9679;
            </div>
          </div>
        )}
        <div className="stats">
          <span>
            <strong>{stats.streak}</strong>
            {targetGoal !== "infinite" ? ` / ${targetGoal}` : " in a row"}
          </span>
          <span className="dot">&middot;</span>
          <span>
            <strong>{stats.best}</strong> best streak
          </span>
          <span className="dot">&middot;</span>
          <span>
            <strong>{stats.total}</strong> solved
          </span>
        </div>
      </div>

      <footer>
        Keep going — every correct answer moves the counter along the line.
      </footer>
    </div>
  );
}
