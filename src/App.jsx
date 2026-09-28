import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import StoryLayoutController from "./scroll-story/runtime/StoryLayoutController.jsx";
import { setActiveLenis } from "./scroll-story/runtime/lenisBridge.js";
import { isStoryEditorMode, novaStoryStore } from "./story/novaStoryStore.js";

const PersistentLaptop3D = lazy(() => import("./PersistentLaptop3D.jsx"));
const ScrollStoryEditor = import.meta.env.DEV
  ? lazy(() => import("./scroll-story/editor/ScrollStoryEditor.jsx"))
  : null;

import heroBg from "../assets/hero/hero-background.webp";
import heroAtmosphere from "../assets/web/hero-atmosphere.webp";
import heroFgLeft from "../assets/web/hero-foreground-left.webp";
import heroFgRight from "../assets/web/hero-foreground-right.webp";

import finalBg from "../assets/final/final-background.webp";

gsap.registerPlugin(ScrollTrigger);

const Arrow = ({ direction = "right" }) => (
  <svg
    className={`arrow arrow--${direction}`}
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <path d="M5 12h13M13 6l6 6-6 6" />
  </svg>
);

function Nav() {
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const onScroll = () => setCompact(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={`site-nav ${compact ? "site-nav--compact" : ""}`}>
      <a className="brand" href="#top" aria-label="NOVA home">
        <span className="brand-mark" aria-hidden="true" />
        <span>NOVA</span>
      </a>

      <nav className="nav-links" aria-label="Primary navigation">
        <a href="#performance">Performance</a>
        <a href="#display">Display</a>
        <a href="#mobility">Mobility</a>
        <a href="#design">Design</a>
      </nav>

      <a className="nav-cta" href="#final">
        Explore NOVA <Arrow />
      </a>
    </header>
  );
}

function Hero() {
  const stageRef = useRef(null);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (reduceMotion || window.matchMedia("(max-width: 900px)").matches) {
      return;
    }

    let raf = 0;
    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;

    const onMove = (event) => {
      const rect = stage.getBoundingClientRect();
      targetX = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
      targetY = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
    };

    const onLeave = () => {
      targetX = 0;
      targetY = 0;
    };

    const tick = () => {
      currentX += (targetX - currentX) * 0.06;
      currentY += (targetY - currentY) * 0.06;
      stage.style.setProperty("--mx", currentX.toFixed(4));
      stage.style.setProperty("--my", currentY.toFixed(4));
      raf = requestAnimationFrame(tick);
    };

    stage.addEventListener("pointermove", onMove);
    stage.addEventListener("pointerleave", onLeave);
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      stage.removeEventListener("pointermove", onMove);
      stage.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return (
    <section className="hero-scroll" id="top">
      <div className="hero-stage" ref={stageRef}>
        <img
          src={heroBg}
          alt=""
          className="hero-layer hero-bg"
          aria-hidden="true"
          fetchPriority="high"
          decoding="async"
        />
        <img
          src={heroAtmosphere}
          alt=""
          className="hero-layer hero-atmosphere"
          aria-hidden="true"
          decoding="async"
        />

        <div className="hero-copy">
          <p className="eyebrow">NOVA / PROFESSIONAL COMPUTING</p>
          <h1>
            <span>POWER</span>
            <span className="hero-word hero-word--rear">WITHOUT</span>
            <span>BOUNDARIES</span>
          </h1>
          <p className="lede">
            Built for people who turn difficult ideas into real work.
          </p>
          <div className="button-row">
            <a className="button button--solid" href="#performance">
              Explore NOVA <Arrow />
            </a>
            <a className="button button--ghost" href="#display">
              Discover the display
            </a>
          </div>
        </div>

        <div className="hero-word-front" aria-hidden="true">
          WITHOUT
        </div>

        <img
          src={heroFgLeft}
          alt=""
          className="hero-layer hero-fg hero-fg--left"
          aria-hidden="true"
        />
        <img
          src={heroFgRight}
          alt=""
          className="hero-layer hero-fg hero-fg--right"
          aria-hidden="true"
        />

        <div className="hero-vignette" aria-hidden="true" />

        <div className="scroll-indicator" aria-hidden="true">
          <span>SCROLL</span>
          <i />
        </div>
      </div>
    </section>
  );
}

