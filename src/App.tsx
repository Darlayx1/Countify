import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Check,
  CheckCheck,
  ChevronRight,
  CircleHelp,
  Clock3,
  Delete,
  History,
  Keyboard,
  Leaf,
  Lightbulb,
  Minus,
  Plus,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Target,
  Timer,
  Trophy,
  X,
  Zap,
} from "lucide-react";
import {
  LEVELS,
  MODES,
  accuracy,
  formatNumber,
  generateQuestion,
  loadResults,
  remaining,
  saveResults,
  startSession,
  submitAnswer,
  type Level,
  type Mode,
  type Result,
  type Session,
} from "./game";

const LEVEL_HINTS = [
  "Angka kecil, langkah pertama yang berarti.",
  "Dua digit. Sedikit lebih menantang.",
  "Angka lebih besar, fokus lebih tajam.",
  "Kenali angka positif dan negatif.",
  "Negatif dan desimal. Tantangan sesungguhnya.",
];
const PREVIEW = {
  addition: [300, 500, 800],
  subtraction: [900, 400, 500],
  multiplication: [300, 400, 1200],
  division: [1200, 300, 400],
};

function Logo() {
  return (
    <span className="brand">
      <span className="brand-icon" aria-hidden="true">
        <Plus />
        <Minus />
        <X />
        <span>=</span>
      </span>
      <span>
        countify<span className="brand-dot">.</span>
      </span>
    </span>
  );
}

function Modal({
  children,
  title,
  onClose,
}: {
  children: ReactNode;
  title: string;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      aria-labelledby="modal-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-inner">
        <button
          className="icon-button modal-close"
          aria-label="Tutup"
          onClick={onClose}
        >
          <X size={20} />
        </button>
        <h2 id="modal-title">{title}</h2>
        {children}
      </div>
    </dialog>
  );
}

