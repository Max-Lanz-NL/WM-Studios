"use client";
import BrandLogo, { brandName } from "./brand-logo";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard,
  Package,
  CalendarDays,
  ShoppingBag,
  Boxes,
  Settings,
  ArrowUpRight,
  Plus,
  Search,
  ArrowRight,
  LogOut,
  X,
  Check,
  PanelLeft,
  FileText,
} from "lucide-react";
import { Product, ProductInput, Order, euro, date } from "@/lib/model";
import { useModal } from "./use-modal";
import type { Staff } from "@/lib/auth";
const statusLabels: Record<string, string> = {
  draft: "Concept",
  review: "Wacht op controle",
  approved: "Goedgekeurd",
  scheduled: "Ingepland",
  published: "Gepubliceerd",
  archived: "Gearchiveerd",
  paid_demo: "Betaald (demo)",
  packed: "Ingepakt",
  shipped: "Verzonden (demo)",
  pending_payment: "Wacht op betaling",
  paid: "Betaald",
  cancelled: "Geannuleerd",
  expired: "Verlopen",
};
const fresh: ProductInput = {
  name: "",
  slug: "",
  brand: "WM STUDIO",
  category: "T-shirts",
  gender: "Unisex",
  description: "",
  price: 6500,
  status: "draft",
  releaseAt: null,
  image:
    "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=1200&q=85",
  variants: [
    { size: "S", color: "Black", sku: "", stock: 0 },
    { size: "M", color: "Black", sku: "", stock: 0 },
    { size: "L", color: "Black", sku: "", stock: 0 },
  ],
};
export default function Admin({
  authorized,
  products,
  orders,
  content,
  waitlist,
  staff,
}: {
  authorized: boolean;
  products: Product[];
  orders: Order[];
  content: { headline: string; subtitle: string };
  waitlist: number;
  staff: Staff | null;
}) {
  const router = useRouter(),
    [tab, setTab] = useState("Overzicht"),
    [query, setQuery] = useState(""),
    [status, setStatus] = useState("all"),
    [editor, setEditor] = useState<(ProductInput & { id?: string }) | null>(
      null,
    ),
    [selectedOrder, setSelectedOrder] = useState<Order | null>(null),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [mobile, setMobile] = useState(false),
    [home, setHome] = useState(content);
  useModal(Boolean(editor || selectedOrder), () => {
    setEditor(null);
    setSelectedOrder(null);
  });
  async function send(body: unknown) {
    setBusy(true);
    setMessage("");
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      router.refresh();
      return true;
    } catch (e) {
      setMessage((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  if (!authorized)
    return (
      <main className="login-page">
        <div>
          <Link href="/" className="wordmark">
            <BrandLogo />
          </Link>
          <p className="eyebrow">THE STUDIO / PRIVATE ACCESS</p>
          <h1>
            Welcome
            <br />
            to your studio.
          </h1>
          <p>De werkruimte voor alles wat je maakt, lanceert en verkoopt.</p>
          <form
            action={async (f) => {
              await send({
                action: "login",
                email: f.get("email"),
                password: f.get("password"),
              });
            }}
          >
            <label>
              E-mailadres
              <input
                name="email"
                type="email"
                required
                autoComplete="username"
              />
            </label>
            <label>
              Wachtwoord
              <input
                name="password"
                type="password"
                required
                autoComplete="current-password"
                minLength={8}
              />
            </label>
            <button className="button dark full" disabled={busy}>
              Open the studio <ArrowRight size={17} />
            </button>
          </form>
          {message && (
            <p role="alert" className="notice">
              {message}
            </p>
          )}
          <span className="demo-pill">SUPABASE AUTH · TEST / STAGING</span>
        </div>
        <aside>
          <span>
            INDEPENDENT
            <br />
            BY DESIGN.
          </span>
          <small>STUDIO MW — VOL. 01</small>
        </aside>
      </main>
    );
  const total = orders.reduce((n, o) => n + o.total, 0),
    low = products.flatMap((p) =>
      p.variants
        .filter((v) => v.stock < 5)
        .map((v) => ({ ...v, name: p.name })),
    ),
    releases = products.filter((p) => p.status === "scheduled"),
    pending = orders.filter(
      (o) => o.status === "paid_demo" || o.status === "paid",
    );
  const nav = [
    { name: "Overzicht", icon: LayoutDashboard },
    { name: "Producten", icon: Package },
    { name: "Releases", icon: CalendarDays },
    { name: "Bestellingen", icon: ShoppingBag },
    { name: "Voorraad", icon: Boxes },
    { name: "Website", icon: FileText },
    { name: "Instellingen", icon: Settings },
  ];
  function go(name: string) {
    setTab(name);
    setMobile(false);
    setMessage("");
  }
  const ps = products.filter(
    (p) =>
      p.name.toLowerCase().includes(query.toLowerCase()) &&
      (status === "all" || p.status === status),
  );
  function exportOrders() {
    const rows = [
      ["Order", "Datum", "Status", "Totaal EUR"],
      ...orders.map((o) => [
        o.number,
        o.createdAt,
        o.status,
        (o.total / 100).toFixed(2),
      ]),
    ];
    const csv = rows
      .map((r) => r.map((v) => '"' + v.replaceAll('"', '""') + '"').join(","))
      .join("\r\n");
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "wm-demo-orders.csv";
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <div className="admin-shell">
      <aside className={"sidebar " + (mobile ? "sidebar-open" : "")}>
        <Link href="/" className="wordmark">
          <BrandLogo />
        </Link>
        <p className="sidebar-caption">YOUR WORKSPACE</p>
        <nav>
          {nav
            .filter((n) =>
              n.name === "Bestellingen"
                ? staff?.permissions.includes("orders.read")
                : ["Producten", "Releases", "Voorraad"].includes(n.name)
                  ? staff?.permissions.includes("catalog.write")
                  : n.name === "Website"
                    ? staff?.permissions.includes("content.write")
                    : true,
            )
            .map((n) => (
              <button
                className={tab === n.name ? "selected" : ""}
                key={n.name}
                onClick={() => go(n.name)}
              >
                <n.icon size={18} />
                {n.name}
                {n.name === "Bestellingen" && pending.length > 0 && (
                  <small>{pending.length}</small>
                )}
              </button>
            ))}
        </nav>
        <div className="sidebar-bottom">
          <Link href="/" target="_blank">
            Bekijk webshop <ArrowUpRight size={16} />
          </Link>
          <span className="demo-pill">DEMO ENVIRONMENT</span>
          <div className="profile">
            <b>MW</b>
            <div>
              <strong>{staff?.email}</strong>
              <span>{staff?.role} · test / staging</span>
            </div>
            <button
              aria-label="Uitloggen"
              onClick={() => send({ action: "logout" })}
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>
      <div className="admin-body">
        <header className="admin-topbar">
          <div>
            <button
              className="mobile-menu"
              aria-label="Navigatie"
              onClick={() => setMobile(!mobile)}
            >
              <PanelLeft size={19} />
            </button>
            <span>Workspace</span>
            <span>/</span>
            <strong>{tab}</strong>
          </div>
          <span className="admin-date">
            STUDIO MW <i /> STUDIO NO. 01
          </span>
        </header>
        <div className="demo-banner">
          <span>
            <i /> Ontwikkelomgeving — alle producten, orders en bedragen zijn
            fictief.
          </span>
          <button onClick={() => go("Instellingen")}>
            Bekijk configuratie <ArrowUpRight size={13} />
          </button>
        </div>
        <main className="admin-main">
          <div className="admin-heading">
            <div>
              <p className="eyebrow">YOUR COLLECTIVE, AT A GLANCE</p>
              <h1>{tab === "Overzicht" ? "A new day in the studio." : tab}</h1>
              <p>
                {tab === "Overzicht"
                  ? "Van het eerste idee tot de laatste bestelling. Hier komt alles samen."
                  : tab === "Producten"
                    ? "Ontwerp, beheer en publiceer de volgende essentials."
                    : tab === "Releases"
                      ? "Geef het volgende hoofdstuk een moment."
                      : "Alles op één plek. Klaar voor de volgende stap."}
              </p>
            </div>
            {staff?.permissions.includes("catalog.write") &&
              ["Overzicht", "Producten", "Releases"].includes(tab) && (
                <button
                  className="button dark"
                  onClick={() => setEditor(structuredClone(fresh))}
                >
                  <Plus size={16} /> Nieuw product
                </button>
              )}
          </div>
          {message && (
            <p className="notice" role="status">
              {message}
            </p>
          )}
          {tab === "Overzicht" && (
            <>
              <div className="stat-grid">
                {[
                  {
                    label: "DEMO-OMZET",
                    value: euro(total),
                    foot: "Opgeslagen demo-bestellingen",
                    icon: ArrowUpRight,
                  },
                  {
                    label: "BESTELLINGEN",
                    value: orders.length,
                    foot: `${pending.length} klaar voor verwerking`,
                    icon: ShoppingBag,
                  },
                  {
                    label: "ACTIEVE PRODUCTEN",
                    value: products.filter((p) => p.status === "published")
                      .length,
                    foot: `${products.length} producten in je studio`,
                    icon: Package,
                  },
                  {
                    label: "AANKOMENDE RELEASES",
                    value: releases.length,
                    foot: `${waitlist} wachtlijstinschrijvingen`,
                    icon: CalendarDays,
                  },
                ].map((s) => (
                  <div className="stat-card" key={s.label}>
                    <p>
                      {s.label}
                      <s.icon size={17} />
                    </p>
                    <h2>{s.value}</h2>
                    <span>{s.foot}</span>
                  </div>
                ))}
              </div>
              <div className="dashboard-grid">
                <section className="admin-card sales-card">
                  <div className="card-heading">
                    <div>
                      <h2>Verkoopoverzicht</h2>
                      <p>Demo-omzet per dag · afgelopen 7 dagen</p>
                    </div>
                    <span className="badge">EUR</span>
                  </div>
                  <div className="chart">
                    {Array.from({ length: 7 }, (_, i) => {
                      const day = new Date();
                      day.setDate(day.getDate() - 6 + i);
                      const amount = orders
                        .filter(
                          (o) =>
                            new Date(o.createdAt).toLocaleDateString("nl-NL", {
                              timeZone: "Europe/Amsterdam",
                            }) ===
                            day.toLocaleDateString("nl-NL", {
                              timeZone: "Europe/Amsterdam",
                            }),
                        )
                        .reduce((n, o) => n + o.total, 0);
                      return (
                        <div key={i}>
                          <span>{amount ? euro(amount) : "—"}</span>
                          <i
                            style={{
                              height: amount
                                ? Math.max(
                                    5,
                                    (amount / Math.max(total, 1)) * 140,
                                  )
                                : 2,
                            }}
                          />
                          <small>
                            {day.toLocaleDateString("nl-NL", {
                              weekday: "short",
                              timeZone: "Europe/Amsterdam",
                            })}
                          </small>
                        </div>
                      );
                    })}
                  </div>
                  {!orders.length && (
                    <p className="chart-empty">
                      Je eerste hoofdstuk begint met je eerste order.
                    </p>
                  )}
                </section>
                <section className="admin-card attention">
                  <p className="eyebrow">NEXT UP</p>
                  <h2>In de studio.</h2>
                  <button onClick={() => go("Bestellingen")}>
                    <ShoppingBag size={19} />
                    <span>
                      Orders verwerken<small>Klaar om in te pakken</small>
                    </span>
                    <b>{pending.length}</b>
                    <ArrowUpRight size={15} />
                  </button>
                  <button onClick={() => go("Producten")}>
                    <Check size={19} />
                    <span>
                      Producten controleren<small>Wachten op goedkeuring</small>
                    </span>
                    <b>
                      {products.filter((p) => p.status === "review").length}
                    </b>
                    <ArrowUpRight size={15} />
                  </button>
                  <button onClick={() => go("Voorraad")}>
                    <Boxes size={19} />
                    <span>
                      Lage voorraad<small>Minder dan 5 beschikbaar</small>
                    </span>
                    <b>{low.length}</b>
                    <ArrowUpRight size={15} />
                  </button>
                  <div className="studio-note">
                    GOOD THINGS START HERE.
                    <p>Een nieuw idee? Geef het ruimte.</p>
                    <button onClick={() => setEditor(structuredClone(fresh))}>
                      Maak een productconcept <Plus size={14} />
                    </button>
                  </div>
                </section>
              </div>
              <div className="admin-card">
                <div className="card-heading">
                  <div>
                    <h2>De volgende release</h2>
                    <p>Een nieuw perspectief, klaar voor de wereld.</p>
                  </div>
                  <button className="text-link" onClick={() => go("Releases")}>
                    Release Center <ArrowUpRight size={15} />
                  </button>
                </div>
                {releases.length ? (
                  releases.slice(0, 2).map((p) => (
                    <div className="release-row" key={p.id}>
                      <img src={p.image} alt={p.name} />
                      <div>
                        <p className="eyebrow">{brandName(p.brand)}</p>
                        <h3>{p.name}</h3>
                        <span>
                          {p.releaseAt && date(p.releaseAt)} · Amsterdam
                        </span>
                      </div>
                      <span className="badge">Ingepland</span>
                      <button
                        onClick={() => setEditor(p)}
                        className="text-link"
                      >
                        Bekijk release <ArrowUpRight size={15} />
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="empty">Nog geen releases ingepland.</p>
                )}
              </div>
            </>
          )}
          {tab === "Producten" && (
            <section className="admin-card">
              <div className="table-toolbar">
                <label className="search-input">
                  <Search size={16} />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Zoek een product…"
                  />
                </label>
                <select
                  aria-label="Productstatus"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="all">Alle statussen</option>
                  {Object.keys(statusLabels)
                    .slice(0, 6)
                    .map((s) => (
                      <option key={s} value={s}>
                        {statusLabels[s]}
                      </option>
                    ))}
                </select>
                <span>{ps.length} producten</span>
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Kledinglijn</th>
                      <th>Status</th>
                      <th>Voorraad</th>
                      <th>Prijs</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {ps.map((p) => (
                      <tr key={p.id}>
                        <td>
                          <div className="table-product">
                            <img src={p.image} alt="" />
                            <div>
                              <strong>{p.name}</strong>
                              <small>
                                {p.variants.length} varianten · {p.category}
                              </small>
                            </div>
                          </div>
                        </td>
                        <td>{brandName(p.brand)}</td>
                        <td>
                          <span className={"badge " + p.status}>
                            {statusLabels[p.status]}
                          </span>
                        </td>
                        <td>{p.variants.reduce((n, v) => n + v.stock, 0)}</td>
                        <td>{euro(p.price)}</td>
                        <td>
                          <button
                            className="text-link"
                            onClick={() => setEditor(structuredClone(p))}
                          >
                            Bewerken <ArrowUpRight size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
          {tab === "Releases" && (
            <>
              <div className="release-notice">
                Verkoop wordt altijd server-side tegen de releasedatum
                gecontroleerd. Supabase Cron publiceert releases en ruimt
                verlopen reserveringen op. Automatische e-mails zijn nog niet
                aangesloten.
              </div>
              <div className="release-cards">
                {releases.map((p) => (
                  <article className="admin-card release-card" key={p.id}>
                    <img src={p.image} alt={p.name} />
                    <p className="eyebrow">{brandName(p.brand)}</p>
                    <h2>{p.name}</h2>
                    <p>{p.releaseAt && date(p.releaseAt)}</p>
                    <span className="badge">Europe/Amsterdam</span>
                    <button
                      className="button dark full"
                      onClick={() => setEditor(structuredClone(p))}
                    >
                      Release bewerken <ArrowUpRight size={16} />
                    </button>
                  </article>
                ))}
              </div>
              <section className="admin-card">
                <div className="card-heading">
                  <h2>Ontwikkelpijplijn</h2>
                </div>
                {["draft", "review", "approved"].map((s) => (
                  <div className="pipeline-row" key={s}>
                    <span>{statusLabels[s]}</span>
                    <b>{products.filter((p) => p.status === s).length}</b>
                    <button
                      onClick={() => {
                        go("Producten");
                        setStatus(s);
                      }}
                      className="text-link"
                    >
                      Bekijken ↗
                    </button>
                  </div>
                ))}
              </section>
            </>
          )}
          {tab === "Bestellingen" && (
            <section className="admin-card">
              <div className="card-heading">
                <div>
                  <h2>Alle bestellingen</h2>
                  <p>
                    {orders.length} demo-orders · prijzen als historische
                    snapshots
                  </p>
                </div>
                <button className="text-link" onClick={exportOrders}>
                  Exporteer CSV ↗
                </button>
              </div>
              {!orders.length ? (
                <div className="empty">
                  <ShoppingBag size={30} />
                  <h3>Je eerste order komt hier.</h3>
                  <p>
                    Plaats een demo-order in de webshop om de workflow te
                    testen.
                  </p>
                  <Link className="button dark" href="/">
                    Open webshop ↗
                  </Link>
                </div>
              ) : (
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Order</th>
                        <th>Klant</th>
                        <th>Datum</th>
                        <th>Status</th>
                        <th>Totaal</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {orders.map((o) => (
                        <tr key={o.id}>
                          <td>
                            <strong>{o.number}</strong>
                          </td>
                          <td>
                            {o.name}
                            <small>{o.email}</small>
                          </td>
                          <td>{date(o.createdAt)}</td>
                          <td>
                            <span className="badge">
                              {statusLabels[o.status]}
                            </span>
                          </td>
                          <td>{euro(o.total)}</td>
                          <td>
                            <button onClick={() => setSelectedOrder(o)}>
                              Open ↗
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}
          {tab === "Voorraad" && (
            <section className="admin-card">
              <div className="card-heading">
                <div>
                  <h2>Voorraad per variant</h2>
                  <p>
                    Aanpassingen via de producteditor. Mutaties worden centraal
                    bijgehouden; dit scherm toont de beschikbare voorraad na
                    reserveringen.
                  </p>
                </div>
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Product / SKU</th>
                      <th>Kleur</th>
                      <th>Maat</th>
                      <th>Beschikbaar</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {products.flatMap((p) =>
                      p.variants.map((v) => (
                        <tr key={v.sku}>
                          <td>
                            {p.name}
                            <small>{v.sku}</small>
                          </td>
                          <td>{v.color}</td>
                          <td>{v.size}</td>
                          <td>
                            <span
                              className={"badge " + (v.stock < 5 ? "low" : "")}
                            >
                              {v.stock}
                            </span>
                          </td>
                          <td>
                            <button
                              onClick={() => setEditor(structuredClone(p))}
                            >
                              Aanpassen ↗
                            </button>
                          </td>
                        </tr>
                      )),
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}
          {tab === "Website" && (
            <section className="admin-card cms-card">
              <p className="eyebrow">HOMEPAGE / HERO</p>
              <h2>Make it yours.</h2>
              <form
                action={async () => {
                  if (await send({ action: "home", content: home }))
                    setMessage("Homepage opgeslagen.");
                }}
              >
                <label>
                  Hoofdtitel
                  <textarea
                    value={home.headline}
                    maxLength={150}
                    required
                    onChange={(e) =>
                      setHome({ ...home, headline: e.target.value })
                    }
                  />
                </label>
                <label>
                  Introductie
                  <textarea
                    value={home.subtitle}
                    maxLength={500}
                    onChange={(e) =>
                      setHome({ ...home, subtitle: e.target.value })
                    }
                  />
                </label>
                <button className="button dark" disabled={busy}>
                  Wijzigingen opslaan <Check size={16} />
                </button>
              </form>
              <p className="muted">
                Deze eerste CMS-versie beheert de hero-tekst. Secties, media en
                versiebeheer volgen later.
              </p>
            </section>
          )}
          {tab === "Instellingen" && (
            <section className="admin-card">
              <div className="card-heading">
                <div>
                  <h2>Integratieoverzicht</h2>
                  <p>
                    Een eerlijke blik op wat werkt en wat nog aangesloten moet
                    worden.
                  </p>
                </div>
              </div>
              {[
                {
                  name: "Supabase PostgreSQL",
                  text: "Centrale producten, varianten, voorraad, klanten, orders, releases en mutatiehistorie met RLS.",
                  active: true,
                },
                {
                  name: "Beheerbeveiliging",
                  text: "Persoonlijke Supabase Auth-sessies, HTTP-only cookies en server- en databaserechten.",
                  active: true,
                },
                {
                  name: "Medewerkers & rollen",
                  text: "Owner, admin, designer, warehouse en support. Toegang wordt bij elk verzoek gecontroleerd.",
                  active: true,
                },
                {
                  name: "Mollie",
                  text: "Nog niet aangesloten · Alleen expliciete demo-checkout; geen geldverkeer.",
                },
                {
                  name: "Sendcloud & printers",
                  text: "Nog niet aangesloten · Geen labels, tracking of printercommunicatie.",
                },
                {
                  name: "Supabase Cron & e-mail",
                  text: "Databaseplanning via migratie. Controleer de Cron-status in staging; e-mail is nog niet aangesloten.",
                },
                {
                  name: "Productiehosting",
                  text: "Alleen local/staging-configuratie toegestaan. Productie staat expliciet uit.",
                },
              ].map((x) => (
                <div className="integration" key={x.name}>
                  <span
                    className={"integration-dot " + (x.active ? "on" : "")}
                  />
                  <div>
                    <h3>{x.name}</h3>
                    <p>{x.text}</p>
                  </div>
                  <span className="badge">
                    {x.active ? "Actief" : "Openstaand"}
                  </span>
                </div>
              ))}
            </section>
          )}
          <div className="admin-foot">
            <span>STUDIO MW · THE WORKSPACE</span>
            <span>Made for what comes next.</span>
          </div>
        </main>
      </div>
      {editor && (
        <div className="overlay" onClick={() => setEditor(null)}>
          <section
            className="editor drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Producteditor"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="drawer-header">
              <div>
                <p className="eyebrow">PRODUCT STUDIO</p>
                <h2>{editor.id ? "Bewerk product" : "Een nieuw hoofdstuk."}</h2>
              </div>
              <button aria-label="Sluiten" onClick={() => setEditor(null)}>
                <X />
              </button>
            </div>
            <form
              action={async () => {
                if (
                  await send({
                    action: "product",
                    id: editor.id,
                    product: editor,
                  })
                ) {
                  setEditor(null);
                  setMessage("Product opgeslagen.");
                }
              }}
            >
              <label>
                Productnaam
                <input
                  value={editor.name}
                  minLength={2}
                  maxLength={120}
                  required
                  onChange={(e) =>
                    setEditor({
                      ...editor,
                      name: e.target.value,
                      slug: editor.id
                        ? editor.slug
                        : e.target.value
                            .toLowerCase()
                            .normalize("NFD")
                            .replace(/[\u0300-\u036f]/g, "")
                            .replace(/[^a-z0-9]+/g, "-")
                            .replace(/^-|-$/g, ""),
                    })
                  }
                />
              </label>
              <label>
                URL-slug
                <input
                  required
                  pattern="[a-z0-9]+(-[a-z0-9]+)*"
                  value={editor.slug}
                  onChange={(e) =>
                    setEditor({ ...editor, slug: e.target.value })
                  }
                />
              </label>
              <div className="form-row">
                <label>
                  Kledinglijn
                  <select
                    value={editor.brand}
                    onChange={(e) =>
                      setEditor({
                        ...editor,
                        brand: e.target.value as ProductInput["brand"],
                      })
                    }
                  >
                    {["WM STUDIO", "FORM", "OFF HOURS"].map((x) => (
                      <option key={x} value={x}>
                        {brandName(x)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Categorie
                  <select
                    value={editor.category}
                    onChange={(e) =>
                      setEditor({
                        ...editor,
                        category: e.target.value as ProductInput["category"],
                      })
                    }
                  >
                    {["T-shirts", "Knitwear", "Outerwear", "Trousers"].map(
                      (x) => (
                        <option key={x}>{x}</option>
                      ),
                    )}
                  </select>
                </label>
              </div>
              <label>
                Doelgroep
                <select
                  value={editor.gender}
                  onChange={(e) =>
                    setEditor({
                      ...editor,
                      gender: e.target.value as ProductInput["gender"],
                    })
                  }
                >
                  {["Unisex", "Men", "Women"].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </label>
              <label>
                Beschrijving
                <textarea
                  value={editor.description}
                  maxLength={5000}
                  rows={4}
                  onChange={(e) =>
                    setEditor({ ...editor, description: e.target.value })
                  }
                />
              </label>
              <div className="form-row">
                <label>
                  Verkoopprijs (€ incl. btw)
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    value={editor.price / 100}
                    onChange={(e) =>
                      setEditor({
                        ...editor,
                        price: Math.round(Number(e.target.value) * 100),
                      })
                    }
                  />
                </label>
                <label>
                  Publicatiestatus
                  <select
                    value={editor.status}
                    onChange={(e) =>
                      setEditor({
                        ...editor,
                        status: e.target.value as ProductInput["status"],
                      })
                    }
                  >
                    {Object.keys(statusLabels)
                      .slice(0, 6)
                      .map((s) => (
                        <option key={s} value={s}>
                          {statusLabels[s]}
                        </option>
                      ))}
                  </select>
                </label>
              </div>
              <label>
                Release (UTC, ISO 8601)
                <input
                  value={editor.releaseAt || ""}
                  placeholder="2026-12-01T17:00:00.000Z"
                  onChange={(e) =>
                    setEditor({ ...editor, releaseAt: e.target.value || null })
                  }
                />
              </label>
              <p className="muted">
                Voer een UTC-tijd met Z in. De webshop toont deze in
                Europe/Amsterdam, met zomer- en wintertijd. Een lokale
                datumkiezer volgt.
              </p>
              <label>
                Afbeelding (images.unsplash.com URL)
                <input
                  type="url"
                  required
                  value={editor.image}
                  onChange={(e) =>
                    setEditor({ ...editor, image: e.target.value })
                  }
                />
              </label>
              <h3>Varianten & voorraad</h3>
              <div className="variant-labels">
                <span>Maat</span>
                <span>Kleur</span>
                <span>SKU</span>
                <span>Voorraad</span>
                <span />
              </div>
              {editor.variants.map((v, i) => (
                <div className="variant-row" key={i}>
                  {(["size", "color", "sku", "stock"] as const).map((k) => (
                    <input
                      key={k}
                      aria-label={`${k} variant ${i + 1}`}
                      type={k === "stock" ? "number" : "text"}
                      min={k === "stock" ? 0 : undefined}
                      required
                      value={v[k]}
                      onChange={(e) =>
                        setEditor({
                          ...editor,
                          variants: editor.variants.map((x, j) =>
                            j === i
                              ? {
                                  ...x,
                                  [k]:
                                    k === "stock"
                                      ? Number(e.target.value)
                                      : e.target.value,
                                }
                              : x,
                          ),
                        })
                      }
                    />
                  ))}
                  <button
                    type="button"
                    aria-label="Variant verwijderen"
                    disabled={editor.variants.length === 1}
                    onClick={() =>
                      setEditor({
                        ...editor,
                        variants: editor.variants.filter((_, j) => j !== i),
                      })
                    }
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="text-link"
                onClick={() =>
                  setEditor({
                    ...editor,
                    variants: [
                      ...editor.variants,
                      { size: "", color: "", sku: "", stock: 0 },
                    ],
                  })
                }
              >
                <Plus size={14} /> Variant toevoegen
              </button>
              {message && (
                <p role="alert" className="notice">
                  {message}
                </p>
              )}
              <div className="editor-save">
                <button className="button dark full" disabled={busy}>
                  {busy ? "Opslaan…" : "Product opslaan"} <Check size={17} />
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
      {selectedOrder && (
        <div className="overlay" onClick={() => setSelectedOrder(null)}>
          <section
            className="drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Orderdetails"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="drawer-header">
              <h2>{selectedOrder.number}</h2>
              <button
                aria-label="Sluiten"
                onClick={() => setSelectedOrder(null)}
              >
                <X />
              </button>
            </div>
            <span className="demo-pill">
              DEMO-ORDER · GEEN BETALING ONTVANGEN
            </span>
            <h3>{selectedOrder.name}</h3>
            <p>
              {selectedOrder.email}
              <br />
              {selectedOrder.address}
            </p>
            <p>{date(selectedOrder.createdAt)}</p>
            <h3>Picklijst</h3>
            {selectedOrder.items.map((i) => (
              <label className="pick-line" key={i.sku}>
                <input type="checkbox" />
                <span>
                  {i.quantity} × {i.name}
                  <small>
                    {i.color} / {i.size} / {i.sku}
                  </small>
                </span>
                <b>{euro(i.price * i.quantity)}</b>
              </label>
            ))}
            <div className="totals">
              <p>
                <span>Verzending</span>
                <b>{euro(selectedOrder.shipping)}</b>
              </p>
              <p>
                <span>Totaal incl. btw</span>
                <b>{euro(selectedOrder.total)}</b>
              </p>
            </div>
            <span className="badge">{statusLabels[selectedOrder.status]}</span>
            {["paid_demo", "paid", "packed"].includes(selectedOrder.status) && (
              <button
                className="button dark full"
                disabled={busy}
                onClick={async () => {
                  const next =
                    selectedOrder.status === "packed" ? "shipped" : "packed";
                  if (
                    await send({
                      action: "order",
                      id: selectedOrder.id,
                      status: next,
                    })
                  )
                    setSelectedOrder({ ...selectedOrder, status: next });
                }}
              >
                {selectedOrder.status !== "packed"
                  ? "Markeer als ingepakt"
                  : "Markeer als verzonden (demo)"}{" "}
                <ArrowRight size={16} />
              </button>
            )}
            <p className="muted">
              Afvinken is een lokale pickhulp. Verzendlabels en tracking zijn
              nog niet aangesloten.
            </p>
            {message && (
              <p role="status" className="notice">
                {message}
              </p>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
