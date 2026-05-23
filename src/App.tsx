import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

function trackEvent(action: string, params?: Record<string, unknown>) {
  (window as any).gtag?.('event', action, params);
}

// ------------------------------
// Supabase client
// ------------------------------
const SUPABASE_URL = "https://aziykyepzmgdstjzrdvc.supabase.co";
const SUPABASE_KEY = "sb_publishable_jyAF9Z24hYKGYY7ByY4SCg_67GuunlZ";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const APP_VERSION = "22.0";

// ------------------------------
// Types
// ------------------------------
export type Edition = '1st' | 'Unlim' | 'Error';

export type Mode = 'dark' | 'light';

export type Settings = {
  id: number;
  title: string;
  tagline: string;
  accent: string;
  mode: Mode;
  icon_url: string | null;
};

export const THEMES: Array<{ name: string; dark: string; light: string }> = [
  { name: "Mew",      dark: "#cb97a5", light: "#a35d70" },
  { name: "Sky",      dark: "#7dd3fc", light: "#0284c7" },
  { name: "Mint",     dark: "#86efac", light: "#16a34a" },
  { name: "Lavender", dark: "#c084fc", light: "#9333ea" },
  { name: "Sunset",   dark: "#fbbf24", light: "#d97706" },
  { name: "Coral",    dark: "#fb7185", light: "#e11d48" },
];

const DEFAULT_ICON = "https://mew.cards/img/logo.png";

const DEFAULT_SETTINGS: Settings = {
  id: 1,
  title: "Collect",
  tagline: "Card Gallery",
  accent: THEMES[0].dark,
  mode: 'dark',
  icon_url: null,
};

function hexToRgb(hex: string): string {
  const m = hex.replace('#', '').match(/.{2}/g);
  if (!m || m.length < 3) return "203 151 165";
  return m.slice(0, 3).map(h => parseInt(h, 16)).join(' ');
}

function applyAccent(hex: string) {
  document.documentElement.style.setProperty('--accent', hex);
  document.documentElement.style.setProperty('--accent-rgb', hexToRgb(hex));
}

function applyMode(mode: Mode) {
  document.documentElement.setAttribute('data-mode', mode);
}

function findThemeByAccent(accent: string): { name: string; dark: string; light: string } | undefined {
  const a = accent.toLowerCase();
  return THEMES.find(t => t.dark.toLowerCase() === a || t.light.toLowerCase() === a);
}

export type Card = {
  id: string;
  name: string;
  number?: string | null;
  set?: string | null;
  year?: number | null;
  release?: string | null;
  rarity?: string | null;
  era?: string | null;
  language?: string | null;
  image?: string | null;
  image_back?: string | null;
  illustrator?: string | null;
  notes?: string | null;
  origin?: string | null;
  edition?: Edition | null;
  is_mew?: boolean;
  is_cameo?: boolean;
  is_intl?: boolean;
  pc?: string | null;
};

// ------------------------------
// Helpers
// ------------------------------
type FilterState = { q: string; mew: boolean; cameo: boolean; intl: boolean; sortDesc: boolean };

function applyFilters(cards: Card[], f: FilterState): Card[] {
  let items = [...cards];

  if (f.q.trim()) {
    const term = f.q.trim().toLowerCase();
    items = items.filter((c) =>
      [c.name, c.number, c.set, c.rarity, c.notes, c.origin]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(term))
    );
  }

  const anyTag = f.mew || f.cameo || f.intl;
  if (!anyTag) return [];

  items = items.filter(
    (c) => (f.mew && c.is_mew) || (f.cameo && c.is_cameo) || (f.intl && c.is_intl)
  );

  items.sort((a, b) => f.sortDesc ? releaseTs(b) - releaseTs(a) : releaseTs(a) - releaseTs(b));
  return items;
}

function classNames(...xs: Array<string | false | null | undefined>): string {
  return xs.filter(Boolean).join(" ");
}

function formatDate(dateString: string | null | undefined): string | undefined {
  if (!dateString) return undefined;
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  const year = date.getUTCFullYear();
  const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
  const day = date.getUTCDate().toString().padStart(2, '0');
  if (year < 1990 || year > 2050) return dateString;
  return `${year}-${month}-${day}`;
}

const IMG_FALLBACK = `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 300 420'><rect width='100%' height='100%' fill='%23121212'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' fill='%23666' font-family='sans-serif' font-size='14'>Image unavailable</text></svg>`;
function handleImgError(e: React.SyntheticEvent<HTMLImageElement>) {
  const img = e.currentTarget; if (img.src !== IMG_FALLBACK) img.src = IMG_FALLBACK;
}

function releaseTs(card: Card): number {
  if (card.release) {
    const t = Date.parse(card.release);
    if (!Number.isNaN(t)) return t;
  }
  if (card.year && Number.isFinite(card.year) && card.year > 0) {
    return new Date(card.year, 0, 1).getTime();
  }
  return Number.POSITIVE_INFINITY;
}

