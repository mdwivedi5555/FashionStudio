import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import logo from "@/assets/logo.svg";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Check,
  Layers,
  Images,
  Move3d,
  Quote,
  ScanSearch,
  Sparkles,
  UploadCloud,
  Workflow,
} from "lucide-react";
import { Link } from "react-router";

const PIPELINE = [
  {
    icon: UploadCloud,
    title: "Asset Ingestion",
    body: "Drag-and-drop flat-lays, mannequins, and model references — plus 3D garment renders from CLO Virtual Fashion, before samples exist.",
  },
  {
    icon: Workflow,
    title: "VTON Pipeline",
    body: "Catalog engine for fabric-true PDP renders, campaign engine for prompt-directed styling, with an automatic fallback circuit breaker.",
  },
  {
    icon: Layers,
    title: "Bulk Queue",
    body: "Map hundreds of SKUs via CSV and let the async worker render overnight — straight into your gallery, no timeouts.",
  },
];

const MODES = [
  {
    name: "Catalog Mode",
    tag: "FASHN v1.6-class",
    body: "Absolute fabric fidelity, pattern preservation, and sharp textures built for PDP zoom.",
  },
  {
    name: "Campaign Mode",
    tag: "FLUX VTON Pro-class",
    body: "Prompt-directed styling — tucked in, flowing in the wind, art-directed scenes.",
  },
  {
    name: "Fallback",
    tag: "CatVTON-class",
    body: "A programmatic circuit breaker that keeps render velocity when primaries degrade.",
  },
];

const AESTHETIC = [
  {
    icon: ScanSearch,
    title: "Lighting Controls",
    body: "Sliders map directly to photographic language — directional key light, fill ratio 3:1, tungsten or daylight balance.",
  },
  {
    icon: Sparkles,
    title: "PROMPT PULSE",
    body: "One toggle overrides standard parameters and renders garments as vintage editorial poster art for luxury campaigns.",
  },
  {
    icon: Images,
    title: "Render Gallery",
    body: "Every finished frame lands in a secure, filterable gallery with full provenance — engine, settings, SKU.",
  },
];