function StoryPanel({ chapter, eyebrow, title, body, metrics = [], label, note }) {
  return (
    <article className="story-panel" data-story-panel={chapter}>
      <div className="story-panel__copy">
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
        <p className="scene-body">{body}</p>
        {metrics.length ? (
          <div className="story-metrics">
            {metrics.map(([value, caption]) => (
              <div key={value + caption}>
                <strong>{value}</strong>
                <span>{caption}</span>
              </div>
            ))}
          </div>
        ) : null}
        {note ? <p className="story-note">{note}</p> : null}
      </div>
      {label ? (
        <div className="feature-callout" aria-hidden="true">
          <i />
          <span>{label}</span>
        </div>
      ) : null}
    </article>
  );
}

function Performance() {
  const panels = [
    {
      chapter: "PERFORMANCE",
      eyebrow: "NOVA / COMPUTE ARCHITECTURE",
      title: <>THE MACHINE<br />UNDER THE SURFACE.</>,
      body: "Scroll into the chassis. Every major subsystem is modeled as a real movable assembly, not a flattened illustration.",
      metrics: [["16-core", "Core Ultra 9"], ["RTX 5070", "Laptop GPU"], ["64 GB", "DDR5 memory"]],
      label: "SYSTEM / ASSEMBLED",
    },
    {
      chapter: "EXPLODE",
      eyebrow: "NOVA / SERVICE VIEW",
      title: <>ENGINEERED<br />IN LAYERS.</>,
      body: "The display, deck, thermal system, board and lower chassis separate in sequence while every component keeps its physical relationship.",
      metrics: [["4", "structural layers"], ["2", "blower fans"], ["2", "heat pipes"]],
      label: "EXPLODED ARCHITECTURE",
    },
    {
      chapter: "MOTHERBOARD",
      eyebrow: "01 / MAINBOARD",
      title: <>ONE BOARD.<br />EVERY SIGNAL.</>,
      body: "A low-profile asymmetric mainboard ties compute, memory, storage, power delivery and I/O together without wasting chassis volume.",
      metrics: [["DDR5", "dual SO-DIMM"], ["NVMe", "M.2 storage"], ["USB-C", "high-speed I/O"]],
      label: "MOTHERBOARD",
    },
    {
      chapter: "GPU",
      eyebrow: "02 / GRAPHICS",
      title: <>GEFORCE RTX.<br />BUILT IN.</>,
      body: "NVIDIA GeForce RTX 5070 Laptop GPU brings Blackwell graphics and creator acceleration into the compact NOVA thermal envelope.",
      metrics: [["4,608", "CUDA cores"], ["8 GB", "GDDR7"], ["50–100 W", "GPU subsystem"]],
      label: "NVIDIA GEFORCE RTX 5070",
      note: "Reference-class concept configuration.",
    },
    {
      chapter: "CPU",
      eyebrow: "03 / PROCESSOR",
      title: <>CORE ULTRA 9.<br />AT THE CENTER.</>,
      body: "Intel Core Ultra 9 285H provides a 16-core mobile compute platform with high burst performance for compile, render and creative workloads.",
      metrics: [["16", "CPU cores"], ["5.4 GHz", "max turbo"], ["45 W", "base power"]],
      label: "INTEL CORE ULTRA 9 285H",
    },
    {
      chapter: "MEMORY",
      eyebrow: "04 / MEMORY",
      title: <>MEMORY YOU<br />CAN SERVICE.</>,
      body: "Two removable SO-DIMM modules keep the machine upgradeable while preserving a dense professional internal layout.",
      metrics: [["64 GB", "2 × 32 GB"], ["DDR5-6400", "memory speed"], ["2", "SO-DIMM slots"]],
      label: "DUAL DDR5 SO-DIMM",
    },
    {
      chapter: "STORAGE",
      eyebrow: "05 / STORAGE",
      title: <>FAST STORAGE.<br />FULLY ACCESSIBLE.</>,
      body: "A dedicated M.2 NVMe module keeps project files and scratch workloads on a replaceable high-speed storage device.",
      metrics: [["2 TB", "concept capacity"], ["NVMe", "M.2 module"], ["PCIe 4.0", "interface"]],
      label: "M.2 NVMe SSD",
    },
    {
      chapter: "COOLING",
      eyebrow: "06 / THERMALS",
      title: <>MOVE HEAT.<br />NOT NOISE.</>,
      body: "Dual blowers, copper heat pipes and dense rear fin stacks move heat directly toward the concealed hinge exhaust.",
      metrics: [["2", "blower fans"], ["2", "copper heat pipes"], ["Rear", "concealed exhaust"]],
      label: "DUAL-FAN THERMAL MODULE",
    },
    {
      chapter: "BATTERY",
      eyebrow: "07 / BATTERY",
      title: <>POWER ACROSS<br />THE FLOORPLAN.</>,
      body: "Four broad cells occupy the front chassis volume, keeping mass low in the deck and leaving the rear to compute and cooling.",
      metrics: [["4-cell", "pack layout"], ["80 Wh", "concept capacity"], ["Low", "center of mass"]],
      label: "BATTERY PACK",
    },
    {
      chapter: "REASSEMBLE",
      eyebrow: "NOVA / INTEGRATION",
      title: <>BACK TO<br />ONE MACHINE.</>,
      body: "Each subsystem returns to its authored position before the exterior design sequence begins.",
      label: "REASSEMBLY",
    },
  ];

  return (
    <section className="scene scene--performance scene--product-film" id="performance">
      <div className="scene-stage">
        <div className="product-film-bg product-film-bg--dark" />
        <div className="product-film-grid" aria-hidden="true" />
        <div className="story-stack">
          {panels.map((panel) => <StoryPanel key={panel.chapter} {...panel} />)}
        </div>
        <div className="scene-index">02 / 06 · INTERNALS</div>
      </div>
    </section>
  );
}