// ------------------------------
// 3D tilt + glare
// ------------------------------
const TiltCardButton: React.FC<{ ariaLabel: string; onClick: () => void; children: React.ReactNode }> = ({ ariaLabel, onClick, children }) => {
  const ref = React.useRef<HTMLButtonElement>(null);
  const glareRef = React.useRef<HTMLDivElement>(null);
  const prefersReduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  const reset = () => {
    const el = ref.current; if (!el) return;
    el.style.transition = 'transform 150ms ease';
    el.style.transform = 'perspective(900px) rotateX(0deg) rotateY(0deg)';
    if (glareRef.current) glareRef.current.style.opacity = '0';
    window.setTimeout(() => { if (el) el.style.transition = ''; }, 160);
  };

  const onMove = (e: React.MouseEvent) => {
    if (prefersReduced) return;
    const el = ref.current; if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    const max = 24;
    const rx = (py - 0.5) * -max;
    const ry = (px - 0.5) * max;
    el.style.transform = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg)`;

    if (glareRef.current) {
      const tiltMag = Math.min(1, Math.hypot(rx, ry) / max);
      const gx = 50 + (-ry / max) * 35;
      const gy = 50 + (rx / max) * 35;
      const baseAlpha = 0.45 + 0.25 * tiltMag;
      const alpha = (baseAlpha * 0.70).toFixed(2);
      glareRef.current.style.opacity = `${alpha}`;
      glareRef.current.style.background = `radial-gradient(650px circle at ${gx}% ${gy}%, rgba(255,255,255,${alpha}), transparent 40%)`;
    }
  };

  return (
    <button
      ref={ref}
      aria-label={ariaLabel}
      onClick={onClick}
      onMouseMove={onMove}
      onMouseLeave={reset}
      onMouseEnter={() => { const el = ref.current; if (el) el.style.willChange = 'transform'; }}
      className="group relative block w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-page focus-visible:ring-accent rounded-[4.2%]"
      style={{ transformStyle: 'preserve-3d' } as React.CSSProperties}
    >
      {children}
      <div ref={glareRef} className="pointer-events-none absolute inset-0 opacity-0 mix-blend-screen z-10 transition-opacity duration-150" />
    </button>
  );
};

const BackgroundGradient: React.FC = () => (
  <div
    aria-hidden="true"
    className="pointer-events-none fixed inset-0 z-0"
    style={{ background: `linear-gradient(to top left, rgb(var(--accent-rgb) / 0.15), transparent 40%)` }}
  />
);

// ------------------------------
// Main component
// ------------------------------
export default function PokeCardGallery() {
  const [cards, setCards] = useState<Card[]>([]);
  const [dataStatus, setDataStatus] = useState<'loading' | 'loaded'>('loading');
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [imagesLoaded, setImagesLoaded] = useState(false);

  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Card | null>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [mew, setMew] = useState(true);
  const [cameo, setCameo] = useState(false);
  const [intl, setIntl] = useState(false);
  const [releaseSortDesc, setReleaseSortDesc] = useState(false);

  const [swirlEpoch] = useState(() => Date.now());
  const swirlDelay = useMemo(() => -((Date.now() - swirlEpoch) % 5000) / 1000, [swirlEpoch]);

  useEffect(() => { document.title = settings.title; }, [settings.title]);
  useEffect(() => { applyAccent(settings.accent); }, [settings.accent]);
  useEffect(() => { applyMode(settings.mode); }, [settings.mode]);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from('settings').select('*').eq('id', 1).single();
      if (data && !error) {
        setSettings({
          id: data.id,
          title: data.title ?? DEFAULT_SETTINGS.title,
          tagline: data.tagline ?? DEFAULT_SETTINGS.tagline,
          accent: data.accent ?? DEFAULT_SETTINGS.accent,
          mode: (data.mode === 'light' ? 'light' : 'dark') as Mode,
          icon_url: data.icon_url ?? null,
        });
      } else if (error) {
        console.warn("Settings fetch failed (using defaults):", error.message);
      }
    })();
  }, []);

  useEffect(() => {
    if (!q.trim()) return;
    const t = setTimeout(() => trackEvent('search', { search_term: q.trim() }), 800);
    return () => clearTimeout(t);
  }, [q]);

  const fetchCards = async () => {
    const { data, error } = await supabase.from('cards').select('*');
    if (error) {
      console.error("Failed to fetch cards:", error);
      setCards([]);
    } else {
      setCards(data || []);
    }
    setDataStatus('loaded');
  };

  useEffect(() => { fetchCards(); }, []);

  useEffect(() => {
    if (dataStatus !== 'loaded') return;

    const imageUrls = cards.flatMap(c => [c.image, c.image_back]).filter(Boolean) as string[];
    if (imageUrls.length === 0) { setImagesLoaded(true); return; }

    let loadedCount = 0;
    const totalCount = imageUrls.length;
    setLoadingProgress(0);
    setImagesLoaded(false);

    imageUrls.forEach(url => {
      const img = new Image();
      img.src = url;
      const onFinish = () => {
        loadedCount++;
        const progress = Math.round((loadedCount / totalCount) * 100);
        setLoadingProgress(progress);
        if (loadedCount === totalCount) setTimeout(() => setImagesLoaded(true), 400);
      };
      img.onload = onFinish;
      img.onerror = onFinish;
    });
  }, [cards, dataStatus]);

  const filtered = useMemo(
    () => applyFilters(cards, { q, mew, cameo, intl, sortDesc: releaseSortDesc }),
    [q, mew, cameo, intl, cards, releaseSortDesc]
  );

  if (dataStatus === 'loading' || !imagesLoaded) {
    return <LoadingScreen progress={loadingProgress} swirlDelay={swirlDelay} iconUrl={settings.icon_url || DEFAULT_ICON} />;
  }

  return (
    <div className="relative min-h-screen bg-page font-sans text-fg">
      <BackgroundGradient />
      <header className="sticky top-0 z-40 border-b border-line/60 bg-black/30 backdrop-blur">
        <div className="mx-auto max-w-7xl px-3 py-2">
          <div className="flex w-full flex-row flex-wrap items-center gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <img src={settings.icon_url || DEFAULT_ICON} alt="Logo" className="h-8 w-8" onError={(e) => { (e.currentTarget as HTMLImageElement).src = DEFAULT_ICON; }} />
              <div>
                <h1 className="text-base sm:text-lg font-semibold tracking-tight">{settings.title}</h1>
                <div className="-mt-0.5 text-[11px] text-fg-muted">{settings.tagline}</div>
              </div>
            </div>
            <div className="flex w-full flex-row flex-wrap items-center gap-2 sm:w-auto sm:flex-row sm:items-center sm:gap-3">
              <div className="flex flex-wrap items-center gap-1">
                <Toggle label="Mew" active={mew} onClick={() => { setMew(v => !v); trackEvent('filter_toggle', { filter: 'mew', active: !mew }); }} />
                <Toggle label="Cameo" active={cameo} onClick={() => { setCameo(v => !v); trackEvent('filter_toggle', { filter: 'cameo', active: !cameo }); }} />
                <Toggle label="Intl" active={intl} onClick={() => { setIntl(v => !v); trackEvent('filter_toggle', { filter: 'intl', active: !intl }); }} />
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setReleaseSortDesc(v => !v)}
                  aria-label={releaseSortDesc ? "Sort by date: new to old" : "Sort by date: old to new"}
                  className="hidden sm:inline-flex text-[12px] text-fg-muted hover:text-fg px-1 py-0.5 rounded outline-none focus:outline-none"
                >
                  {releaseSortDesc ? "Date ▼" : "Date ▲"}
                </button>
                <div className="relative w-36 sm:w-60">
                  <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="w-full h-8 rounded-lg border border-white/20 bg-white/10 backdrop-blur-sm px-3 pr-8 text-[13px] text-fg placeholder:text-fg-muted shadow-sm outline-none focus:ring-2 focus:ring-accent" />
                  {q && (
                    <button onClick={() => setQ('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full text-gray-500 hover:text-fg hover:bg-surface-2" aria-label="Clear search">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-7xl px-4 pt-8 pb-16">
        {cards.length === 0 ? (
          <EmptyDatabase onSeeded={fetchCards} />
        ) : filtered.length === 0 ? (
          <EmptyFiltered />
        ) : (
          <ul key={`sort:${releaseSortDesc ? "desc" : "asc"}`} className="grid grid-cols-2 gap-6 sm:gap-8 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {filtered.map((card) => (
              <li key={card.id}>
                <TiltCardButton onClick={() => { setSelected(card); trackEvent('card_click', { card_name: card.name, card_set: card.set, card_number: card.number }); }} ariaLabel={`Open details for ${card.name} ${card.set || ''} ${card.number || ''}`}>
                  <div className="relative aspect-[63/88] w-full overflow-hidden bg-card" style={{ borderRadius: "5.2% / 3.9%" }}>
                    <img
                      src={card.image || IMG_FALLBACK}
                      alt={card.name}
                      className="h-full w-full object-fill"
                      style={{ aspectRatio: "63/88" }}
                      onError={handleImgError}
                      referrerPolicy="strict-origin-when-cross-origin"
                    />
                    {card.edition?.toLowerCase() === 'error' && (
                      <div className="absolute bottom-[10%] left-0 right-0 py-2 text-center text-[11px] font-bold uppercase tracking-wide text-white" style={{ backgroundImage: 'repeating-linear-gradient(-45deg, rgba(220,38,38,0.8) 0, rgba(220,38,38,0.8) 1.5px, transparent 1.5px, transparent 4.5px)', textShadow: '0 0 4px rgba(220,38,38,1), 0 0 8px rgba(220,38,38,0.9), 1px 1px 0 rgba(180,0,0,0.8), -1px -1px 0 rgba(180,0,0,0.8)' }}>
                        Error
                      </div>
                    )}
                  </div>
                </TiltCardButton>
                <div className="mt-1.5 flex h-5 items-center justify-between gap-1.5 px-1">
                  <span className="text-[10px] font-semibold text-accent truncate">
                    {card.number && card.number !== "N/A" ? card.number : ''}
                  </span>
                  <div className="flex flex-wrap items-center justify-end gap-1.5">
                    {card.year ? <InfoPill label={String(card.year)} /> : null}
                    {card.rarity ? <InfoPill label={card.rarity} /> : null}
                    {card.edition ? <InfoPill label={card.edition} /> : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>

      <div className="fixed bottom-4 left-4 z-50 flex flex-col items-center gap-1">
        <button
          type="button"
          onClick={() => { setShowEdit(true); trackEvent('edit_modal_open'); }}
          aria-label="Edit cards"
          className="rounded-lg sm:rounded-none p-2 sm:p-1.5 bg-black/50 sm:bg-transparent border border-white/10 sm:border-transparent focus:outline-none"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 opacity-50 hover:opacity-100 transition-opacity duration-150" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => { setShowSettings(true); trackEvent('settings_modal_open'); }}
          aria-label="Settings"
          className="rounded-lg sm:rounded-none p-2 sm:p-1.5 bg-black/50 sm:bg-transparent border border-white/10 sm:border-transparent focus:outline-none"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 opacity-50 hover:opacity-100 transition-opacity duration-150" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
      </div>

      {selected && <DetailModal card={selected} onClose={() => setSelected(null)} />}
      {showEdit && (
        <EditSheet
          cards={cards}
          setCards={setCards}
          onClose={() => setShowEdit(false)}
        />
      )}
      {showSettings && (
        <SettingsModal
          settings={settings}
          setSettings={setSettings}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}

// ------------------------------
// Reusable bits
// ------------------------------
const InfoPill: React.FC<{ label: string }> = ({ label }) => (
  <span className="rounded bg-zinc-800/60 px-1.5 py-0.5 text-[10px] font-semibold text-fg-muted backdrop-blur-sm">
    {label}
  </span>
);

const Toggle: React.FC<{ label: string; active: boolean; onClick: () => void }> = ({ label, active, onClick }) => (
  <button
    onClick={onClick}
    className={classNames(
      "rounded-full border px-2 py-0.5 text-[11px] font-medium shadow-sm focus:outline-none focus:ring-1 transition-colors",
      active ? "border-accent bg-accent/15 text-accent ring-accent" : "border-gray-500 bg-transparent text-fg-muted hover:bg-accent/10 ring-transparent"
    )}
    aria-pressed={active}
  >{label}</button>
);

const Tag: React.FC<{ label: string }> = ({ label }) => (
  <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium text-fg border-line bg-surface">{label}</span>
);

const InfoBubble: React.FC<{ label: string; value?: string | number | React.ReactNode }> = ({ label, value }) => (
  <div className="rounded-xl border border-line bg-surface px-3 py-2">
    <div className="text-[10px] uppercase tracking-wide text-fg-muted leading-tight">{label}</div>
    <div className="text-sm text-fg leading-snug">{value || "—"}</div>
  </div>
);

const EmptyFiltered: React.FC = () => (
  <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-line bg-card px-6 py-16 text-center text-fg-muted">
    <div className="text-4xl">🔍</div>
    <div className="text-sm">No cards match your filters.</div>
  </div>
);

const EmptyDatabase: React.FC<{ onSeeded: () => void }> = ({ onSeeded }) => {
  const [seeding, setSeeding] = useState(false);

  const seed = async () => {
    setSeeding(true);
    const samples: Partial<Card>[] = [
      {
        name: "Mew",
        number: "151",
        set: "Wizards Black Star Promo",
        year: 2000,
        release: "2000-03-15",
        rarity: "Promo",
        era: "Base",
        edition: "Unlim",
        illustrator: "Ken Sugimori",
        image: "https://images.pokemontcg.io/basep/8_hires.png",
        is_mew: true,
        pc: "PSA10",
      },
      {
        name: "Mew ex",
        number: "101",
        set: "Ruby & Sapphire — Ex Dragon",
        year: 2004,
        release: "2004-11-08",
        rarity: "Ultra Rare",
        era: "EX",
        edition: "Unlim",
        image: "https://images.pokemontcg.io/ex5/101_hires.png",
        is_mew: true,
        pc: "RAW",
      },
      {
        name: "Shining Mew",
        number: "9",
        set: "Coro Coro Promo",
        year: 2001,
        release: "2001-08-01",
        rarity: "Promo",
        era: "Neo",
        edition: "1st",
        image: "https://images.pokemontcg.io/neo4/9_hires.png",
        is_mew: true,
      },
    ];
    const { error } = await supabase.from('cards').insert(samples);
    if (error) {
      console.error("Seed failed:", error);
      alert("Failed to seed sample data. Check console.");
    }
    setSeeding(false);
    onSeeded();
  };

  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-line bg-card px-6 py-16 text-center text-fg-muted">
      <div className="text-4xl">📭</div>
      <div className="text-sm">No cards yet. Click the pencil icon (bottom-left) to start editing, or add some samples to get going.</div>
      <button
        onClick={seed}
        disabled={seeding}
        className="rounded-lg border border-accent/40 bg-accent/20 px-4 py-2 text-xs font-semibold text-white hover:bg-accent/30 disabled:opacity-50"
      >
        {seeding ? "Adding…" : "Add sample cards"}
      </button>
    </div>
  );
};

// ------------------------------
// Edit Sheet (modal grid editor)
// ------------------------------
const EditSheet: React.FC<{
  cards: Card[];
  setCards: React.Dispatch<React.SetStateAction<Card[]>>;
  onClose: () => void;
}> = ({ cards, setCards, onClose }) => {
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const flashSaved = () => {
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus(s => s === 'saved' ? 'idle' : s), 1500);
  };

  const updateField = async (id: string, field: keyof Card, value: any) => {
    setCards(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
    setSaveStatus('saving');
    const { error } = await supabase.from('cards').update({ [field]: value }).eq('id', id);
    if (error) { console.error(error); setSaveStatus('error'); }
    else flashSaved();
  };

  const addRow = async () => {
    setAdding(true);
    setSaveStatus('saving');
    const { data, error } = await supabase
      .from('cards')
      .insert({ name: 'New card', is_mew: true })
      .select()
      .single();
    if (data && !error) {
      setCards(prev => [...prev, data]);
      flashSaved();
    } else {
      console.error(error);
      setSaveStatus('error');
    }
    setAdding(false);
  };

  const deleteRow = async (id: string) => {
    if (!confirm('Delete this card? This cannot be undone.')) return;
    setSaveStatus('saving');
    const { error } = await supabase.from('cards').delete().eq('id', id);
    if (error) { console.error(error); setSaveStatus('error'); return; }
    setCards(prev => prev.filter(c => c.id !== id));
    flashSaved();
  };

  const sorted = useMemo(
    () => [...cards].sort((a, b) => releaseTs(a) - releaseTs(b)),
    [cards]
  );

  const statusText =
    saveStatus === 'saving' ? 'Saving…' :
    saveStatus === 'saved' ? 'Saved ✓' :
    saveStatus === 'error' ? 'Error' : '';

  return (
    <div
      className="fixed inset-0 z-[950] flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex h-[95vh] w-[95vw] flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-2xl ring-1 ring-line"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line bg-surface px-4 py-2.5">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 pr-2">
              <span className="h-3 w-3 rounded-full bg-rose-400/80" />
              <span className="h-3 w-3 rounded-full bg-amber-400/80" />
              <span className="h-3 w-3 rounded-full bg-emerald-400/80" />
            </div>
            <h2 className="text-sm font-semibold text-fg">Edit cards</h2>
            <span className="text-[11px] text-gray-500">{cards.length} {cards.length === 1 ? 'card' : 'cards'}</span>
            <span className={classNames(
              "text-[11px] transition-opacity",
              statusText ? "opacity-100" : "opacity-0",
              saveStatus === 'error' ? "text-rose-400" : saveStatus === 'saved' ? "text-emerald-400" : "text-fg-muted"
            )}>{statusText || '—'}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={addRow}
              disabled={adding}
              className="rounded-md border border-accent/40 bg-accent/20 px-3 py-1 text-xs font-semibold text-white hover:bg-accent/30 disabled:opacity-50"
            >
              + Add row
            </button>
            <button
              onClick={onClose}
              className="rounded-md p-1.5 text-fg-muted hover:bg-surface-2 focus:outline-none"
              aria-label="Close editor"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto">
        <table className="min-w-full text-[11px] text-fg">
          <thead className="sticky top-0 z-10 bg-surface">
            <tr className="border-b border-line text-left text-[10px] uppercase tracking-wide text-fg-muted">
              <th className="px-2 py-2 w-12"></th>
              <th className="px-2 py-2 min-w-[160px]">Name</th>
              <th className="px-2 py-2 min-w-[90px]">Number</th>
              <th className="px-2 py-2 min-w-[160px]">Set</th>
              <th className="px-2 py-2 min-w-[70px]">Year</th>
              <th className="px-2 py-2 min-w-[130px]">Release</th>
              <th className="px-2 py-2 min-w-[100px]">Rarity</th>
              <th className="px-2 py-2 min-w-[100px]">Era</th>
              <th className="px-2 py-2 min-w-[90px]">Edition</th>
              <th className="px-2 py-2 min-w-[130px]">Illustrator</th>
              <th className="px-2 py-2 min-w-[220px]">Image URL</th>
              <th className="px-2 py-2 min-w-[220px]">Image back URL</th>
              <th className="px-2 py-2 min-w-[180px]">Notes</th>
              <th className="px-2 py-2 min-w-[140px]">Origin</th>
              <th className="px-2 py-2 min-w-[90px]">Language</th>
              <th className="px-2 py-2 min-w-[90px]">PC</th>
              <th className="px-2 py-2 w-12 text-center">Mew</th>
              <th className="px-2 py-2 w-14 text-center">Cameo</th>
              <th className="px-2 py-2 w-12 text-center">Intl</th>
              <th className="px-2 py-2 w-12"></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((card) => (
              <EditRow
                key={card.id}
                card={card}
                onUpdate={updateField}
                onDelete={deleteRow}
              />
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={20} className="px-4 py-8 text-center text-gray-500">
                  No cards yet. Click "+ Add row" to create one.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      </div>
    </div>
  );
};

const EditRow: React.FC<{
  card: Card;
  onUpdate: (id: string, field: keyof Card, value: any) => void;
  onDelete: (id: string) => void;
}> = ({ card, onUpdate, onDelete }) => {
  const [draft, setDraft] = useState<Card>(card);
  useEffect(() => { setDraft(card); }, [card]);

  const text = (field: keyof Card, minW?: string) => (
    <input
      type="text"
      value={(draft[field] as string | null | undefined) ?? ''}
      onChange={(e) => setDraft(d => ({ ...d, [field]: e.target.value }))}
      onBlur={() => {
        const newVal = (draft[field] as string | null | undefined) ?? '';
        const oldVal = (card[field] as string | null | undefined) ?? '';
        if (newVal !== oldVal) onUpdate(card.id, field, newVal || null);
      }}
      className={classNames(
        "w-full rounded border border-transparent bg-transparent px-1.5 py-1 text-[11px] text-fg hover:border-line focus:border-accent/60 focus:bg-surface outline-none",
        minW
      )}
    />
  );

  const numberInput = (field: keyof Card) => (
    <input
      type="number"
      value={(draft[field] as number | null | undefined) ?? ''}
      onChange={(e) => setDraft(d => ({ ...d, [field]: e.target.value === '' ? null : Number(e.target.value) }))}
      onBlur={() => {
        const newVal = draft[field] as number | null;
        const oldVal = (card[field] as number | null | undefined) ?? null;
        if (newVal !== oldVal) onUpdate(card.id, field, newVal);
      }}
      className="w-full rounded border border-transparent bg-transparent px-1.5 py-1 text-[11px] text-fg hover:border-line focus:border-accent/60 focus:bg-surface outline-none"
    />
  );

  const dateInput = (field: keyof Card) => (
    <input
      type="date"
      value={(draft[field] as string | null | undefined) ?? ''}
      onChange={(e) => setDraft(d => ({ ...d, [field]: e.target.value || null }))}
      onBlur={() => {
        const newVal = draft[field] as string | null;
        const oldVal = (card[field] as string | null | undefined) ?? null;
        if (newVal !== oldVal) onUpdate(card.id, field, newVal);
      }}
      className="w-full rounded border border-transparent bg-transparent px-1.5 py-1 text-[11px] text-fg hover:border-line focus:border-accent/60 focus:bg-surface outline-none [color-scheme:dark]"
    />
  );

  const checkbox = (field: keyof Card) => (
    <input
      type="checkbox"
      checked={!!draft[field]}
      onChange={(e) => {
        setDraft(d => ({ ...d, [field]: e.target.checked }));
        onUpdate(card.id, field, e.target.checked);
      }}
      className="accent-accent"
    />
  );

  const select = (field: keyof Card, options: string[]) => (
    <select
      value={(draft[field] as string | null | undefined) ?? ''}
      onChange={(e) => {
        const v = e.target.value || null;
        setDraft(d => ({ ...d, [field]: v }));
        onUpdate(card.id, field, v);
      }}
      className="w-full rounded border border-transparent bg-surface px-1.5 py-1 text-[11px] text-fg hover:border-line focus:border-accent/60 outline-none"
    >
      <option value="">—</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );

  return (
    <tr className="border-b border-line/60 hover:bg-surface">
      <td className="px-2 py-1">
        <div className="h-10 w-7 overflow-hidden rounded bg-card">
          {draft.image ? (
            <img src={draft.image} alt="" className="h-full w-full object-cover" onError={handleImgError} />
          ) : null}
        </div>
      </td>
      <td className="px-1 py-1">{text('name')}</td>
      <td className="px-1 py-1">{text('number')}</td>
      <td className="px-1 py-1">{text('set')}</td>
      <td className="px-1 py-1">{numberInput('year')}</td>
      <td className="px-1 py-1">{dateInput('release')}</td>
      <td className="px-1 py-1">{text('rarity')}</td>
      <td className="px-1 py-1">{text('era')}</td>
      <td className="px-1 py-1">{select('edition', ['1st', 'Unlim', 'Error'])}</td>
      <td className="px-1 py-1">{text('illustrator')}</td>
      <td className="px-1 py-1">{text('image')}</td>
      <td className="px-1 py-1">{text('image_back')}</td>
      <td className="px-1 py-1">{text('notes')}</td>
      <td className="px-1 py-1">{text('origin')}</td>
      <td className="px-1 py-1">{text('language')}</td>
      <td className="px-1 py-1">{select('pc', ['RAW', 'N/A', 'PSA1', 'PSA2', 'PSA3', 'PSA4', 'PSA5', 'PSA6', 'PSA7', 'PSA8', 'PSA9', 'PSA10'])}</td>
      <td className="px-2 py-1 text-center">{checkbox('is_mew')}</td>
      <td className="px-2 py-1 text-center">{checkbox('is_cameo')}</td>
      <td className="px-2 py-1 text-center">{checkbox('is_intl')}</td>
      <td className="px-2 py-1 text-center">
        <button
          onClick={() => onDelete(card.id)}
          aria-label="Delete card"
          className="rounded p-1 text-gray-500 hover:bg-rose-500/10 hover:text-rose-300 focus:outline-none"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"></path></svg>
        </button>
      </td>
    </tr>
  );
};

// ------------------------------
// Settings Modal
// ------------------------------
const SettingsModal: React.FC<{
  settings: Settings;
  setSettings: React.Dispatch<React.SetStateAction<Settings>>;
  onClose: () => void;
}> = ({ settings, setSettings, onClose }) => {
  const [draft, setDraft] = useState<Settings>(settings);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Preview accent + mode live while editing
  useEffect(() => { applyAccent(draft.accent); }, [draft.accent]);
  useEffect(() => { applyMode(draft.mode); }, [draft.mode]);

  const save = async (patch: Partial<Settings>) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    setSettings(next);
    setSaveStatus('saving');
    const { error } = await supabase
      .from('settings')
      .upsert({
        id: 1,
        title: next.title,
        tagline: next.tagline,
        accent: next.accent,
        mode: next.mode,
        icon_url: next.icon_url,
      })
      .eq('id', 1);
    if (error) { console.error(error); setSaveStatus('error'); }
    else {
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus(s => s === 'saved' ? 'idle' : s), 1200);
    }
  };

  const selectTheme = (theme: typeof THEMES[number]) => {
    const accent = draft.mode === 'light' ? theme.light : theme.dark;
    save({ accent });
  };

  const selectMode = (mode: Mode) => {
    const current = findThemeByAccent(draft.accent) ?? THEMES[0];
    const accent = mode === 'light' ? current.light : current.dark;
    save({ mode, accent });
  };

  const currentTheme = findThemeByAccent(draft.accent);

  const statusText =
    saveStatus === 'saving' ? 'Saving…' :
    saveStatus === 'saved' ? 'Saved ✓' :
    saveStatus === 'error' ? 'Error' : '';

  return (
    <div
      className="fixed inset-0 z-[950] flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={() => { applyAccent(settings.accent); applyMode(settings.mode); onClose(); }}
    >
      <div
        className="flex w-full max-w-md flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-2xl ring-1 ring-line"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line bg-surface px-4 py-2.5">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 pr-2">
              <span className="h-3 w-3 rounded-full bg-rose-400/80" />
              <span className="h-3 w-3 rounded-full bg-amber-400/80" />
              <span className="h-3 w-3 rounded-full bg-emerald-400/80" />
            </div>
            <h2 className="text-sm font-semibold text-fg">Settings</h2>
            <span className={classNames(
              "text-[11px] transition-opacity",
              statusText ? "opacity-100" : "opacity-0",
              saveStatus === 'error' ? "text-rose-400" : saveStatus === 'saved' ? "text-emerald-400" : "text-fg-muted"
            )}>{statusText || '—'}</span>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-fg-muted hover:bg-surface-2 focus:outline-none"
            aria-label="Close settings"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>

        <div className="space-y-5 p-5">
          <div>
            <label className="block text-[10px] uppercase tracking-wide text-fg-muted mb-1.5">Title</label>
            <input
              type="text"
              value={draft.title}
              onChange={(e) => setDraft(d => ({ ...d, title: e.target.value }))}
              onBlur={() => { if (draft.title !== settings.title) save({ title: draft.title }); }}
              className="w-full rounded-lg border border-line bg-card px-3 py-2 text-sm text-fg outline-none focus:border-accent/60"
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-wide text-fg-muted mb-1.5">Tagline</label>
            <input
              type="text"
              value={draft.tagline}
              onChange={(e) => setDraft(d => ({ ...d, tagline: e.target.value }))}
              onBlur={() => { if (draft.tagline !== settings.tagline) save({ tagline: draft.tagline }); }}
              className="w-full rounded-lg border border-line bg-card px-3 py-2 text-sm text-fg outline-none focus:border-accent/60"
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-wide text-fg-muted mb-1.5">Icon URL</label>
            <div className="flex items-center gap-2">
              <img
                src={draft.icon_url || DEFAULT_ICON}
                alt="Icon preview"
                className="h-9 w-9 rounded border border-line bg-card object-contain p-0.5"
                onError={(e) => { (e.currentTarget as HTMLImageElement).src = DEFAULT_ICON; }}
              />
              <input
                type="text"
                placeholder="https://…/logo.png (leave empty for default)"
                value={draft.icon_url ?? ''}
                onChange={(e) => setDraft(d => ({ ...d, icon_url: e.target.value || null }))}
                onBlur={() => { if ((draft.icon_url ?? null) !== (settings.icon_url ?? null)) save({ icon_url: draft.icon_url }); }}
                className="flex-1 rounded-lg border border-line bg-card px-3 py-2 text-sm text-fg outline-none focus:border-accent/60"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-wide text-fg-muted mb-2">Mode</label>
            <div className="grid grid-cols-2 gap-2">
              {(['dark', 'light'] as const).map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => selectMode(m)}
                  className={classNames(
                    "rounded-lg border px-3 py-2 text-xs font-semibold capitalize transition-colors",
                    draft.mode === m
                      ? "border-accent/60 bg-accent/15 text-fg"
                      : "border-line bg-card text-fg-muted hover:border-accent/40"
                  )}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-wide text-fg-muted mb-2">Theme</label>
            <div className="grid grid-cols-3 gap-2">
              {THEMES.map(t => {
                const isActive = currentTheme?.name === t.name;
                const swatch = draft.mode === 'light' ? t.light : t.dark;
                return (
                  <button
                    key={t.name}
                    type="button"
                    onClick={() => selectTheme(t)}
                    className={classNames(
                      "flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs transition-colors",
                      isActive
                        ? "border-accent/60 bg-accent/15 text-fg"
                        : "border-line bg-card text-fg-muted hover:border-accent/40"
                    )}
                  >
                    <span
                      className="h-4 w-4 rounded-full ring-1 ring-line"
                      style={{ background: swatch }}
                    />
                    <span>{t.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ------------------------------
// Loading Screen
// ------------------------------
const LoadingScreen: React.FC<{ progress: number; swirlDelay: number; iconUrl: string }> = ({ progress, swirlDelay, iconUrl }) => {
  const maskStyle: React.CSSProperties = {
    WebkitMaskImage: `url("${iconUrl}")`,
    maskImage: `url("${iconUrl}")`,
  };
  return (
    <div className="fixed inset-0 bg-page flex flex-col items-center justify-center gap-4 p-4">
      <div className="relative h-28 w-28">
        <div
          className="loading-swirl absolute inset-0"
          aria-hidden="true"
          style={{ animationDelay: `${swirlDelay}s`, ...maskStyle }}
        />
        <img
          src={iconUrl}
          alt="Loading..."
          className="h-full w-full absolute top-0 left-0 opacity-25"
        />
        <img
          src={iconUrl}
          alt="Loading..."
          className="h-full w-full absolute top-0 left-0 transition-all duration-300 ease-linear"
          style={{ clipPath: `inset(${100 - progress}% 0 0 0)` }}
        />
      </div>
      <div className="h-16" />
      <div className="pointer-events-none absolute bottom-4 left-4 text-[10px] font-semibold text-accent/80">v{APP_VERSION}</div>
      <style>{`
        @keyframes swirl {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .loading-swirl {
          background: radial-gradient(circle at 30% 30%, rgb(var(--accent-rgb) / 0.6), rgb(var(--accent-rgb) / 0.35) 45%, rgb(var(--page-rgb) / 0) 70%);
          background-size: 200% 200%;
          opacity: 0.8;
          filter: blur(6px);
          animation: swirl 5s linear infinite;
          mask-size: contain;
          mask-repeat: no-repeat;
          mask-position: center;
          -webkit-mask-size: contain;
          -webkit-mask-repeat: no-repeat;
          -webkit-mask-position: center;
        }
      `}</style>
    </div>
  );
};

// ------------------------------
// Detail Modal
// ------------------------------
const FlipIcon = () => (
  <div className="absolute bottom-2 right-2 z-20 rounded-full bg-black/50 p-2 text-white/80 backdrop-blur-sm">
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="17 1 21 5 17 9"></polyline><path d="M3 11V9a4 4 0 0 1 4-4h14"></path><polyline points="7 23 3 19 7 15"></polyline><path d="M21 13v2a4 4 0 0 1-4 4H3"></path></svg>
  </div>
);

const DetailModal: React.FC<{ card: Card; onClose: () => void }> = ({ card, onClose }) => {
  const [isFlipped, setIsFlipped] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => { setIsFlipped(false); }, [card.id]);

  return (
    <div className="fixed inset-0 z-[999] flex items-end justify-center bg-black/80 backdrop-blur-sm sm:items-center sm:p-6" onClick={onClose}>
      <div className="relative h-[100dvh] w-full max-w-3xl overflow-y-auto sm:h-auto sm:max-h-[90vh] sm:overflow-hidden rounded-none sm:rounded-3xl border border-line bg-surface shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-3 right-3 z-10 rounded-full p-2 text-fg-muted hover:bg-surface-2 focus:outline-none focus:ring-2 focus:ring-accent" aria-label="Close">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
        <div className="grid grid-cols-1 sm:grid-cols-2">
          <div className="flex flex-col items-center p-4 sm:p-6">
            <div
              className={classNames("relative w-full max-w-[520px] [perspective:2500px]", card.image_back && "cursor-pointer")}
              onClick={() => { if (card.image_back) setIsFlipped(f => !f); }}
            >
              <div
                className="relative w-full aspect-[63/88] transition-transform duration-700 [transform-style:preserve-3d]"
                style={{ transform: `rotateY(${isFlipped ? 180 : 0}deg)` }}
              >
                <div className="absolute top-0 left-0 w-full h-full [backface-visibility:hidden] overflow-hidden bg-card" style={{ borderRadius: "5.2% / 3.9%" }}>
                  <img src={card.image || IMG_FALLBACK} alt={`${card.name} front`} className="h-full w-full object-fill" style={{ aspectRatio: "63/88" }} onError={handleImgError} referrerPolicy="strict-origin-when-cross-origin" />
                </div>
                {card.image_back && (
                  <div className="absolute top-0 left-0 w-full h-full [backface-visibility:hidden] [transform:rotateY(180deg)] overflow-hidden bg-card" style={{ borderRadius: "5.2% / 3.9%" }}>
                    <img src={card.image_back} alt={`${card.name} back`} className="h-full w-full object-fill" style={{ aspectRatio: "63/88" }} onError={handleImgError} referrerPolicy="strict-origin-when-cross-origin" />
                  </div>
                )}
              </div>
              {card.image_back && !isFlipped && <FlipIcon />}
            </div>
          </div>
          <div className="flex flex-col space-y-3 p-4 pt-2 sm:p-6 sm:max-h-[80vh] sm:overflow-y-auto">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-4xl font-semibold text-fg leading-tight">{card.name}</h2>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                  {card.number && card.number !== "N/A" && (<p className="text-base font-semibold text-accent">{card.number}</p>)}
                  {card.rarity && <Tag label={card.rarity} />}
                  {card.edition && (<span className="rounded bg-accent/15 px-2.5 py-0.5 text-[11px] font-semibold text-accent">{card.edition}</span>)}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {card.set?.includes("Promo") && (<span className="rounded bg-accent/15 px-2 py-0.5 text-[11px] font-semibold text-accent">Promo</span>)}
              {card.is_intl && (<span className="rounded bg-accent/15 px-2 py-0.5 text-[11px] font-semibold text-accent">Intl</span>)}
              {card.is_cameo && (<span className="rounded bg-accent/15 px-2 py-0.5 text-[11px] font-semibold text-accent">Cameo</span>)}
            </div>

            <div className="grid grid-cols-1 gap-2">
              <div className="grid grid-cols-2 gap-2">
                <InfoBubble label="Release Date" value={formatDate(card.release) || (card.year ? String(card.year) : undefined)} />
                <InfoBubble label="Era" value={card.era} />
              </div>
              <InfoBubble label="Illustrator" value={card.illustrator} />
              {card.origin && <InfoBubble label="Origin" value={card.origin} />}
              {card.set && <InfoBubble label="Set" value={card.set} />}
            </div>

            {card.notes && <InfoBubble label="Notes" value={card.notes} />}

            <div className="mt-2 flex items-center gap-2 sm:hidden">
              <button
                onClick={onClose}
                className="flex-1 rounded-lg border border-accent/40 bg-accent/20 py-2 text-xs font-semibold text-white"
              >
                Back to list
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
