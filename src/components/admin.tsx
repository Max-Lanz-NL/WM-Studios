"use client";
import BrandLogo, { brandName, brandText } from "./brand-logo";
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
  draft: "Draft",
  review: "Awaiting review",
  approved: "Approved",
  scheduled: "Scheduled",
  published: "Published",
  archived: "Archived",
  paid_demo: "Paid (demo)",
  packed: "Packed",
  shipped: "Shipped (demo)",
  pending_payment: "Awaiting payment",
  paid: "Paid",
  cancelled: "Cancelled",
  expired: "Expired",
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
    [tab, setTab] = useState("Overview"),
    [query, setQuery] = useState(""),
    [status, setStatus] = useState("all"),
    [editor, setEditor] = useState<(ProductInput & { id?: string }) | null>(
      null,
    ),
    [selectedOrder, setSelectedOrder] = useState<Order | null>(null),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [mobile, setMobile] = useState(false),
    [home, setHome] = useState({
      headline: brandText(content.headline),
      subtitle: brandText(content.subtitle),
    });
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
          <p>The workspace for everything you create, launch and sell.</p>
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
              Email address
              <input
                name="email"
                type="email"
                required
                autoComplete="username"
              />
            </label>
            <label>
              Password
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
    { name: "Overview", icon: LayoutDashboard },
    { name: "Products", icon: Package },
    { name: "Releases", icon: CalendarDays },
    { name: "Orders", icon: ShoppingBag },
    { name: "Stock", icon: Boxes },
    { name: "Website", icon: FileText },
    { name: "Settings", icon: Settings },
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
      ["Order", "Date", "Status", "Total EUR"],
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
              n.name === "Orders"
                ? staff?.permissions.includes("orders.read")
                : ["Products", "Releases", "Stock"].includes(n.name)
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
                {n.name === "Orders" && pending.length > 0 && (
                  <small>{pending.length}</small>
                )}
              </button>
            ))}
        </nav>
        <div className="sidebar-bottom">
          <Link href="/" target="_blank">
            View store <ArrowUpRight size={16} />
          </Link>
          <span className="demo-pill">DEMO ENVIRONMENT</span>
          <div className="profile">
            <b>MW</b>
            <div>
              <strong>{staff?.email}</strong>
              <span>{staff?.role} · test / staging</span>
            </div>
            <button
              aria-label="Sign out"
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
              aria-label="Navigation"
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
            <i /> Test environment — all products, orders and amounts are
            fictional.
          </span>
          <button onClick={() => go("Settings")}>
            View configuration <ArrowUpRight size={13} />
          </button>
        </div>
        <main className="admin-main">
          <div className="admin-heading">
            <div>
              <p className="eyebrow">YOUR COLLECTIVE, AT A GLANCE</p>
              <h1>{tab === "Overview" ? "A new day in the studio." : tab}</h1>
              <p>
                {tab === "Overview"
                  ? "From the first idea to the final order. Everything comes together here."
                  : tab === "Products"
                    ? "Design, manage and publish your next essentials."
                    : tab === "Releases"
                      ? "Give the next chapter its moment."
                      : "Everything in one place. Ready for the next step."}
              </p>
            </div>
            {staff?.permissions.includes("catalog.write") &&
              ["Overview", "Products", "Releases"].includes(tab) && (
                <button
                  className="button dark"
                  onClick={() => setEditor(structuredClone(fresh))}
                >
                  <Plus size={16} /> New product
                </button>
              )}
          </div>
          {message && (
            <p className="notice" role="status">
              {message}
            </p>
          )}
          {tab === "Overview" && (
            <>
              <div className="stat-grid">
                {[
                  {
                    label: "DEMO REVENUE",
                    value: euro(total),
                    foot: "Saved demo orders",
                    icon: ArrowUpRight,
                  },
                  {
                    label: "ORDERS",
                    value: orders.length,
                    foot: `${pending.length} ready to process`,
                    icon: ShoppingBag,
                  },
                  {
                    label: "ACTIVE PRODUCTS",
                    value: products.filter((p) => p.status === "published")
                      .length,
                    foot: `${products.length} products in your studio`,
                    icon: Package,
                  },
                  {
                    label: "UPCOMING RELEASES",
                    value: releases.length,
                    foot: `${waitlist} waitlist sign-ups`,
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
                      <h2>Sales overview</h2>
                      <p>Demo revenue per day · last 7 days</p>
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
                            new Date(o.createdAt).toLocaleDateString("en-GB", {
                              timeZone: "Europe/Amsterdam",
                            }) ===
                            day.toLocaleDateString("en-GB", {
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
                            {day.toLocaleDateString("en-GB", {
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
                      Your first chapter starts with your first order.
                    </p>
                  )}
                </section>
                <section className="admin-card attention">
                  <p className="eyebrow">NEXT UP</p>
                  <h2>In the studio.</h2>
                  <button onClick={() => go("Orders")}>
                    <ShoppingBag size={19} />
                    <span>
                      Process orders<small>Ready to pack</small>
                    </span>
                    <b>{pending.length}</b>
                    <ArrowUpRight size={15} />
                  </button>
                  <button onClick={() => go("Products")}>
                    <Check size={19} />
                    <span>
                      Review products<small>Awaiting approval</small>
                    </span>
                    <b>
                      {products.filter((p) => p.status === "review").length}
                    </b>
                    <ArrowUpRight size={15} />
                  </button>
                  <button onClick={() => go("Stock")}>
                    <Boxes size={19} />
                    <span>
                      Low stock<small>Fewer than 5 available</small>
                    </span>
                    <b>{low.length}</b>
                    <ArrowUpRight size={15} />
                  </button>
                  <div className="studio-note">
                    GOOD THINGS START HERE.
                    <p>A new idea? Give it room.</p>
                    <button onClick={() => setEditor(structuredClone(fresh))}>
                      Create a draft product <Plus size={14} />
                    </button>
                  </div>
                </section>
              </div>
              <div className="admin-card">
                <div className="card-heading">
                  <div>
                    <h2>The next release</h2>
                    <p>A new perspective, ready for the world.</p>
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
                      <span className="badge">Scheduled</span>
                      <button
                        onClick={() => setEditor(p)}
                        className="text-link"
                      >
                        View release <ArrowUpRight size={15} />
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="empty">No releases scheduled yet.</p>
                )}
              </div>
            </>
          )}
          {tab === "Products" && (
            <section className="admin-card">
              <div className="table-toolbar">
                <label className="search-input">
                  <Search size={16} />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search products…"
                  />
                </label>
                <select
                  aria-label="Product status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="all">All statuses</option>
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
                      <th>Clothing line</th>
                      <th>Status</th>
                      <th>Stock</th>
                      <th>Price</th>
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
                                {p.variants.length} variants · {p.category}
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
                Sales are always checked against the release date on the server.
                Supabase Cron publishes releases and clears expired
                reservations. Automated emails are not connected yet.
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
                  <h2>Development pipeline</h2>
                </div>
                {["draft", "review", "approved"].map((s) => (
                  <div className="pipeline-row" key={s}>
                    <span>{statusLabels[s]}</span>
                    <b>{products.filter((p) => p.status === s).length}</b>
                    <button
                      onClick={() => {
                        go("Products");
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
          {tab === "Orders" && (
            <section className="admin-card">
              <div className="card-heading">
                <div>
                  <h2>All orders</h2>
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
                  <h3>Your first order will appear here.</h3>
                  <p>Place a demo order in the store to test the workflow.</p>
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
                        <th>Customer</th>
                        <th>Date</th>
                        <th>Status</th>
                        <th>Total</th>
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
          {tab === "Stock" && (
            <section className="admin-card">
              <div className="card-heading">
                <div>
                  <h2>Stock by variant</h2>
                  <p>
                    Make changes in the product editor. Changes are recorded
                    centrally; this view shows stock available after
                    reservations.
                  </p>
                </div>
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Product / SKU</th>
                      <th>Colour</th>
                      <th>Size</th>
                      <th>Available</th>
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
                    setMessage("Homepage saved.");
                }}
              >
                <label>
                  Headline
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
                  Introduction
                  <textarea
                    value={home.subtitle}
                    maxLength={500}
                    onChange={(e) =>
                      setHome({ ...home, subtitle: e.target.value })
                    }
                  />
                </label>
                <button className="button dark" disabled={busy}>
                  Save changes <Check size={16} />
                </button>
              </form>
              <p className="muted">
                This first content editor manages the homepage headline and
                introduction. Sections, media and version history will follow
                later.
              </p>
            </section>
          )}
          {tab === "Settings" && (
            <section className="admin-card">
              <div className="card-heading">
                <div>
                  <h2>Integration overview</h2>
                  <p>
                    A clear view of what works and what still needs to be
                    connected.
                  </p>
                </div>
              </div>
              {[
                {
                  name: "Supabase PostgreSQL",
                  text: "Central products, variants, stock, customers, orders, releases and change history with row-level security.",
                  active: true,
                },
                {
                  name: "Admin security",
                  text: "Individual Supabase Auth sessions, HTTP-only cookies, and server and database permissions.",
                  active: true,
                },
                {
                  name: "Staff & roles",
                  text: "Owner, administrator, designer, warehouse and support. Access is checked on every request.",
                  active: true,
                },
                {
                  name: "Mollie",
                  text: "Not connected · Demo checkout only; no real payments.",
                },
                {
                  name: "Sendcloud & printers",
                  text: "Not connected · No shipping labels, tracking or printer communication.",
                },
                {
                  name: "Supabase Cron & e-mail",
                  text: "Database scheduling is installed through migrations. Check the staging Cron status; email is not connected yet.",
                },
                {
                  name: "Live hosting",
                  text: "Only local or staging configuration is allowed. Live sales are disabled.",
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
            aria-label="Product editor"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="drawer-header">
              <div>
                <p className="eyebrow">PRODUCT STUDIO</p>
                <h2>{editor.id ? "Edit product" : "A new chapter."}</h2>
              </div>
              <button aria-label="Close" onClick={() => setEditor(null)}>
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
                  setMessage("Product saved.");
                }
              }}
            >
              <label>
                Product name
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
                  Clothing line
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
                  Category
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
                Audience
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
                Description
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
                  Selling price (€ incl. VAT)
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
                  Publication status
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
                Enter a UTC timestamp ending in Z. The store displays it in
                Europe/Amsterdam, including daylight saving time. A local date
                picker will follow later.
              </p>
              <label>
                Image (images.unsplash.com URL)
                <input
                  type="url"
                  required
                  value={editor.image}
                  onChange={(e) =>
                    setEditor({ ...editor, image: e.target.value })
                  }
                />
              </label>
              <h3>Variants & stock</h3>
              <div className="variant-labels">
                <span>Size</span>
                <span>Colour</span>
                <span>SKU</span>
                <span>Stock</span>
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
                    aria-label="Remove variant"
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
                <Plus size={14} /> Add variant
              </button>
              {message && (
                <p role="alert" className="notice">
                  {message}
                </p>
              )}
              <div className="editor-save">
                <button className="button dark full" disabled={busy}>
                  {busy ? "Saving…" : "Save product"} <Check size={17} />
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
            aria-label="Order details"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="drawer-header">
              <h2>{selectedOrder.number}</h2>
              <button aria-label="Close" onClick={() => setSelectedOrder(null)}>
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
            <h3>Pick list</h3>
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
                <span>Shipping</span>
                <b>{euro(selectedOrder.shipping)}</b>
              </p>
              <p>
                <span>Total incl. VAT</span>
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
                  ? "Mark as packed"
                  : "Mark as shipped (demo)"}{" "}
                <ArrowRight size={16} />
              </button>
            )}
            <p className="muted">
              Ticking items is a local packing aid. Shipping labels and tracking
              are not connected yet.
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