const PRICING = [
  {
    name: "Atelier",
    price: "$19",
    cadence: "/ month",
    blurb: "For indie labels and first drops.",
    features: ["200 renders / mo", "Catalog + Campaign engines", "Standard gallery", "Email support"],
    cta: "Start in the studio",
    featured: false,
  },
  {
    name: "Studio",
    price: "$79",
    cadence: "/ month",
    blurb: "For growing e-commerce teams.",
    features: [
      "1,200 renders / mo",
      "PROMPT PULSE aesthetic engine",
      "Bulk CSV queue (500 rows)",
      "Priority rendering",
    ],
    cta: "Open the studio",
    featured: true,
  },
  {
    name: "Wholesale",
    price: "Custom",
    cadence: "",
    blurb: "For MSME-scale operations.",
    features: [
      "Volume render pricing",
      "Net-30 corporate invoicing",
      "Dedicated render capacity",
      "API access",
    ],
    cta: "Talk to the atelier desk",
    featured: false,
  },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Luxemee" className="size-8" />
            <span className="studio-serif text-lg tracking-wide">LUXEMEE</span>
          </div>
          <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
            <a href="#pipeline" className="transition-colors hover:text-foreground">Pipeline</a>
            <a href="#modes" className="transition-colors hover:text-foreground">Engines</a>
            <a href="#aesthetic" className="transition-colors hover:text-foreground">Aesthetic</a>
            <a href="#pricing" className="transition-colors hover:text-foreground">Pricing</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/dashboard">
              <Button variant="ghost" size="sm">Sign in</Button>
            </Link>
            <Link to="/dashboard">
              <Button size="sm" className="gap-2">
                Enter Studio <ArrowRight className="size-4" />
              </Button>
            </Link>
        </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border/70">
        <div className="pointer-events-none absolute inset-0 studio-grain" />
        <div className="mx-auto grid max-w-6xl gap-12 px-6 py-24 lg:grid-cols-[1.1fr_0.9fr] lg:py-32">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="flex flex-col justify-center"
          >
            <p className="studio-eyebrow">AI Fashion Studio — E-Commerce Image Engine</p>
            <h1 className="studio-serif mt-5 text-5xl leading-[1.05] tracking-tight sm:text-6xl">
              The photoshoot,
              <br />
              <span className="italic text-muted-foreground">without the photoshoot.</span>
            </h1>
            <p className="mt-6 max-w-md text-base leading-7 text-muted-foreground">
              Luxemee turns flat-lays, mannequins, and 3D garment renders into
              production-ready on-model photography — catalog-true for PDP,
              art-directed for campaign.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link to="/dashboard">
                <Button size="lg" className="gap-2">
                  Enter the Studio <ArrowRight className="size-4" />
                </Button>
              </Link>
              <a href="#pipeline">
                <Button size="lg" variant="outline">See the pipeline</Button>
              </a>
            </div>
            <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-2">
                <Check className="size-3.5 text-studio-gold" /> Fabric-true renders
              </span>
              <span className="inline-flex items-center gap-2">
                <Check className="size-3.5 text-studio-gold" /> 3D-first workflow
              </span>
              <span className="inline-flex items-center gap-2">
                <Check className="size-3.5 text-studio-gold" /> Overnight bulk queue
              </span>
            </div>
          </motion.div>

          {/* Framed gallery card */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.15, ease: "easeOut" }}
            className="relative hidden items-center justify-center lg:flex"
          >
            <div className="studio-frame studio-frame-hover relative w-full max-w-sm rotate-[1.5deg] p-3">
              <div className="studio-pulse relative aspect-[3/4] overflow-hidden">
                <svg viewBox="0 0 300 400" className="h-full w-full" aria-hidden>
                  <rect width="300" height="400" fill="oklch(0.978 0.003 90)" />
                  <path
                    d="M150 110 C 110 118 92 150 96 200 L 110 300 L 190 300 L 204 200 C 208 150 190 118 150 110 Z"
                    fill="oklch(0.45 0.06 70)"
                    opacity="0.9"
                  />
                  <path
                    d="M96 200 C 110 218 190 218 204 200"
                    stroke="oklch(0.35 0.05 70)"
                    strokeWidth="1.5"
                    fill="none"
                    opacity="0.6"
                  />
                  <ellipse cx="150" cy="330" rx="60" ry="8" fill="oklch(0.35 0.03 80)" opacity="0.18" />
                  <line x1="40" y1="352" x2="260" y2="352" stroke="oklch(0.4 0.03 80)" strokeWidth="1" opacity="0.35" />
                  <text x="150" y="378" textAnchor="middle" fontFamily="Georgia, serif" fontSize="11" letterSpacing="4" fill="oklch(0.4 0.02 80)">LOOK 01 — PDP</text>
                </svg>
              </div>
              <p className="mt-3 text-center text-[11px] tracking-[0.2em] text-muted-foreground">
                FIG. 01 — CATALOG RENDER
              </p>
            </div>
            <div className="studio-frame absolute bottom-8 right-8 hidden w-40 rotate-[-3deg] p-2 sm:block">
              <div className="studio-pulse relative aspect-[3/4] overflow-hidden">
                <svg viewBox="0 0 300 400" className="h-full w-full" aria-hidden>
                  <rect width="300" height="400" fill="oklch(0.93 0.02 75)" />
                  <circle cx="150" cy="160" r="86" fill="none" stroke="oklch(0.5 0.09 60)" strokeWidth="1.5" opacity="0.7" />
                  <path
                    d="M150 120 C 118 128 104 156 108 200 L 120 290 L 180 290 L 192 200 C 196 156 182 128 150 120 Z"
                    fill="oklch(0.52 0.09 60)"
                    opacity="0.85"
                  />
                  <text x="150" y="360" textAnchor="middle" fontFamily="Georgia, serif" fontSize="12" letterSpacing="3" fill="oklch(0.35 0.04 60)">PULSE</text>
                </svg>
              </div>
              <p className="mt-2 text-center text-[10px] tracking-[0.2em] text-muted-foreground">FIG. 02 — PROMPT PULSE</p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Pipeline */}
      <section id="pipeline" className="border-b border-border/70">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <p className="studio-eyebrow">The Pipeline</p>
          <h2 className="studio-serif mt-3 text-3xl tracking-tight sm:text-4xl">
            From asset to on-model, in three movements
          </h2>
          <div className="mt-12 grid gap-px overflow-hidden rounded-sm border border-border bg-border md:grid-cols-3">
            {PIPELINE.map((step, i) => (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="bg-card p-8"
              >
                <div className="flex items-center justify-between">
                  <step.icon className="size-5 text-muted-foreground" />
                  <span className="studio-serif text-2xl text-border">0{i + 1}</span>
                </div>
                <h3 className="mt-6 text-base font-medium">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{step.body}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Modes */}
      <section id="modes" className="border-b border-border/70 bg-studio-sand/40">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="studio-eyebrow">Engines</p>
              <h2 className="studio-serif mt-3 text-3xl tracking-tight sm:text-4xl">
                Three engines, one circuit breaker
              </h2>
            </div>
            <p className="max-w-sm text-sm leading-6 text-muted-foreground">
              Primary inference is offloaded server-side; a fallback keeps velocity
              when primaries degrade. Your pipeline never stalls.
            </p>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {MODES.map((m, i) => (
              <motion.div
                key={m.name}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                className="studio-frame studio-frame-hover p-6"
              >
                <div className="flex items-center justify-between">
                  <h3 className="studio-serif text-xl">{m.name}</h3>
                  <Badge variant="outline" className="rounded-none border-border text-[10px] tracking-widest">
                    {m.tag}
                  </Badge>
                </div>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{m.body}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Aesthetic */}
      <section id="aesthetic" className="border-b border-border/70">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <p className="studio-eyebrow">Aesthetic Engine</p>
          <h2 className="studio-serif mt-3 text-3xl tracking-tight sm:text-4xl">
            Art direction, engineered
          </h2>
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {AESTHETIC.map((a, i) => (
              <motion.div
                key={a.title}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y:0 }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
              >
                <a.icon className="size-5 text-muted-foreground" />
                <h3 className="mt-4 text-base font-medium">{a.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{a.body}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Quote */}
      <section className="border-b border-border/70 bg-studio-canvas">
        <div className="mx-auto max-w-3xl px-6 py-20 text-center">
          <Quote className="mx-auto size-5 text-muted-foreground" />
          <p className="studio-serif mx-auto mt-6 max-w-2xl text-2xl leading-relaxed">
            “We shot our entire pre-collection in 3D and let Luxemee render the
            campaign before a single sample was sewn.”
          </p>
          <p className="mt-6 text-xs tracking-[0.18em] text-muted-foreground">
            ATELIER MARCHETTI — CREATIVE DIRECTOR
          </p>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="border-b border-border/70">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <p className="studio-eyebrow">Pricing</p>
          <h2 className="studio-serif mt-3 text-3xl tracking-tight sm:text-4xl">
            Credit-based. Enterprise-ready.
          </h2>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {PRICING.map((tier, i) => (
              <motion.div
                key={tier.name}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                className={`studio-frame studio-frame-hover flex flex-col p-8 ${
                  tier.featured ? "border-foreground/40" : ""
                }`}
              >
                <div className="flex items-center justify-between">
                  <h3 className="studio-serif text-xl">{tier.name}</h3>
                  {tier.featured && (
                    <Badge className="rounded-none bg-foreground text-background">Most chosen</Badge>
                  )}
                </div>
                <div className="mt-6 flex items-baseline gap-1">
                  <span className="studio-serif text-4xl">{tier.price}</span>
                  <span className="text-sm text-muted-foreground">{tier.cadence}</span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{tier.blurb}</p>
                <ul className="mt-6 flex-1 space-y-3 text-sm">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5">
                      <Check className="mt-0.5 size-3.5 text-studio-gold" />
                      <span className="text-muted-foreground">{f}</span>
                    </li>
                  ))}
                </ul>
                <Link to="/dashboard" className="mt-8">
                  <Button className={`w-full ${tier.featured ? "" : "variant-outline"}`} variant={tier.featured ? "default" : "outline"}>
                    {tier.cta}
                  </Button>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 studio-grain" />
        <div className="mx-auto max-w-6xl px-6 py-24 text-center">
          <p className="studio-eyebrow">Phase 1 — The Image Engine</p>
          <h2 className="studio-serif mt-4 text-4xl tracking-tight sm:text-5xl">
            Hang the first look tonight.
          </h2>
          <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-muted-foreground">
            Start with 25 welcome credits. No card required to render your first look.
          </p>
          <Link to="/dashboard" className="mt-8 inline-block">
            <Button size="lg" className="gap-2">
              Enter the Studio <ArrowRight className="size-4" />
            </Button>
          </Link>
        </div>
      </section>

      <footer className="border-t border-border/70">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-10 text-xs text-muted-foreground sm:flex-row">
          <div className="flex items-center gap-2">
            <img src={logo} alt="Luxemee" className="size-6" />
            <span className="studio-serif text-sm tracking-wide text-foreground">LUXEMEE</span>
          </div>
          <p>AI Fashion Studio — E-Commerce Image Engine</p>
          <p>© 2026 Luxemee Studio</p>
        </div>
      </footer>
    </div>
  );
}