function Display() {
  const panels = [
    {
      chapter: "DISPLAY",
      eyebrow: "NOVA / DISPLAY",
      title: <>A CANVAS<br />WITH DEPTH.</>,
      body: "The assembled machine returns for a sequence of physical exterior close-ups driven entirely by the same 3D model.",
      metrics: [["3.2K", "precision panel"], ["120 Hz", "motion"], ["100%", "wide-gamut intent"]],
      label: "DISPLAY ASSEMBLY",
    },
    {
      chapter: "SCREEN_THIN",
      eyebrow: "01 / DISPLAY SHELL",
      title: <>4.8 MM.<br />EDGE ON.</>,
      body: "The display shell is modeled at 4.8 mm, with a slim bezel, centered camera notch and a restrained structural edge.",
      metrics: [["4.8 mm", "lid shell"], ["Slim", "dark bezel"], ["Center", "camera notch"]],
      label: "4.8 MM DISPLAY SHELL",
    },
    {
      chapter: "PROFILE",
      eyebrow: "02 / PROFILE",
      title: <>14.8 MM.<br />CLOSED.</>,
      body: "The physical 3D stack itself defines the advertised thickness: a 10.0 mm base and a 4.8 mm lid.",
      metrics: [["14.8 mm", "closed profile"], ["10.0 mm", "base"], ["4.8 mm", "lid"]],
      label: "14.8 MM CLOSED PROFILE",
    },
    {
      chapter: "KEYBOARD",
      eyebrow: "03 / KEYBOARD",
      title: <>LIGHT,<br />KEY BY KEY.</>,
      body: "The camera glides horizontally across the actual modeled keyboard while each key carries its own cool-white light island and illuminated legend.",
      metrics: [["Per-key", "white lighting"], ["6 rows", "notebook layout"], ["QWERTY", "mesh legends"]],
      label: "PER-KEY BACKLIT KEYBOARD",
    },
    {
      chapter: "TOUCHPAD",
      eyebrow: "04 / TOUCHPAD",
      title: <>GLASS.<br />NO BUTTON LINE.</>,
      body: "A large centered glass-like surface keeps the palm deck quiet while a hidden haptic plate provides the mechanical story underneath.",
      metrics: [["142 × 80 mm", "surface"], ["Haptic", "underplate"], ["Centered", "deck geometry"]],
      label: "142 × 80 MM HAPTIC TOUCHPAD",
    },
  ];

  return (
    <section className="scene scene--display scene--product-film" id="display">
      <div className="scene-stage">
        <div className="product-film-bg product-film-bg--blue" />
        <div className="product-film-grid" aria-hidden="true" />
        <div className="story-stack">
          {panels.map((panel) => <StoryPanel key={panel.chapter} {...panel} />)}
        </div>
        <div className="scene-index">03 / 06 · EXTERIOR</div>
      </div>
    </section>
  );
}

