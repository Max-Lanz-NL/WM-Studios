"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  ArrowRight,
  Search,
  ShoppingBag,
  X,
  Plus,
  Minus,
  Menu,
  Heart,
  Check,
  ChevronDown,
} from "lucide-react";
import { Product, euro, saleable, date } from "@/lib/model";
import { useModal } from "./use-modal";
type Line = { productId: string; sku: string; quantity: number };
export default function Storefront({
  products,
  content,
  shopOnly = false,
  selectedId,
}: {
  products: Product[];
  content: { headline: string; subtitle: string };
  shopOnly?: boolean;
  selectedId?: string;
}) {
  const [cart, setCart] = useState<Line[]>([]),
    [ready, setReady] = useState(false),
    [panel, setPanel] = useState<"bag" | "search" | "menu" | null>(null),
    [selected, setSelected] = useState<Product | null>(
      products.find((p) => p.id === selectedId) || null,
    ),
    [size, setSize] = useState(""),
    [color, setColor] = useState(""),
    [query, setQuery] = useState(""),
    [brand, setBrand] = useState("All"),
    [category, setCategory] = useState("All"),
    [gender, setGender] = useState("All"),
    [wish, setWish] = useState<string[]>([]),
    [wishOnly, setWishOnly] = useState(false),
    [checkout, setCheckout] = useState(false),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [confirmation, setConfirmation] = useState<{
      number: string;
      total: number;
    } | null>(null),
    [key, setKey] = useState(""),
    [now, setNow] = useState(0);
  useModal(Boolean(panel || selected), () => {
    setPanel(null);
    setSelected(null);
  });
  useEffect(() => {
    try {
      const raw = JSON.parse(localStorage.getItem("wm-bag") || "[]");
      if (Array.isArray(raw))
        setCart(
          raw.filter(
            (l) =>
              typeof l.productId === "string" &&
              typeof l.sku === "string" &&
              Number.isInteger(l.quantity) &&
              l.quantity > 0 &&
              l.quantity <= 20,
          ),
        );
      const w = JSON.parse(localStorage.getItem("wm-wish") || "[]");
      if (Array.isArray(w)) setWish(w.filter((v) => typeof v === "string"));
    } catch {}
    setKey(crypto.randomUUID());
    setReady(true);
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (ready) {
      localStorage.setItem("wm-bag", JSON.stringify(cart));
      localStorage.setItem("wm-wish", JSON.stringify(wish));
    }
  }, [cart, wish, ready]);
  const lines = cart.flatMap((l) => {
    const p = products.find((p) => p.id === l.productId),
      v = p?.variants.find((v) => v.sku === l.sku);
    return p && v ? [{ ...l, p, v }] : [];
  });
  const subtotal = lines.reduce((n, l) => n + l.p.price * l.quantity, 0),
    shipping = subtotal >= 15000 ? 0 : 495;
  const list = products.filter(
    (p) =>
      (brand === "All" || p.brand === brand) &&
      (category === "All" || p.category === category) &&
      (gender === "All" || p.gender === gender || p.gender === "Unisex") &&
      p.name.toLowerCase().includes(query.toLowerCase()) &&
      (!wishOnly || wish.includes(p.id)),
  );
  const selectedColor = color || selected?.variants[0]?.color || "";
  function open(p: Product) {
    setSelected(p);
    setSize("");
    setColor(p.variants[0]?.color || "");
    setMessage("");
  }
  function add() {
    if (!selected) return;
    const v = selected.variants.find((v) => v.sku === size);
    if (!v) {
      setMessage("Selecteer eerst je maat.");
      return;
    }
    const existing = cart.find((l) => l.sku === size);
    if ((existing?.quantity || 0) >= Math.min(20, v.stock)) {
      setMessage("Deze maat heeft onvoldoende voorraad.");
      return;
    }
    setCart((prev) =>
      existing
        ? prev.map((l) =>
            l.sku === size ? { ...l, quantity: l.quantity + 1 } : l,
          )
        : [...prev, { productId: selected.id, sku: size, quantity: 1 }],
    );
    setKey(crypto.randomUUID());
    setSelected(null);
    setPanel("bag");
    setCheckout(false);
  }
  function update(sku: string, change: number) {
    const variant = products
      .flatMap((p) => p.variants)
      .find((v) => v.sku === sku);
    if (!variant) return;
    setCart((prev) =>
      prev
        .map((l) =>
          l.sku === sku
            ? {
                ...l,
                quantity: Math.min(20, variant.stock, l.quantity + change),
              }
            : l,
        )
        .filter((l) => l.quantity > 0),
    );
    setKey(crypto.randomUUID());
  }
  function filterGender(g: string) {
    setGender(g);
    setPanel(null);
    document
      .getElementById("collection")
      ?.scrollIntoView({ behavior: "smooth" });
  }
  async function place(form: FormData) {
    setBusy(true);
    setMessage("");
    try {
      const res = await fetch("/api/store", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "checkout",
          key,
          email: form.get("email"),
          name: form.get("name"),
          address: [
            form.get("address"),
            form.get("postal"),
            form.get("city"),
            form.get("country"),
          ].join(", "),
          items: cart,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setConfirmation(data);
      setCart([]);
      setKey(crypto.randomUUID());
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function wait(form: FormData) {
    if (!selected) return;
    setBusy(true);
    try {
      const r = await fetch("/api/store", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "waitlist",
          productId: selected.id,
          email: form.get("email"),
          consent: form.get("consent") === "on",
        }),
      });
      const d = await r.json();
      setMessage(
        r.ok
          ? "Je staat op de demo-wachtlijst. E-mailverzending is nog niet aangesloten."
          : d.error,
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <a className="skip" href="#main">
        Naar inhoud
      </a>
      <div className="announcement">
        <span>Independent by design. Collective by nature.</span>
        <span>
          Gratis verzending vanaf €150 <ArrowUpRight size={12} />
        </span>
      </div>
      <header className="store-header" data-ready={ready}>
        <Link
          href="/"
          className="wordmark"
          aria-label="WM Studio Collective home"
        >
          <b className="monogram">WM</b>
          <span>
            STUDIO
            <br />
            COLLECTIVE
          </span>
        </Link>
        <nav aria-label="Hoofdnavigatie">
          <Link href="/shop">Shop all</Link>
          <button onClick={() => filterGender("Men")}>Men</button>
          <button onClick={() => filterGender("Women")}>Women</button>
          <a href="/#brands">
            The collective <ChevronDown size={12} />
          </a>
          <a href="/#story">Our story</a>
        </nav>
        <div className="header-tools">
          <button aria-label="Zoeken" onClick={() => setPanel("search")}>
            <Search size={19} />
          </button>
          <button
            aria-label="Wishlist"
            onClick={() => {
              setWishOnly(!wishOnly);
              document
                .getElementById("collection")
                ?.scrollIntoView({ behavior: "smooth" });
            }}
          >
            <Heart size={19} fill={wishOnly ? "currentColor" : "none"} />
          </button>
          <button
            className="bag-button"
            aria-label="Winkelmand"
            onClick={() => {
              setPanel("bag");
              setCheckout(false);
              setConfirmation(null);
              setMessage("");
            }}
          >
            <ShoppingBag size={18} />
            <span>Bag ({cart.reduce((n, l) => n + l.quantity, 0)})</span>
          </button>
          <button
            className="mobile-menu"
            aria-label="Menu"
            onClick={() => setPanel("menu")}
          >
            <Menu size={22} />
          </button>
        </div>
      </header>
      <main id="main">
        {!shopOnly && (
          <>
            <section className="hero">
              <img
                className="hero-image"
                src="https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=2400&q=90"
                alt="Mode-editorial met een ontspannen stedelijke sfeer"
              />
              <div className="hero-shade" />
              <div className="hero-top">
                <span>WM STUDIO COLLECTIVE</span>
                <span>THE FIRST EDITION — VOL. 01</span>
              </div>
              <div className="hero-copy">
                <p className="eyebrow">A NEW PERSPECTIVE ON EVERYDAY WEAR</p>
                <h1>{content.headline}</h1>
                <p>{content.subtitle}</p>
                <a className="button light" href="#collection">
                  Discover the collection <ArrowUpRight size={18} />
                </a>
              </div>
              <div className="hero-bottom">
                <span>DESIGNED WITH INTENTION. WORN YOUR WAY.</span>
                <span>THE FIRST EDITION</span>
              </div>
              <span className="hero-index">01 / THE COLLECTIVE</span>
            </section>
            <section className="manifesto">
              <p className="eyebrow">DIFFERENT EXPRESSIONS. ONE COLLECTIVE.</p>
              <h2>
                For the way you move.
                <br />
                <span>For who you are becoming.</span>
              </h2>
              <p>
                Een garderobe die met je meebeweegt. Onafhankelijke
                kledinglijnen, verbonden door één visie: bewuste ontwerpen met
                een eigen karakter.
              </p>
              <a href="#story">
                Meet the collective <ArrowUpRight size={16} />
              </a>
            </section>
          </>
        )}
        <section className="collection section" id="collection">
          <div className="section-heading">
            <div>
              <p className="eyebrow">THE EDIT — VOL. 01</p>
              {shopOnly && <h1 className="collection-title">The collection</h1>}
              <h2 className={shopOnly && !wishOnly ? "sr-only" : undefined}>
                {wishOnly
                  ? "Your favourites"
                  : shopOnly
                    ? "The collection"
                    : "Everyday, redefined."}
              </h2>
            </div>
            <Link href="/shop" className="text-link">
              Explore all pieces <ArrowUpRight size={16} />
            </Link>
          </div>
          <div className="filters">
            <div className="tabs">
              {["All", "T-shirts", "Knitwear", "Outerwear", "Trousers"].map(
                (c) => (
                  <button
                    key={c}
                    className={category === c ? "active" : ""}
                    onClick={() => setCategory(c)}
                  >
                    {c === "All" ? "All pieces" : c}
                  </button>
                ),
              )}
            </div>
            <label className="brand-select">
              Brand{" "}
              <select
                aria-label="Filter kledinglijn"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
              >
                {["All", "WM STUDIO", "FORM", "OFF HOURS"].map((b) => (
                  <option key={b}>{b}</option>
                ))}
              </select>
            </label>
          </div>
          {(query ||
            gender !== "All" ||
            wishOnly ||
            category !== "All" ||
            brand !== "All") && (
            <div className="filter-summary">
              {query && `Zoeken: ${query} · `}
              {gender !== "All" && `${gender} · `}
              {category !== "All" && `${category} · `}
              {brand !== "All" && `${brand} · `}
              {list.length} items{" "}
              <button
                onClick={() => {
                  setQuery("");
                  setGender("All");
                  setCategory("All");
                  setBrand("All");
                  setWishOnly(false);
                }}
              >
                Wis filters ×
              </button>
            </div>
          )}
          <div className="product-grid">
            {list.map((p, i) => (
              <article className="product-card" key={p.id}>
                <div className={"product-image tone-" + (i % 4)}>
                  <Link href={"/products/" + p.slug}>
                    <img src={p.image} alt={p.name} loading="lazy" />
                  </Link>
                  <span className="product-badge">
                    {!saleable(p, now || Date.now()) ? "COMING SOON" : ""}
                  </span>
                  <button
                    className="wish"
                    aria-label={`Bewaar ${p.name}`}
                    onClick={() =>
                      setWish(
                        wish.includes(p.id)
                          ? wish.filter((id) => id !== p.id)
                          : [...wish, p.id],
                      )
                    }
                  >
                    <Heart
                      size={17}
                      fill={wish.includes(p.id) ? "currentColor" : "none"}
                    />
                  </button>
                  <button className="quick-add" onClick={() => open(p)}>
                    Discover piece <Plus size={16} />
                  </button>
                </div>
                <div className="product-meta">
                  <div>
                    <p>{p.brand}</p>
                    <h3>
                      <Link href={"/products/" + p.slug}>{p.name}</Link>
                    </h3>
                    <span>
                      {p.variants[0]?.color} · {p.gender}
                    </span>
                  </div>
                  <b>{euro(p.price)}</b>
                </div>
                <div className="swatches">
                  <span>
                    {new Set(p.variants.map((v) => v.color)).size} kleur(en) ·{" "}
                    {new Set(p.variants.map((v) => v.size)).size} maten
                  </span>
                </div>
              </article>
            ))}
          </div>
          {!list.length && (
            <p className="empty">Geen items gevonden. Pas je filters aan.</p>
          )}
        </section>
        {!shopOnly && (
          <>
            <section className="brand-section section" id="brands">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">ONE VISION. MULTIPLE PERSPECTIVES.</p>
                  <h2>Meet the collective.</h2>
                </div>
                <p className="muted">
                  Jouw stijl kent geen grenzen.
                  <br />
                  Onze collecties ook niet.
                </p>
              </div>
              <div className="brand-grid">
                {[
                  {
                    name: "WM STUDIO",
                    text: "The everyday foundation.",
                    img: "photo-1483985988355-763728e1935b",
                  },
                  {
                    name: "FORM",
                    text: "A different kind of structure.",
                    img: "photo-1485230895905-ec40ba36b9bc",
                  },
                  {
                    name: "OFF HOURS",
                    text: "For everything in between.",
                    img: "photo-1515886657613-9f3515b0c78f",
                  },
                ].map((b) => (
                  <button
                    key={b.name}
                    className="brand-card"
                    onClick={() => {
                      setBrand(b.name);
                      document
                        .getElementById("collection")
                        ?.scrollIntoView({ behavior: "smooth" });
                    }}
                  >
                    <img
                      loading="lazy"
                      src={`https://images.unsplash.com/${b.img}?auto=format&fit=crop&w=900&q=85`}
                      alt={`Editorial voor ${b.name}`}
                    />
                    <div>
                      <h3>{b.name}</h3>
                      <p>{b.text}</p>
                    </div>
                    <ArrowUpRight size={24} />
                  </button>
                ))}
              </div>
            </section>
            <section className="drop-section section">
              <div>
                <p className="eyebrow">ON THE HORIZON</p>
                <h2>
                  Good things
                  <br />
                  take their time.
                </h2>
                <p>
                  Een nieuwe expressie. Een volgend hoofdstuk.
                  <br />
                  Ontdek wat er aankomt bij het collective.
                </p>
                {products
                  .filter((p) => !saleable(p, now || Date.now()))
                  .map((p) => (
                    <button
                      className="button dark"
                      key={p.id}
                      onClick={() => open(p)}
                    >
                      Discover {p.name} <ArrowUpRight size={17} />
                    </button>
                  ))}
              </div>
              <div className="drop-type">
                OFF
                <br />
                <span>HOURS</span>
                <small>THE NEXT CHAPTER / COMING SOON</small>
              </div>
            </section>
            <section className="story section" id="story">
              <p className="eyebrow">INDEPENDENT BY DESIGN</p>
              <h2>
                Two founders.
                <br />
                One shared perspective.
              </h2>
              <div>
                <p>
                  WM Studio Collective begon met Willemijn en Max. Met ideeën
                  aan de ontwerptafel en de ambitie om iets eigens op te bouwen.
                </p>
                <p>
                  Verschillende kledinglijnen, één herkenbare visie. Dit is het
                  begin van ons verhaal. En er is ruimte voor dat van jou.
                </p>
                <span>WILLEMIJN & MAX — THE FOUNDERS</span>
              </div>
            </section>
          </>
        )}
      </main>
      <footer>
        <div className="footer-top">
          <Link href="/" className="footer-wordmark">
            WM STUDIO
            <br />
            COLLECTIVE
            <span>
              Independent by design.
              <br />
              Collective by nature.
            </span>
          </Link>
          <div>
            <p>EXPLORE</p>
            <Link href="/shop">Shop all</Link>
            <a href="/#brands">The collective</a>
            <a href="/#story">Our story</a>
            <Link href="/admin">
              Studio dashboard <ArrowUpRight size={12} />
            </Link>
          </div>
          <div>
            <p>CLIENT SERVICES</p>
            <Link href="/info/shipping">Verzending & retouren</Link>
            <Link href="/info/contact">Contact</Link>
            <Link href="/info/privacy">Privacy & cookies</Link>
            <Link href="/info/terms">Voorwaarden (concept)</Link>
          </div>
          <div>
            <p>THE FIRST CHAPTER</p>
            <span>
              Ontwikkelomgeving met fictieve producten.
              <br />
              Er worden geen echte betalingen verwerkt.
            </span>
            <span className="demo-pill">DEMO ENVIRONMENT</span>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} WM Studio Collective</span>
          <span>NETHERLANDS · EUR € · NL</span>
          <span>WORK IN PROGRESS. ALWAYS MOVING.</span>
        </div>
      </footer>
      {panel && (
        <div className="overlay" onClick={() => setPanel(null)}>
          <section
            className="drawer"
            role="dialog"
            aria-modal="true"
            aria-label={
              panel === "bag"
                ? "Winkelmand"
                : panel === "menu"
                  ? "Menu"
                  : "Zoeken"
            }
            onClick={(e) => e.stopPropagation()}
          >
            <div className="drawer-header">
              <h2>
                {panel === "bag"
                  ? "Your bag"
                  : panel === "search"
                    ? "Find your next essential."
                    : "Explore"}
              </h2>
              <button aria-label="Sluiten" onClick={() => setPanel(null)}>
                <X />
              </button>
            </div>
            {panel === "search" ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setPanel(null);
                  document
                    .getElementById("collection")
                    ?.scrollIntoView({ behavior: "smooth" });
                }}
              >
                <label>
                  Zoek op productnaam
                  <input
                    autoFocus
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="The Essential Tee…"
                  />
                </label>
                <button className="button dark">
                  Search <ArrowRight size={16} />
                </button>
              </form>
            ) : panel === "menu" ? (
              <div className="mobile-links">
                <Link href="/shop" onClick={() => setPanel(null)}>
                  Shop all
                </Link>
                <button onClick={() => setPanel("search")}>Zoeken</button>
                <button
                  onClick={() => {
                    setWishOnly(true);
                    setPanel(null);
                    document
                      .getElementById("collection")
                      ?.scrollIntoView({ behavior: "smooth" });
                  }}
                >
                  Favorieten
                </button>
                <button onClick={() => filterGender("Men")}>Men</button>
                <button onClick={() => filterGender("Women")}>Women</button>
                <a href="/#brands" onClick={() => setPanel(null)}>
                  The collective
                </a>
                <Link href="/admin">Studio dashboard</Link>
              </div>
            ) : confirmation ? (
              <div className="confirmation">
                <Check size={40} />
                <h3>Bedankt. Je demo-order staat klaar.</h3>
                <p>{confirmation.number}</p>
                <b>{euro(confirmation.total)}</b>
                <p>
                  Er is geen geld afgeschreven. De order is opgeslagen in het
                  dashboard.
                </p>
                <button
                  className="button dark"
                  onClick={() => {
                    setPanel(null);
                    setConfirmation(null);
                  }}
                >
                  Verder ontdekken
                </button>
              </div>
            ) : (
              <>
                <p className="muted">
                  {subtotal >= 15000
                    ? "Gratis verzending voor jouw bestelling."
                    : `Nog ${euro(15000 - subtotal)} tot gratis verzending.`}
                </p>
                <div className="shipping-progress">
                  <i style={{ width: Math.min(100, subtotal / 150) + "%" }} />
                </div>
                {lines.map((l) => (
                  <div className="bag-line" key={l.sku}>
                    <img src={l.p.image} alt={l.p.name} />
                    <div>
                      <h3>{l.p.name}</h3>
                      <p>
                        {l.v.color} / {l.v.size}
                      </p>
                      <b>{euro(l.p.price)}</b>
                      <div className="quantity">
                        <button
                          aria-label="Minder"
                          onClick={() => update(l.sku, -1)}
                        >
                          <Minus size={12} />
                        </button>
                        <span>{l.quantity}</span>
                        <button
                          aria-label="Meer"
                          disabled={l.quantity >= Math.min(20, l.v.stock)}
                          onClick={() => update(l.sku, 1)}
                        >
                          <Plus size={12} />
                        </button>
                        <button
                          onClick={() => {
                            setCart(cart.filter((c) => c.sku !== l.sku));
                            setKey(crypto.randomUUID());
                          }}
                        >
                          Verwijderen
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                {!lines.length ? (
                  <p className="empty">Je tas wacht op iets bijzonders.</p>
                ) : (
                  <>
                    <div className="totals">
                      <p>
                        <span>Subtotaal (incl. btw)</span>
                        <b>{euro(subtotal)}</b>
                      </p>
                      <p>
                        <span>Verzending</span>
                        <b>{euro(shipping)}</b>
                      </p>
                      <p>
                        <span>Totaal</span>
                        <b>{euro(subtotal + shipping)}</b>
                      </p>
                    </div>
                    {checkout ? (
                      <form action={place} className="checkout-form">
                        <span className="demo-pill">
                          DEMO CHECKOUT — GEEN BETALING
                        </span>
                        <label>
                          Naam
                          <input
                            name="name"
                            required
                            minLength={2}
                            maxLength={100}
                            autoComplete="name"
                          />
                        </label>
                        <label>
                          E-mail
                          <input
                            name="email"
                            type="email"
                            required
                            autoComplete="email"
                          />
                        </label>
                        <label>
                          Straat en huisnummer
                          <input
                            name="address"
                            required
                            autoComplete="street-address"
                          />
                        </label>
                        <div className="form-row">
                          <label>
                            Postcode
                            <input
                              name="postal"
                              required
                              autoComplete="postal-code"
                            />
                          </label>
                          <label>
                            Plaats
                            <input
                              name="city"
                              required
                              autoComplete="address-level2"
                            />
                          </label>
                        </div>
                        <label>
                          Land
                          <select name="country">
                            <option>Nederland</option>
                            <option>België</option>
                          </select>
                        </label>
                        <p className="muted">
                          Gebruik fictieve gegevens. Deze bestelling is
                          uitsluitend een test.
                        </p>
                        <button className="button dark" disabled={busy}>
                          {busy ? "Opslaan…" : "Demo-order plaatsen"}{" "}
                          <ArrowRight size={16} />
                        </button>
                      </form>
                    ) : (
                      <button
                        className="button dark full"
                        onClick={() => {
                          setCheckout(true);
                          setMessage("");
                        }}
                      >
                        Naar demo-checkout <ArrowRight size={16} />
                      </button>
                    )}
                  </>
                )}
                {message && (
                  <p role="status" className="notice">
                    {message}
                  </p>
                )}
              </>
            )}
          </section>
        </div>
      )}
      {selected && (
        <div
          className="overlay product-overlay"
          onClick={() => setSelected(null)}
        >
          <section
            className="product-dialog"
            role="dialog"
            aria-modal="true"
            aria-label={selected.name}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="dialog-close"
              aria-label="Sluiten"
              onClick={() => setSelected(null)}
            >
              <X />
            </button>
            <div className="detail-image">
              <img src={selected.image} alt={selected.name} />
            </div>
            <div className="detail-copy">
              <p className="eyebrow">{selected.brand} / THE FIRST EDITION</p>
              <h2>{selected.name}</h2>
              <p className="detail-price">
                {euro(selected.price)} <small>incl. btw</small>
              </p>
              <p>{selected.description}</p>
              {saleable(selected, now || Date.now()) ? (
                <>
                  <p className="eyebrow">SELECT YOUR SIZE — {selectedColor}</p>
                  {new Set(selected.variants.map((v) => v.color)).size > 1 && (
                    <label>
                      Kleur
                      <select
                        aria-label="Kleur"
                        value={selectedColor}
                        onChange={(e) => {
                          setColor(e.target.value);
                          setSize("");
                          setMessage("");
                        }}
                      >
                        {Array.from(
                          new Set(selected.variants.map((v) => v.color)),
                        ).map((c) => (
                          <option key={c}>{c}</option>
                        ))}
                      </select>
                    </label>
                  )}
                  <div className="sizes">
                    {selected.variants
                      .filter((v) => v.color === selectedColor)
                      .map((v) => (
                        <button
                          key={v.sku}
                          disabled={!v.stock}
                          className={size === v.sku ? "active" : ""}
                          onClick={() => setSize(v.sku)}
                        >
                          {v.size}
                          {!v.stock && " ×"}
                        </button>
                      ))}
                  </div>
                  <button className="button dark full" onClick={add}>
                    Add to bag <Plus size={18} />
                  </button>
                  <p className="muted">
                    Gratis verzending vanaf €150 · Fictief demo-artikel
                  </p>
                </>
              ) : (
                <div className="waitlist">
                  <p className="eyebrow">COMING SOON</p>
                  <p>
                    {selected.releaseAt && date(selected.releaseAt)} ·
                    Europe/Amsterdam
                  </p>
                  <h3>
                    {selected.releaseAt && now
                      ? `${Math.max(0, Math.floor((Date.parse(selected.releaseAt) - now) / 86400000))}D ${Math.max(0, Math.floor((Date.parse(selected.releaseAt) - now) / 3600000) % 24)}H ${Math.max(0, Math.floor((Date.parse(selected.releaseAt) - now) / 60000) % 60)}M`
                      : "Binnenkort"}
                  </h3>
                  <form action={wait}>
                    <label>
                      E-mailadres
                      <input
                        name="email"
                        type="email"
                        required
                        placeholder="you@example.com"
                      />
                    </label>
                    <label className="check-label">
                      <input name="consent" type="checkbox" required /> Bewaar
                      mijn e-mailadres voor deze demo-wachtlijst.
                    </label>
                    <button className="button dark full" disabled={busy}>
                      Join the waitlist <ArrowUpRight size={17} />
                    </button>
                  </form>
                </div>
              )}
              {message && (
                <p className="notice" role="status">
                  {message}
                </p>
              )}
              <details>
                <summary>Details & verzorging</summary>
                <p>
                  Productdetails en wasvoorschriften worden vóór livegang
                  aangevuld. Materiaal- en duurzaamheidsclaims zijn nog niet
                  geverifieerd.
                </p>
              </details>
              <details>
                <summary>Verzending & retouren</summary>
                <p>
                  Dit is een ontwikkelomgeving. Er worden geen fysieke producten
                  geleverd. Het definitieve retourbeleid volgt vóór livegang.
                </p>
              </details>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