function App() {
  const [mode, setMode] = useState<Mode>("addition");
  const [level, setLevel] = useState<Level>(1);
  const [page, setPage] = useState<"practice" | "history">("practice");
  const [session, setSession] = useState<Session | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const [input, setInput] = useState("");
  const inputRef = useRef("");
  const [now, setNow] = useState(Date.now());
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
  const feedbackTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const [results, setResults] = useState<Result[]>(loadResults);
  const resultsRef = useRef(results);
  const saved = useRef(false);
  const [storageAvailable, setStorageAvailable] = useState(true);
  const [help, setHelp] = useState(false);
  const [leaveTo, setLeaveTo] = useState<"practice" | "history" | null>(null);
  const [clearHistory, setClearHistory] = useState(false);
  const [preview, setPreview] = useState(() => ({
    a: 300,
    b: 500,
    answer: 800,
    key: "preview",
  }));
  const meta = MODES.find((m) => m.id === mode)!;
  const isPlaying = session?.status === "playing";
  const isFinished = session?.status === "finished";
  const timeLeft = session ? remaining(session, now) : 60_000;
  const seconds = Math.ceil(timeLeft / 1000);
  const best = results
    .filter((r) => r.mode === mode && r.level === level)
    .reduce((max, r) => Math.max(max, r.correct), 0);
  const previousBest = results
    .slice(1)
    .filter((r) => r.mode === mode && r.level === level)
    .reduce((max, r) => Math.max(max, r.correct), 0);
  const question = session?.question ?? preview;
  const equationLength =
    formatNumber(question.a).length +
    formatNumber(question.b).length +
    (question.a < 0 ? 2 : 0) +
    (question.b < 0 ? 2 : 0);

  const updateInput = useCallback((value: string) => {
    inputRef.current = value;
    setInput(value);
  }, []);
  const updateSession = useCallback((value: Session | null) => {
    sessionRef.current = value;
    setSession(value);
  }, []);
  const finish = useCallback(
    (current: Session) => {
      updateSession({ ...current, status: "finished" });
      setLeaveTo(null);
      if (saved.current) return;
      saved.current = true;
      const result: Result = {
        id: crypto.randomUUID(),
        date: new Date().toISOString(),
        mode: current.mode,
        level: current.level,
        correct: current.correct,
        wrong: current.wrong,
      };
      const next = [result, ...resultsRef.current].slice(0, 50);
      resultsRef.current = next;
      setResults(next);
      setStorageAvailable(saveResults(next));
    },
    [updateSession],
  );

  useEffect(() => {
    if (!isPlaying) return;
    const tick = () => {
      const time = Date.now();
      setNow(time);
      const current = sessionRef.current;
      if (current?.status === "playing" && remaining(current, time) === 0)
        finish(current);
    };
    const interval = setInterval(tick, 100);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [isPlaying, finish]);

  useEffect(() => () => clearTimeout(feedbackTimeout.current), []);
  useEffect(() => {
    if (!isPlaying) return;
    const preventLeave = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", preventLeave);
    return () => window.removeEventListener("beforeunload", preventLeave);
  }, [isPlaying]);

  const begin = () => {
    window.scrollTo({ top: 0, behavior: "instant" });
    saved.current = false;
    updateInput("");
    setFeedback(null);
    clearTimeout(feedbackTimeout.current);
    const time = Date.now();
    setNow(time);
    updateSession(startSession(mode, level, time));
  };

  const submit = useCallback(() => {
    const current = sessionRef.current;
    if (!current || current.status !== "playing") return;
    const time = Date.now();
    const result = submitAnswer(current, inputRef.current, time);
    setNow(time);
    if (result.session.status === "finished") finish(result.session);
    else updateSession(result.session);
    if (result.feedback) {
      updateInput("");
      setFeedback(result.feedback);
      clearTimeout(feedbackTimeout.current);
      feedbackTimeout.current = setTimeout(() => setFeedback(null), 950);
    }
  }, [finish, updateInput, updateSession]);

  const press = useCallback(
    (key: string) => {
      if (sessionRef.current?.status !== "playing") return;
      const current = inputRef.current;
      if (key === "submit") {
        submit();
        return;
      }
      if (key === "clear") {
        updateInput("");
        return;
      }
      if (key === "backspace") {
        updateInput(current.slice(0, -1));
        return;
      }
      if (key === "sign") {
        if (level >= 4)
          updateInput(
            current.startsWith("-") ? current.slice(1) : "-" + current,
          );
        return;
      }
      if (key === "." || key === ",") {
        if (level === 5 && !current.includes(","))
          updateInput(
            (current === "" || current === "-" ? current + "0" : current) + ",",
          );
        return;
      }
      if (
        /^\d$/.test(key) &&
        current.length < 9 &&
        (!current.includes(",") || current.split(",")[1].length < 2)
      )
        updateInput(current + key);
    },
    [level, submit, updateInput],
  );

  useEffect(() => {
    if (!isPlaying || help || leaveTo) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey || event.repeat)
        return;
      const keys: Record<string, string> = {
        Enter: "submit",
        Backspace: "backspace",
        Delete: "clear",
        Escape: "clear",
        "-": "sign",
      };
      if (/^[\d.,]$/.test(event.key) || event.key in keys) {
        event.preventDefault();
        press(keys[event.key] ?? event.key);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isPlaying, help, leaveTo, press]);

  const navigate = (target: "practice" | "history") => {
    if (isPlaying) {
      setLeaveTo(target);
      return;
    }
    updateSession(null);
    updateInput("");
    setFeedback(null);
    setPage(target);
  };
  const chooseMode = (value: Mode) => {
    setMode(value);
    if (level === 1) {
      const [a, b, answer] = PREVIEW[value];
      setPreview({ a, b, answer, key: "preview" });
    } else setPreview(generateQuestion(value, level));
  };
  const chooseLevel = (value: Level) => {
    setLevel(value);
    setPreview(generateQuestion(mode, value));
  };

  return (
    <MotionConfig reducedMotion="user">
      <div className="app-shell">
        <header className="header">
          <div className="header-inner">
            <button
              className="brand-button"
              aria-label="Countify beranda"
              onClick={() => navigate("practice")}
            >
              <Logo />
            </button>
            <nav className="nav" aria-label="Navigasi utama">
              <button
                className={page === "practice" ? "nav-link active" : "nav-link"}
                onClick={() => {
                  if (page !== "practice") navigate("practice");
                }}
              >
                <Zap size={16} />
                <span>Latihan</span>
              </button>
              <button
                className={page === "history" ? "nav-link active" : "nav-link"}
                onClick={() => {
                  if (page !== "history") navigate("history");
                }}
              >
                <History size={16} />
                <span>Riwayat</span>
              </button>
            </nav>
            <button className="help-button" onClick={() => setHelp(true)}>
              <CircleHelp size={17} />
              <span>Cara bermain</span>
            </button>
          </div>
        </header>

        <main className="main">
          <AnimatePresence mode="wait">
            {page === "history" ? (
              <motion.div
                key="history"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
              >
                <section className="history-heading">
                  <span className="eyebrow">
                    <History size={14} /> PERJALANANMU
                  </span>
                  <h1>
                    Langkah kecil.
                    <br />
                    <span>Kemajuan nyata.</span>
                  </h1>
                  <p>
                    Setiap sesi adalah investasi untuk pikiran yang lebih tajam.
                  </p>
                </section>
                <div className="history-overview">
                  <div>
                    <span>Total latihan</span>
                    <strong>
                      {results.length}
                      <small> sesi</small>
                    </strong>
                  </div>
                  <div>
                    <span>Jawaban benar</span>
                    <strong>
                      {results.reduce((n, r) => n + r.correct, 0)}
                    </strong>
                  </div>
                  <div>
                    <span>Akurasi keseluruhan</span>
                    <strong>
                      {accuracy(
                        results.reduce((n, r) => n + r.correct, 0),
                        results.reduce((n, r) => n + r.wrong, 0),
                      )}
                      <small>%</small>
                    </strong>
                  </div>
                </div>
                <section className="history-card">
                  <div className="section-heading">
                    <h2>Riwayat latihan</h2>
                    {results.length > 0 && (
                      <button
                        className="text-button subtle"
                        onClick={() => setClearHistory(true)}
                      >
                        Hapus riwayat
                      </button>
                    )}
                  </div>
                  {results.length === 0 ? (
                    <div className="empty-state">
                      <span className="empty-icon">
                        <BarChart3 size={28} />
                      </span>
                      <h3>Cerita hebat dimulai dari satu sesi.</h3>
                      <p>
                        Latihan pertamamu akan muncul di sini.
                        <br />
                        Siap memberi pikiranmu sedikit tantangan?
                      </p>
                      <button
                        className="primary-button"
                        onClick={() => navigate("practice")}
                      >
                        Mulai latihan <ArrowRight size={18} />
                      </button>
                    </div>
                  ) : (
                    <div className="history-list">
                      {results.map((r) => (
                        <div className="history-row" key={r.id}>
                          <span className={`history-symbol ${r.mode}`}>
                            {MODES.find((m) => m.id === r.mode)?.symbol}
                          </span>
                          <div className="history-name">
                            <strong>
                              {MODES.find((m) => m.id === r.mode)?.name}
                            </strong>
                            <span>
                              Level {r.level} · {LEVELS[r.level - 1]}
                            </span>
                          </div>
                          <time dateTime={r.date}>
                            {new Intl.DateTimeFormat("id-ID", {
                              day: "numeric",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            }).format(new Date(r.date))}
                          </time>
                          <div className="history-score">
                            <strong>
                              {r.correct} <small>benar</small>
                            </strong>
                            <span>
                              {r.wrong} salah · {accuracy(r.correct, r.wrong)}%
                              akurasi
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="local-note">
                    <ShieldCheck size={14} /> Tersimpan di browser ini ·
                    Maksimal 50 sesi terakhir
                  </p>
                </section>
              </motion.div>
            ) : (
              <motion.div
                key="practice"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <section
                  className={`hero ${isPlaying || isFinished ? "hero-compact" : ""}`}
                >
                  <div className="hero-copy">
                    <span className="eyebrow">
                      <span className="live-dot" />{" "}
                      {isPlaying
                        ? "WAKTUNYA FOKUS"
                        : isFinished
                          ? "SATU LATIHAN, SATU KEMAJUAN"
                          : "PIKIRAN TAJAM DIMULAI DI SINI"}
                    </span>
                    <h1>
                      {isPlaying ? (
                        <>
                          Satu soal.
                          <br />
                          <span>Sepenuh fokus.</span>
                        </>
                      ) : isFinished ? (
                        <>
                          Satu langkah
                          <br />
                          <span>lebih tajam.</span>
                        </>
                      ) : (
                        <>
                          Sedikit latihan.
                          <br />
                          <span>Lebih tajam setiap hari.</span>
                        </>
                      )}
                    </h1>
                    <p>
                      {isPlaying
                        ? "Tenang, percaya pada dirimu, dan terus berhitung."
                        : isFinished
                          ? "Kemajuan datang dari keberanian untuk terus mencoba."
                          : "Luangkan satu menit. Tantang dirimu, latih fokusmu, dan temukan ritme berhitung terbaikmu."}
                    </p>
                  </div>
                  <div className="hero-art" aria-hidden="true">
                    <div className="orbit orbit-one" />
                    <div className="orbit orbit-two" />
                    <div className="art-center">
                      <span>1</span>
                      <small>MENIT UNTUKMU</small>
                    </div>
                    <span className="floating-symbol symbol-plus">+</span>
                    <span className="floating-symbol symbol-times">×</span>
                    <span className="floating-symbol symbol-divide">÷</span>
                    <span className="floating-symbol symbol-minus">−</span>
                    <span className="art-spark spark-one">✧</span>
                    <span className="art-spark spark-two">✦</span>
                    <span className="art-caption">
                      <Sparkles size={13} /> small steps, sharper minds.
                    </span>
                  </div>
                </section>

                <div className="workspace-heading">
                  <div>
                    <span className="tiny-square" />
                    <h2>Ruang latihan</h2>
                    <span className="heading-divider" />
                    <span className="workspace-subtitle">
                      {isPlaying
                        ? "Nikmati prosesnya."
                        : isFinished
                          ? "Usaha kecilmu berarti."
                          : "Atur tantanganmu sendiri."}
                    </span>
                  </div>
                  <span className={`session-status ${isPlaying ? "live" : ""}`}>
                    <span />
                    {isPlaying
                      ? "Sesi berlangsung"
                      : isFinished
                        ? "Sesi selesai"
                        : "Siap saat kamu siap"}
                  </span>
                </div>

                <div className="workspace">
                  <section className="configuration">
                    {!session ? (
                      <>
                        <div className="field-heading">
                          <span className="step-number">01</span>
                          <h3>Pilih mode latihan</h3>
                        </div>
                        <div className="mode-grid">
                          {MODES.map((m) => (
                            <button
                              key={m.id}
                              aria-label={m.name}
                              className={`mode-card ${mode === m.id ? "selected" : ""}`}
                              onClick={() => chooseMode(m.id)}
                              aria-pressed={mode === m.id}
                            >
                              <span className={`mode-symbol ${m.id}`}>
                                {m.symbol}
                              </span>
                              <span>{m.name}</span>
                              {mode === m.id ? (
                                <span className="selection-check">
                                  <Check size={11} strokeWidth={3} />
                                </span>
                              ) : (
                                <span className="selection-circle" />
                              )}
                            </button>
                          ))}
                        </div>
                        <div className="field-heading level-heading">
                          <span className="step-number">02</span>
                          <h3>Tentukan tantangan</h3>
                          <span className="level-count">5 level</span>
                        </div>
                        <div
                          className="level-picker"
                          role="group"
                          aria-label="Tingkat kesulitan"
                        >
                          {LEVELS.map((name, index) => (
                            <button
                              key={name}
                              className={`level-button ${level === index + 1 ? "selected" : ""}`}
                              aria-label={`Level ${index + 1} ${name}`}
                              aria-pressed={level === index + 1}
                              onClick={() => chooseLevel((index + 1) as Level)}
                            >
                              <span className="level-bars" aria-hidden="true">
                                {[0, 1, 2, 3, 4].map((bar) => (
                                  <i
                                    key={bar}
                                    className={bar <= index ? "filled" : ""}
                                    style={{ height: 5 + bar * 3 }}
                                  />
                                ))}
                              </span>
                              <strong>{index + 1}</strong>
                              <small>{name}</small>
                            </button>
                          ))}
                        </div>
                        <AnimatePresence mode="wait">
                          <motion.p
                            key={level}
                            className="level-hint"
                            initial={{ opacity: 0, y: 3 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.12 }}
                          >
                            <Sparkles size={14} />
                            {LEVEL_HINTS[level - 1]}
                          </motion.p>
                        </AnimatePresence>
                        <div className="rules-strip">
                          <span>
                            <Timer size={16} />
                            <strong>60</strong> detik
                          </span>
                          <span className="rules-divider" />
                          <span>
                            <ArrowDownLeft size={16} />
                            <strong>−10</strong> detik jika salah
                          </span>
                        </div>
                        <button
                          className="primary-button start-button"
                          onClick={begin}
                        >
                          <Zap size={17} fill="currentColor" />
                          Mulai latihan
                          <ArrowRight size={19} />
                        </button>
                        <p className="start-note">
                          Satu menit hari ini. Selangkah lebih baik esok.
                        </p>
                      </>
                    ) : (
                      <div className="session-panel">
                        <div className="session-panel-top">
                          <span className="eyebrow">
                            {isFinished ? "LATIHAN SELESAI" : "TANTANGANMU"}
                          </span>
                          <span className={`mode-symbol small ${mode}`}>
                            {meta.symbol}
                          </span>
                        </div>
                        <h3>{meta.name}</h3>
                        <p>
                          Level {level} <span>·</span> {LEVELS[level - 1]}
                        </p>
                        <div
                          className={`timer-card ${seconds <= 10 && isPlaying ? "urgent" : ""}`}
                        >
                          <div className="timer-label">
                            <Clock3 size={16} />
                            <span>
                              {isFinished ? "Waktu selesai" : "Sisa waktu"}
                            </span>
                          </div>
                          <strong
                            role="timer"
                            aria-label={`Sisa waktu ${seconds} detik`}
                            data-testid="timer"
                          >
                            {String(Math.floor(seconds / 60)).padStart(2, "0")}
                            <span>:</span>
                            {String(seconds % 60).padStart(2, "0")}
                          </strong>
                          <div className="timer-track">
                            <div
                              style={{
                                transform: `scaleX(${Math.max(0, timeLeft / 60_000)})`,
                              }}
                            />
                          </div>
                          <AnimatePresence>
                            {feedback === "wrong" && (
                              <motion.span
                                className="penalty-tag"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                              >
                                −10 detik
                              </motion.span>
                            )}
                          </AnimatePresence>
                        </div>
                        <div className="live-stat-grid">
                          <div>
                            <span>
                              <Check size={15} /> Benar
                            </span>
                            <strong data-testid="correct-count">
                              {session.correct}
                            </strong>
                          </div>
                          <div>
                            <span>
                              <X size={15} /> Salah
                            </span>
                            <strong data-testid="wrong-count">
                              {session.wrong}
                            </strong>
                          </div>
                        </div>
                        <div className="personal-best">
                          <Trophy size={17} />
                          <span>Rekor pribadimu</span>
                          <strong>
                            {best} <small>benar</small>
                          </strong>
                        </div>
                        <div className="focus-note">
                          <Lightbulb size={20} />
                          <p>
                            {isFinished
                              ? "Konsistensi mengalahkan kesempurnaan. Kembali lagi dan temukan ritmemu."
                              : "Ketepatan lebih penting dari terburu-buru. Soal tetap sama jika jawabanmu salah."}
                          </p>
                        </div>
                        <button
                          className="text-button exit-button"
                          onClick={() =>
                            isPlaying
                              ? setLeaveTo("practice")
                              : navigate("practice")
                          }
                        >
                          {isPlaying ? "Akhiri latihan" : "Ganti mode latihan"}
                          <ChevronRight size={15} />
                        </button>
                      </div>
                    )}
                  </section>

                  <section
                    className={`play-area ${isPlaying ? "is-playing" : ""} ${isFinished ? "is-finished" : ""}`}
                    aria-label="Area soal"
                  >
                    <div className="play-top">
                      <span className="mode-label">
                        <span className="mini-dot" />
                        {meta.name}
                        <span className="mode-label-divider">/</span>
                        {LEVELS[level - 1]}
                      </span>
                      <span className="preview-label">
                        {isPlaying
                          ? "Fokus & hitung"
                          : isFinished
                            ? "Bagus, kamu sudah berlatih!"
                            : "Pratinjau"}
                      </span>
                    </div>
                    <AnimatePresence mode="wait">
                      {isFinished ? (
                        <motion.div
                          key="result"
                          className="result-panel"
                          initial={{ opacity: 0, scale: 0.96 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ duration: 0.3 }}
                        >
                          <div className="trophy-illustration">
                            <span className="trophy-spark one">✦</span>
                            <Trophy size={44} strokeWidth={1.5} />
                            <span className="trophy-spark two">✧</span>
                          </div>
                          <span className="eyebrow">
                            SATU MENIT YANG BERARTI
                          </span>
                          <h2>
                            {session.correct > previousBest
                              ? "Rekor baru. Hebat!"
                              : session.correct > 0
                                ? "Kerja bagus!"
                                : "Awal yang berani!"}
                          </h2>
                          <p>
                            {session.correct > 0
                              ? "Pikiranmu baru saja menjadi sedikit lebih tajam."
                              : "Setiap percobaan membuatmu lebih dekat. Coba lagi, ya."}
                          </p>
                          <div className="result-score">
                            <strong>{session.correct}</strong>
                            <span>jawaban benar</span>
                          </div>
                          <div className="result-details">
                            <span>
                              <X size={15} />
                              {session.wrong} salah
                            </span>
                            <span>
                              <Target size={15} />
                              {accuracy(session.correct, session.wrong)}%
                              akurasi
                            </span>
                          </div>
                          <button className="primary-button" onClick={begin}>
                            <RotateCcw size={17} />
                            Latihan lagi
                            <ArrowRight size={18} />
                          </button>
                          <button
                            className="text-button"
                            onClick={() => navigate("history")}
                          >
                            Lihat perjalananmu
                            <ArrowUpRight size={15} />
                          </button>
                          <p className="result-storage">
                            <ShieldCheck size={13} />
                            {storageAvailable
                              ? "Hasil tersimpan di perangkat ini"
                              : "Penyimpanan tidak tersedia. Hasil sementara di sesi ini."}
                          </p>
                        </motion.div>
                      ) : (
                        <motion.div
                          key="question-area"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="question-area"
                        >
                          <div className="question-caption">
                            {isPlaying
                              ? "BERAPA HASILNYA?"
                              : "TANTANGAN KECIL, DAMPAK BESAR."}
                          </div>
                          <motion.div
                            className={`equation ${equationLength > 12 ? "equation-longest" : equationLength > 8 ? "equation-long" : ""}`}
                            key={question.key}
                            data-testid="question"
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            transition={{ duration: 0.12 }}
                          >
                            <span>
                              {question.a < 0
                                ? `(${formatNumber(question.a)})`
                                : formatNumber(question.a)}
                            </span>
                            <span className="equation-symbol">
                              {meta.symbol}
                            </span>
                            <span>
                              {question.b < 0
                                ? `(${formatNumber(question.b)})`
                                : formatNumber(question.b)}
                            </span>
                            <span className="equation-equals">=</span>
                            <span className="equation-unknown">?</span>
                          </motion.div>
                          <motion.div
                            className={`answer-box ${feedback === "wrong" ? "answer-wrong" : feedback === "correct" ? "answer-correct" : ""}`}
                            animate={
                              feedback === "wrong"
                                ? { x: [0, -5, 5, -3, 3, 0] }
                                : { x: 0 }
                            }
                            transition={{ duration: 0.3 }}
                          >
                            <input
                              aria-label="Jawaban"
                              readOnly
                              value={input}
                              placeholder={
                                isPlaying ? "Jawabanmu" : "Siap untuk mencoba?"
                              }
                              inputMode="none"
                              tabIndex={isPlaying ? 0 : -1}
                            />
                            <span
                              className="answer-cursor"
                              aria-hidden="true"
                            />
                          </motion.div>
                          <div
                            className={`feedback ${feedback ?? ""}`}
                            aria-live="polite"
                            aria-atomic="true"
                          >
                            {feedback === "correct" ? (
                              <>
                                <CheckCheck size={14} />
                                Tepat sekali! Lanjutkan.
                              </>
                            ) : feedback === "wrong" ? (
                              <>
                                <X size={14} />
                                Belum tepat. Coba soal yang sama.{" "}
                                <strong>−10 detik</strong>
                              </>
                            ) : (
                              <>
                                {isPlaying
                                  ? "Masukkan jawaban, lalu tekan kirim."
                                  : "Tekan “Mulai latihan” untuk mengaktifkan number pad."}
                              </>
                            )}
                          </div>
                          <div className="number-pad" aria-label="Number pad">
                            {["7", "8", "9", "4", "5", "6", "1", "2", "3"].map(
                              (number) => (
                                <button
                                  className="number-key"
                                  key={number}
                                  disabled={!isPlaying}
                                  onClick={() => press(number)}
                                >
                                  {number}
                                </button>
                              ),
                            )}
                            <button
                              className="number-key utility-key"
                              aria-label="Ubah tanda negatif"
                              disabled={!isPlaying || level < 4}
                              onClick={() => press("sign")}
                            >
                              ±
                            </button>
                            <button
                              className="number-key"
                              disabled={!isPlaying}
                              onClick={() => press("0")}
                            >
                              0
                            </button>
                            <button
                              className="number-key utility-key"
                              aria-label="Hapus digit terakhir"
                              disabled={!isPlaying}
                              onClick={() => press("backspace")}
                            >
                              <Delete size={21} />
                            </button>
                            <button
                              className="number-key clear-key"
                              disabled={!isPlaying}
                              onClick={() => press("clear")}
                              aria-label="Bersihkan jawaban"
                            >
                              C
                            </button>
                            <button
                              className="number-key decimal-key"
                              disabled={!isPlaying || level !== 5}
                              onClick={() => press(",")}
                              aria-label="Pemisah desimal"
                            >
                              ,
                            </button>
                            <button
                              className="number-key submit-key"
                              disabled={
                                !isPlaying ||
                                !/^-?\d+(?:,\d{1,2})?$/.test(input)
                              }
                              onClick={submit}
                              aria-label="Kirim jawaban"
                            >
                              <span>Kirim</span>
                              <ArrowRight size={18} />
                            </button>
                          </div>
                          <p className="keyboard-hint">
                            <Keyboard size={14} />
                            <span>
                              {isPlaying ? (
                                <>
                                  Bisa pakai keyboard <kbd>0–9</kbd>
                                  <kbd>↵</kbd>
                                </>
                              ) : (
                                "Number pad & keyboard. Pilih yang paling nyaman."
                              )}
                            </span>
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </section>
                </div>

                <div className="bottom-notes">
                  <span>
                    <ShieldCheck size={15} />
                    Tanpa akun. Langsung latihan.
                  </span>
                  <span>
                    <Leaf size={15} />
                    Kemajuan kecil tetaplah kemajuan.
                  </span>
                  <span>
                    <Trophy size={15} />
                    {best > 0
                      ? `Rekor mode ini: ${best} benar`
                      : "Rekor berikutnya menunggumu."}
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>
        <footer className="footer">
          <span>© {new Date().getFullYear()} Countify</span>
          <span>
            Dibuat untuk pikiran yang terus tumbuh.
            <Sparkles size={13} />
          </span>
          <span className="footer-signature">ONE MINUTE. A SHARPER YOU.</span>
        </footer>

        {help && (
          <Modal
            title="Satu menit untuk lebih tajam."
            onClose={() => setHelp(false)}
          >
            <p className="modal-description">
              Latihan sederhana, kemajuan yang terasa.
            </p>
            <ol className="help-steps">
              <li>
                <span>01</span>
                <div>
                  <strong>Pilih tantanganmu</strong>
                  <p>
                    Empat mode dan lima level. Mulai dari yang nyaman, lalu
                    naikkan tantangannya.
                  </p>
                </div>
              </li>
              <li>
                <span>02</span>
                <div>
                  <strong>Hitung dalam 60 detik</strong>
                  <p>
                    Gunakan number pad atau keyboard. Tekan Kirim atau Enter
                    untuk menjawab.
                  </p>
                </div>
              </li>
              <li>
                <span>03</span>
                <div>
                  <strong>Utamakan ketepatan</strong>
                  <p>
                    Jawaban salah mengurangi 10 detik. Soal tidak berubah sampai
                    kamu menjawab benar atau waktu habis.
                  </p>
                </div>
              </li>
            </ol>
            <div className="help-extra">
              <Lightbulb size={18} />
              <p>
                Level 4 mengenalkan negatif. Level 5 menambahkan desimal eksak
                hingga dua angka. Koma dan titik diterima dari keyboard; tidak
                perlu membulatkan.
              </p>
            </div>
            <p className="modal-fine-print">
              Timer tetap berjalan saat membuka bantuan atau berpindah tab.
              Riwayat hanya tersimpan di browser yang digunakan.
            </p>
            <button className="primary-button" onClick={() => setHelp(false)}>
              Mengerti, ayo latihan
              <ArrowRight size={18} />
            </button>
          </Modal>
        )}
        {leaveTo && (
          <Modal title="Akhiri latihan ini?" onClose={() => setLeaveTo(null)}>
            <p className="modal-description">
              Sesi yang dihentikan tidak masuk riwayat. Waktu tetap berjalan
              sampai sesi selesai atau kamu keluar.
            </p>
            <div className="modal-actions">
              <button
                className="secondary-button"
                onClick={() => setLeaveTo(null)}
              >
                Lanjutkan latihan
              </button>
              <button
                className="primary-button"
                onClick={() => {
                  updateSession(null);
                  updateInput("");
                  setFeedback(null);
                  setPage(leaveTo);
                  setLeaveTo(null);
                }}
              >
                Ya, akhiri
              </button>
            </div>
          </Modal>
        )}
        {clearHistory && (
          <Modal
            title="Hapus seluruh riwayat?"
            onClose={() => setClearHistory(false)}
          >
            <p className="modal-description">
              Riwayat latihan dan rekor di browser ini akan dihapus. Tindakan
              ini tidak bisa dibatalkan.
            </p>
            <div className="modal-actions">
              <button
                className="secondary-button"
                onClick={() => setClearHistory(false)}
              >
                Batal
              </button>
              <button
                className="primary-button"
                onClick={() => {
                  resultsRef.current = [];
                  setResults([]);
                  setStorageAvailable(saveResults([]));
                  setClearHistory(false);
                }}
              >
                Hapus riwayat
              </button>
            </div>
          </Modal>
        )}
      </div>
    </MotionConfig>
  );
}

export default App;