function Mobility() {
  const panels = [
    {
      chapter: "PORTS_RIGHT",
      eyebrow: "05A / RIGHT I/O",
      title: <>DUAL USB-A.<br />READY.</>,
      body: "The right wall keeps the everyday data side simple: two full-size USB-A ports sit close together in recessed machined openings.",
      metrics: [["2 × USB-A", "right side"], ["Full-size", "data ports"], ["Recessed", "machined cavities"]],
      label: "RIGHT SIDE / 2 × USB-A",
    },
    {
      chapter: "PORTS_LEFT",
      eyebrow: "05B / LEFT I/O",
      title: <>WIRED. POWERED.<br />CONNECTED.</>,
      body: "The left wall carries the full workstation cluster: RJ45 Ethernet, dedicated charging, USB-C, two USB-A ports and a 3.5 mm headset jack.",
      metrics: [["RJ45", "Ethernet"], ["USB-C + 2 × USB-A", "data"], ["DC + 3.5 mm", "power / audio"]],
      label: "LEFT SIDE / RJ45 + CHARGE + USB-C + 2 × USB-A + AUDIO",
    },
    {
      chapter: "EXHAUST",
      eyebrow: "06 / EXHAUST",
      title: <>COOLING,<br />HIDDEN IN THE HINGE.</>,
      body: "The rear macro shot reveals two dense exhaust fin banks and their dark plenum directly beneath the hinge line.",
      metrics: [["30", "visible exhaust fins"], ["Dual", "rear banks"], ["Concealed", "normal viewing angle"]],
      label: "HINGE-LINE REAR EXHAUST",
    },
    {
      chapter: "SPEAKERS",
      eyebrow: "07 / SPEAKERS",
      title: <>SOUND,<br />AIMED UP.</>,
      body: "Dedicated perforation arrays flank the keyboard instead of disappearing into decorative side cuts.",
      metrics: [["2", "speaker zones"], ["3 × 18", "perforations each"], ["Upward", "firing layout"]],
      label: "UPWARD-FIRING SPEAKER GRILLES",
    },
  ];

  return (
    <section className="scene scene--mobility scene--product-film" id="mobility">
      <div className="scene-stage">
        <div className="product-film-bg product-film-bg--silver" />
        <div className="product-film-grid product-film-grid--dark" aria-hidden="true" />
        <div className="story-stack story-stack--dark">
          {panels.map((panel) => <StoryPanel key={panel.chapter} {...panel} />)}
        </div>
        <div className="scene-index scene-index--dark">04 / 06 · HARDWARE</div>
      </div>
    </section>
  );
}

function Details() {
  const panels = [
    {
      chapter: "HINGE",
      eyebrow: "08 / HINGE",
      title: <>CONTROLLED<br />RESISTANCE.</>,
      body: "A central torque spine, compact knuckles and anchored base brackets keep the display motion mechanically believable in macro view.",
      metrics: [["2", "hinge anchors"], ["1", "torque spine"], ["90°", "close animation"]],
      label: "HINGE MECHANISM",
    },
    {
      chapter: "EDGE",
      eyebrow: "09 / CHASSIS",
      title: <>GRAPHITE.<br />CUT CLEAN.</>,
      body: "Flat perimeter walls, a restrained edge highlight and recessed I/O keep the industrial design professional rather than decorative.",
      metrics: [["Graphite", "anodized language"], ["Flat", "perimeter walls"], ["Recessed", "port cavities"]],
      label: "MACHINED GRAPHITE EDGE",
    },
    {
      chapter: "CLOSEUP",
      eyebrow: "10 / PRODUCT MACRO",
      title: <>PHYSICAL<br />FROM EVERY ANGLE.</>,
      body: "The final macro orbit holds on real modeled geometry—screen, keys, trackpad, speakers, ports, hinge and exhaust—before the closing shot.",
      label: "NOVA / PHYSICAL DETAIL",
    },
  ];

  return (
    <section className="scene scene--design scene--product-film" id="design">
      <div className="scene-stage">
        <div className="product-film-bg product-film-bg--graphite" />
        <div className="product-film-grid" aria-hidden="true" />
        <div className="story-stack">
          {panels.map((panel) => <StoryPanel key={panel.chapter} {...panel} />)}
        </div>
        <div className="scene-index">05 / 06 · DESIGN</div>
      </div>
    </section>
  );
}

function FinalScene() {
  const panels = [
    {
      chapter: "FINAL",
      eyebrow: "NOVA / COMPLETE",
      title: <>ONE MACHINE.<br />FULLY RESOLVED.</>,
      body: "The same chassis that opened, exploded and revealed every detail returns to a clean product pose.",
      label: "NOVA",
    },
    {
      chapter: "CLOSE",
      eyebrow: "NOVA / CLOSE",
      title: <>LIGHTS OUT.<br />LID DOWN.</>,
      body: "Per-key illumination fades as the display closes on the modeled hinge axis—no crossfade, no replacement image.",
      label: "PHYSICAL LID MOTION",
    },
    {
      chapter: "NOVA",
      eyebrow: "NOVA / PROFESSIONAL COMPUTING",
      title: <>MADE FOR<br />WHAT COMES NEXT.</>,
      body: "A 14.8 mm concept workstation built as one continuous 3D product story.",
      metrics: [["14.8 mm", "closed profile"], ["RTX 5070", "Laptop GPU"], ["Core Ultra 9", "16-core CPU"]],
      label: "NOVA",
    },
  ];

  return (
    <section className="scene scene--final scene--product-film" id="final">
      <div className="scene-stage">
        <img className="scene-bg final-bg" src={finalBg} alt="" loading="lazy" decoding="async" />
        <div className="final-film-shade" />
        <div className="story-stack">
          {panels.map((panel) => <StoryPanel key={panel.chapter} {...panel} />)}
        </div>
        <div className="scene-index scene-index--light">06 / 06 · COMPLETE</div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="footer">
      <a className="brand brand--footer" href="#top">
        <span className="brand-mark" aria-hidden="true" />
        <span>NOVA</span>
      </a>
      <div className="footer-links">
        <a href="#performance">Performance</a>
        <a href="#display">Display</a>
        <a href="#mobility">Mobility</a>
        <a href="#design">Design</a>
      </div>
      <span className="footer-note">Concept product / 2026</span>
    </footer>
  );
}

function DeferredPersistentProduct() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    let timeoutId = 0;
    let idleId = 0;

    const mount = () => setMounted(true);

    if ("requestIdleCallback" in window) {
      idleId = window.requestIdleCallback(mount, { timeout: 260 });
    } else {
      timeoutId = window.setTimeout(mount, 90);
    }

    return () => {
      if (idleId && "cancelIdleCallback" in window) {
        window.cancelIdleCallback(idleId);
      }
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, []);

  if (!mounted) return null;

  return (
    <Suspense fallback={null}>
      <PersistentLaptop3D />
    </Suspense>
  );
}

export default function App() {
  const rootRef = useRef(null);
  const editorMode = import.meta.env.DEV && isStoryEditorMode();

  useEffect(() => {
    if (!editorMode) return undefined;
    novaStoryStore.restoreDraft();
    document.body.classList.add("scroll-story-editor-active");
    return () => document.body.classList.remove("scroll-story-editor-active");
  }, [editorMode]);

  useEffect(() => {
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    // The story editor requires exact, immediate scroll positions for
    // timeline scrubbing. Keep Lenis for the shipped experience only.
    if (editorMode || reduceMotion) {
      setActiveLenis(null);
      return undefined;
    }

    const lenis = new Lenis({
      // Lower lerp = more cinematic interpolation without making the long
      // scroll-story feel disconnected from the wheel.
      lerp: 0.075,
      autoRaf: true,
      smoothWheel: true,
      syncTouch: false,
      wheelMultiplier: 0.9,
      touchMultiplier: 1,
      stopInertiaOnNavigate: true,
      anchors: {
        offset: -64,
        duration: 1.0,
        easing: (t) => 1 - Math.pow(1 - t, 4),
      },
    });

    setActiveLenis(lenis);
    document.documentElement.classList.add("nova-lenis-active");

    const updateScrollTrigger = () => ScrollTrigger.update();

    // Let Lenis own its RAF loop. ScrollTrigger still updates on every Lenis
    // frame, while Lenis remains independent from GSAP ticker auto-sleep.
    lenis.on("scroll", updateScrollTrigger);

    requestAnimationFrame(() => {
      lenis.resize();
      ScrollTrigger.refresh();
    });

    return () => {
      lenis.off("scroll", updateScrollTrigger);
      lenis.destroy();
      setActiveLenis(null);
      document.documentElement.classList.remove("nova-lenis-active");
    };
  }, [editorMode]);

  useLayoutEffect(() => {
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (reduceMotion) return undefined;

    const ctx = gsap.context(() => {
      const heroTl = gsap.timeline({
        scrollTrigger: {
          trigger: ".hero-scroll",
          start: "top top",
          end: "bottom bottom",
          scrub: 1.1,
        },
      });

      heroTl
        .to(
          ".hero-bg",
          { scale: 1.09, yPercent: -1.8, ease: "none" },
          0
        )
        .to(
          ".hero-atmosphere",
          { xPercent: -3.5, yPercent: -6, scale: 1.06, ease: "none" },
          0
        )
        .to(".hero-fg--left", { yPercent: -2, xPercent: -0.5, scale: 1.01, ease: "none" }, 0)
        .to(".hero-fg--right", { yPercent: -3, xPercent: 0.8, scale: 1.01, ease: "none" }, 0)
        .to(".hero-copy", { yPercent: -18, opacity: 0.28, ease: "none" }, 0.48)
        .to(".hero-word-front", { yPercent: -20, opacity: 0.08, ease: "none" }, 0.48)
        .to(".scroll-indicator", { opacity: 0, ease: "none" }, 0.2);

      gsap.to(".final-bg", {
        scale: 1.06,
        xPercent: -1.5,
        ease: "none",
        scrollTrigger: {
          trigger: ".scene--final",
          start: "top bottom",
          end: "bottom top",
          scrub: 1.15,
        },
      });

    }, rootRef);

    return () => ctx.revert();
  }, []);

  return (
    <div className="app-shell" ref={rootRef}>
      <StoryLayoutController store={novaStoryStore} />
      <DeferredPersistentProduct />
      {editorMode && ScrollStoryEditor ? (
        <Suspense fallback={null}>
          <ScrollStoryEditor
            store={novaStoryStore}
            savePath="src/story/nova-story.json"
          />
        </Suspense>
      ) : null}
      <Nav />
      <main>
        <Hero />
        <Performance />
        <Display />
        <Mobility />
        <Details />
        <FinalScene />
      </main>
      <Footer />
    </div>
  );
}
