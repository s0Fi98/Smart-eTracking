"use client";
import { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  resources,
  groups,
  tabs,
  display,
  label,
} from "../../lib/admin/resources";
import {
  canView,
  canCreate,
  permittedFields,
  navigationFor,
  fieldOptions,
} from "../../lib/admin/access";
import { seedDemo, hydrate, demoOverview } from "../../lib/admin/demo";
const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
const STORE = "gmc-parking-admin-demo-v1";
async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(`${API}/api/admin${path}`, {
      credentials: "include",
      signal: AbortSignal.timeout(15000),
      ...options,
      headers: { "Content-Type": "application/json", ...options.headers },
    });
  } catch {
    throw new Error(
      `Cannot connect to ${API}. Start the backend and check NEXT_PUBLIC_API_URL and the allowed frontend origin.`,
    );
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(
      data.message || "The request could not be completed.",
    );
    error.status = response.status;
    throw error;
  }
  return data;
}
function Icon({ name = "grid" }) {
  const paths = {
    grid: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
    arrow: "M5 12h14 M13 6l6 6-6 6",
    plus: "M12 5v14 M5 12h14",
    menu: "M4 6h16 M4 12h16 M4 18h16",
    close: "M6 6l12 12 M18 6L6 18",
    building: "M4 21V7l8-4 8 4v14 M9 21v-5h6v5 M8 9h1 M15 9h1 M8 12h1 M15 12h1",
  };
  return (
    <svg
      width="19"
      height="19"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name] || paths.grid} />
    </svg>
  );
}
function Badge({ value }) {
  return (
    <span
      className={`admin-badge ${["ACTIVE", "SUCCEEDED", "COMPLETED", "CONFIRMED", true].includes(value) ? "positive" : ["PENDING", "HELD", "MAINTENANCE", "OUT_OF_SERVICE"].includes(value) ? "attention" : ""}`}
    >
      {display(value)}
    </span>
  );
}
function Modal({ title, children, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    const dialog = ref.current;
    dialog.showModal();
    return () => {
      dialog.close();
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="admin-modal"
      aria-labelledby="admin-dialog-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <header>
        <h2 id="admin-dialog-title">{title}</h2>
        <button
          className="icon-button"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <Icon name="close" />
        </button>
      </header>
      {children}
    </dialog>
  );
}
export default function AdminPanel() {
  const [mode, setMode] = useState(null),
    [user, setUser] = useState(null),
    [checking, setChecking] = useState(true),
    [view, setView] = useState("overview"),
    [mobile, setMobile] = useState(false),
    [db, setDb] = useState(null),
    [data, setData] = useState(null),
    [options, setOptions] = useState({}),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [page, setPage] = useState(1),
    [query, setQuery] = useState(""),
    [search, setSearch] = useState(""),
    [revision, setRevision] = useState(0),
    [modal, setModal] = useState(null),
    [saving, setSaving] = useState(false),
    [formError, setFormError] = useState(""),
    [formScope, setFormScope] = useState({});
  useEffect(() => {
    setFormScope(modal?.record || {});
  }, [modal]);
  useEffect(() => {
    const requested = new URLSearchParams(location.search).get("view");
    if (Object.hasOwn(resources, requested) || requested === "help")
      setView(requested);
    let alive = true;
    request("/session")
      .then((r) => {
        if (alive) {
          setUser(r.user);
          setMode("live");
        }
      })
      .catch((e) => {
        if (alive && e.status !== 401) setError(e.message);
      })
      .finally(() => alive && setChecking(false));
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    const listener = () => {
      const next =
        new URLSearchParams(location.search).get("view") || "overview";
      setData(null);
      setLoading(true);
      setModal(null);
      setView(
        Object.hasOwn(resources, next) || next === "help" ? next : "overview",
      );
      setRevision((r) => r + 1);
      setPage(1);
      setSearch("");
      setQuery("");
    };
    window.addEventListener("popstate", listener);
    return () => window.removeEventListener("popstate", listener);
  }, []);
  useEffect(() => {
    if (!mobile) return;
    const previous = document.activeElement;
    const sidebar = document.querySelector(".admin-sidebar");
    const focusable = Array.from(
      sidebar.querySelectorAll("a[href], button:not([disabled])"),
    );
    focusable[0]?.focus();
    const handleKey = (event) => {
      if (event.key === "Escape") setMobile(false);
      if (event.key === "Tab") {
        const first = focusable[0],
          last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("keydown", handleKey);
      previous?.focus();
    };
  }, [mobile]);
  const canRead = (name) => canView(user, mode, name);
  const canAdd = (name) => canCreate(user, mode, name, resources[name]);
  const fieldsFor = (record) =>
    permittedFields(user, mode, view, resources[view], record);
  function navigate(next) {
    if (!canRead(next)) next = "overview";
    setRevision((r) => r + 1);
    setData(null);
    setLoading(true);
    setView(next);
    setPage(1);
    setQuery("");
    setSearch("");
    setModal(null);
    setMobile(false);
    setError("");
    setNotice("");
    history.pushState(null, "", `?view=${next}`);
  }
  function demo() {
    setData(null);
    setLoading(true);
    let next;
    try {
      next = JSON.parse(localStorage.getItem(STORE));
    } catch {}
    if (
      !next ||
      !Object.keys(resources).every((key) => Array.isArray(next[key]))
    ) {
      next = seedDemo();
    }
    setDb(next);
    setMode("demo");
    setUser({ name: "Demo administrator", platformRole: "SUPER_ADMIN" });
    setError("");
  }
  useEffect(() => {
    if (mode === "demo" && db) {
      try {
        localStorage.setItem(STORE, JSON.stringify(db));
      } catch {
        setNotice(
          "Browser storage is unavailable. Demo changes will last for this visit only.",
        );
      }
    }
  }, [db, mode]);
  useEffect(() => {
    if (!mode) return;
    if (!canView(user, mode, view)) {
      setData(null);
      setView("overview");
      history.replaceState(null, "", "?view=overview");
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError("");
    setData(null);
    async function load() {
      try {
        if (mode === "demo") {
          setOptions(
            Object.fromEntries(
              ["organizations", "sites", "leases", "users", "memberships"].map(
                (k) => [k, db[k].map((r) => hydrate(db, k, r))],
              ),
            ),
          );
          if (view === "overview") setData(demoOverview(db));
          else if (resources[view]) {
            const all = db[view]
              .map((r) => hydrate(db, view, r))
              .filter((r) =>
                JSON.stringify(r).toLowerCase().includes(search.toLowerCase()),
              );
            setData({
              items: all.slice((page - 1) * 20, page * 20),
              total: all.length,
            });
          }
        } else {
          const [result, lookups] = await Promise.all([
            view === "overview"
              ? request("/overview")
              : view === "help"
                ? Promise.resolve(null)
                : request(
                    `/resources/${view}?page=${page}&pageSize=20&q=${encodeURIComponent(search)}`,
                  ),
            request("/options"),
          ]);
          if (!cancelled) {
            setData(result);
            setOptions(lookups);
            if (lookups.access)
              setUser((current) => ({ ...current, access: lookups.access }));
          }
        }
      } catch (e) {
        if (!cancelled) {
          setError(e.message);
          if (e.status === 401 || e.status === 403) {
            setMode(null);
            setUser(null);
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [mode, view, page, search, revision, db]);
  async function login(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const f = new FormData(e.currentTarget);
    try {
      const r = await request("/login", {
        method: "POST",
        body: JSON.stringify({
          email: f.get("email"),
          password: f.get("password"),
        }),
      });
      setData(null);
      setLoading(true);
      setUser(r.user);
      setMode("live");
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }
  async function logout() {
    try {
      if (mode === "live")
        await request("/logout", { method: "POST", body: "{}" });
      setMode(null);
      setUser(null);
      setData(null);
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }
  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setFormError("");
    try {
      const form = new FormData(e.currentTarget),
        body = {};
      const config = resources[view];
      for (const f of fieldsFor(modal.record)) {
        const value = form.get(f.key);
        if (f.key === "password" && !value) continue;
        if (f.type === "checkbox") body[f.key] = form.has(f.key);
        else if (value === "" || value === null) {
          if (modal.record) body[f.key] = null;
        } else if (f.type === "datetime-local")
          body[f.key] = new Date(value).toISOString();
        else if (
          f.type === "reference" ||
          f.type === "number" ||
          f.key === "weekday"
        )
          body[f.key] = Number(value);
        else body[f.key] = value;
      }
      if (body.startsAt && body.endsAt && body.startsAt >= body.endsAt)
        throw new Error("End time must be after start time.");
      if (
        body.validUntil &&
        body.validFrom &&
        body.validUntil <= body.validFrom
      )
        throw new Error("Valid until must be after valid from.");
      if (
        body.opensMinute !== undefined &&
        body.opensMinute >= body.closesMinute
      )
        throw new Error("Closing time must be after opening time.");
      if (mode === "demo") {
        delete body.password;
        const now = new Date().toISOString();
        setDb((current) => {
          const records = current[view];
          const record = modal.record
            ? {
                ...records.find((r) => r.id === modal.record.id),
                ...body,
                updatedAt: now,
              }
            : {
                id: Math.max(0, ...records.map((r) => Number(r.id))) + 1,
                ...body,
                createdAt: now,
                ...(view === "qrcodes"
                  ? { token: `demo-${crypto.randomUUID()}` }
                  : {}),
              };
          return {
            ...current,
            [view]: modal.record
              ? records.map((r) => (r.id === record.id ? record : r))
              : [record, ...records],
            audit: [
              {
                id: Date.now(),
                actor: { name: "Demo administrator" },
                action: modal.record ? "UPDATE" : "CREATE",
                entityType: view,
                entityId: String(record.id),
                createdAt: now,
              },
              ...current.audit,
            ],
          };
        });
      } else
        await request(
          `/resources/${view}${modal.record ? `/${modal.record.id}` : ""}`,
          {
            method: modal.record ? "PATCH" : "POST",
            body: JSON.stringify(body),
          },
        );
      setModal(null);
      setNotice(
        `${config.singular || "Record"} saved${mode === "demo" ? " in this demo" : ""}.`,
      );
      setRevision((r) => r + 1);
    } catch (e) {
      setFormError(e.message);
    } finally {
      setSaving(false);
    }
  }
  if (checking)
    return (
      <div className="admin-app admin-loading">
        <span className="admin-logo">P</span>
        <p>Opening operations console…</p>
      </div>
    );
  if (!mode)
    return (
      <main className="admin-app admin-login">
        <section className="login-story">
          <a href="/" className="admin-brand">
            <span className="admin-logo">P</span>
            <span>
              GMC <b>Smart Parking</b>
            </span>
          </a>
          <div>
            <p className="eyebrow">GUWAHATI · OPERATIONS CONSOLE</p>
            <h1>
              A clearer view
              <br />
              of every space.
            </h1>
            <p>
              One workspace for your parking network.
              <br />
              Organizations, operators and everyday operations.
            </p>
          </div>
          <span className="login-foot">
            Connected places. Better city journeys.
          </span>
        </section>
        <section className="login-form">
          <p className="eyebrow">STAFF ACCESS</p>
          <h2>Welcome back.</h2>
          <p>Sign in to manage your parking network.</p>
          {error && (
            <div role="alert" className="admin-alert error">
              {error}
            </div>
          )}
          <form onSubmit={login}>
            <label>
              Email address
              <input
                name="email"
                type="email"
                autoComplete="username"
                required
                placeholder="staff@your-organization.in"
              />
            </label>
            <label>
              Password
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                required
                placeholder="Enter your password"
              />
            </label>
            <button className="primary" disabled={saving}>
              {saving ? "Signing in…" : "Sign in to console"}
              <Icon name="arrow" />
            </button>
          </form>
          <div className="demo-entry">
            <b>Take a look around</b>
            <p>
              Explore a sample parking network. Changes stay in your browser and
              never affect live operations.
            </p>
            <button className="secondary" onClick={demo}>
              Explore demo <Icon name="arrow" />
            </button>
          </div>
          <small>
            Use your staff email and password. Your active organization role and
            site assignments determine access. Ask your administrator if you
            need an account.
          </small>
        </section>
      </main>
    );
  const config = resources[view];
  const activeGroup = Object.entries(tabs).find(([, items]) =>
    items.includes(view),
  );
  const title =
    config?.title || (view === "help" ? "Getting started" : "Network overview");
  return (
    <div className="admin-app admin-shell">
      <aside className={`admin-sidebar ${mobile ? "open" : ""}`}>
        <a href="/" className="admin-brand">
          <span className="admin-logo">P</span>
          <span>
            GMC <b>Smart Parking</b>
          </span>
        </a>
        <div className="workspace-label">
          <span className="live-dot" />{" "}
          {mode === "demo" ? "Demo workspace" : "Administration"}
          <small>
            {mode === "demo" || user.access?.superAdmin
              ? "All organizations"
              : user.access?.organizations?.map((o) => o.name).join(" · ") ||
                "Assigned sites"}
          </small>
        </div>
        <nav aria-label="Administration">
          {navigationFor(groups, tabs, user, mode).map((g) => (
            <section key={g.label}>
              <p>{g.label}</p>
              {g.items.map(([key, name]) => (
                <button
                  key={key}
                  onClick={() => navigate(key)}
                  className={
                    view === key || tabs[key]?.includes(view) ? "active" : ""
                  }
                  aria-current={view === key ? "page" : undefined}
                >
                  <Icon
                    name={
                      key === "organizations" || key === "sites"
                        ? "building"
                        : "grid"
                    }
                  />
                  {name}
                  {key === view && <span className="nav-indicator" />}
                </button>
              ))}
            </section>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <span className="avatar">{user.name?.[0] || "A"}</span>
          <div>
            <b>{user.name}</b>
            <small>
              {mode === "demo"
                ? "Super administrator"
                : user.access?.label || "Staff"}
            </small>
          </div>
          <button onClick={logout} title="Sign out" aria-label="Sign out">
            ↗
          </button>
        </div>
      </aside>
      {mobile && (
        <button
          className="sidebar-scrim"
          aria-label="Close navigation"
          onClick={() => setMobile(false)}
        />
      )}
      <div className="admin-workspace">
        <header className="admin-topbar">
          <div>
            <button
              className="icon-button mobile-toggle"
              aria-label="Open navigation"
              onClick={() => setMobile(true)}
            >
              <Icon name="menu" />
            </button>
            <span>Operations</span>
            <span className="crumb">/</span>
            <b>{title}</b>
          </div>
          <span className="admin-topbar-right">
            <span className="live-dot" />
            {mode === "demo" ? "Sample network" : "Live workspace"}
          </span>
        </header>
        {mode === "demo" && (
          <div
            className="demo-banner"
            role="region"
            aria-label="Demo workspace notice"
          >
            <span>
              <b>DEMO MODE</b> Sample data · saved in this browser · no real
              payments
            </span>
            <button
              onClick={() => {
                if (confirm("Reset all demo changes?")) {
                  setDb(seedDemo());
                  setNotice("Demo has been reset.");
                }
              }}
            >
              Reset demo
            </button>
          </div>
        )}
        <main className="admin-main">
          <div className="page-heading">
            <div>
              <p className="eyebrow">
                {view === "overview"
                  ? "YOUR CITY, AT A GLANCE"
                  : "PARKING OPERATIONS"}
              </p>
              <h1>
                {title}
                <span className="heading-dot">.</span>
              </h1>
              <p>
                {config?.description ||
                  (view === "help"
                    ? "From your first organization to a ready-to-operate parking site."
                    : "A shared picture of your parking network and the work that needs attention.")}
              </p>
            </div>
            {canAdd(view) && (
              <button
                className="primary"
                disabled={loading}
                onClick={() => {
                  setFormError("");
                  setModal({ type: "edit" });
                }}
              >
                <Icon name="plus" />
                Add {config.singular}
              </button>
            )}
            {view === "overview" && canRead("sites") && (
              <button className="primary" onClick={() => navigate("sites")}>
                {mode === "demo" || user.access?.permissions?.sites?.update
                  ? "Manage parking areas"
                  : "View parking areas"}
                <Icon name="arrow" />
              </button>
            )}
          </div>
          {activeGroup && (
            <div
              className="admin-tabs"
              role="navigation"
              aria-label="Related resources"
            >
              {activeGroup[1].filter(canRead).map((k) => (
                <button
                  key={k}
                  className={view === k ? "active" : ""}
                  onClick={() => navigate(k)}
                >
                  {resources[k].title}
                </button>
              ))}
            </div>
          )}
          {notice && (
            <div role="status" className="admin-alert success">
              {notice}
              <button
                onClick={() => setNotice("")}
                aria-label="Dismiss message"
              >
                ×
              </button>
            </div>
          )}
          {error && (
            <div role="alert" className="admin-alert error">
              {error}
              <button onClick={() => setRevision((r) => r + 1)}>Retry</button>
            </div>
          )}
          {options.truncated && (
            <div className="admin-alert">
              Reference lists are limited to 1,000 records. If the required
              record is missing, ask an administrator to narrow the dataset; do
              not choose a substitute.
            </div>
          )}
          {loading ? (
            <div className="loading-state">
              <span className="spinner" />
              Loading {title.toLowerCase()}…
            </div>
          ) : view === "help" ? (
            <Help />
          ) : view === "overview" && data?.counts ? (
            <Overview
              data={data}
              navigate={navigate}
              canRead={canRead}
              canAdd={canAdd}
            />
          ) : config && Array.isArray(data?.items) ? (
            <>
              <div className="table-toolbar">
                {!["memberships", "assignments", "hours"].includes(view) && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      setSearch(query);
                      setPage(1);
                    }}
                  >
                    <input
                      aria-label={`Search ${title}`}
                      placeholder={`Search ${title.toLowerCase()}…`}
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                    <button className="secondary" type="submit">
                      Search
                    </button>
                  </form>
                )}
                <span>
                  {data.total} {data.total === 1 ? "record" : "records"}
                  {!canAdd(view) &&
                    !data.items.some((row) => fieldsFor(row).length) &&
                    " · Read only"}
                </span>
                <button
                  className="text-button"
                  onClick={() => setRevision((r) => r + 1)}
                >
                  Refresh
                </button>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      {config.columns.map((k) => (
                        <th key={k}>{label(k)}</th>
                      ))}
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((row) => (
                      <tr key={row.id}>
                        {config.columns.map((k, i) => (
                          <td key={k} className={i === 0 ? "strong-cell" : ""}>
                            {k === "status" || k === "isActive" ? (
                              <Badge value={row[k]} />
                            ) : (
                              <>
                                {display(row[k], k)}
                                {k.endsWith("Minor") && (
                                  <small>
                                    {" "}
                                    {row.currency ||
                                      row.lease?.currency ||
                                      "INR"}
                                  </small>
                                )}
                              </>
                            )}
                          </td>
                        ))}
                        <td>
                          <div className="row-actions">
                            <button
                              onClick={() =>
                                setModal({ type: "detail", record: row })
                              }
                            >
                              View
                            </button>
                            {fieldsFor(row).length > 0 && (
                              <button
                                onClick={() => {
                                  setFormError("");
                                  setModal({ type: "edit", record: row });
                                }}
                              >
                                Edit
                              </button>
                            )}
                            {view === "qrcodes" && (
                              <button
                                onClick={() =>
                                  setModal({ type: "qr", record: row })
                                }
                              >
                                QR
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!data.items.length && (
                  <div className="empty-state">
                    <Icon name="building" />
                    <h3>
                      {search
                        ? "No matching records"
                        : `No ${title.toLowerCase()} yet`}
                    </h3>
                    <p>
                      {search
                        ? "Try a different search term."
                        : canAdd(view)
                          ? "Add your first record to get started."
                          : "Records will appear here when the connected service records activity."}
                    </p>
                  </div>
                )}
              </div>
              <div className="pagination">
                <span>
                  Page {page} of {Math.max(1, Math.ceil(data.total / 20))}
                </span>
                <div>
                  <button
                    className="secondary"
                    disabled={page === 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Previous
                  </button>
                  <button
                    className="secondary"
                    disabled={page * 20 >= data.total}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          ) : null}
          <footer className="admin-footer">
            <span>GMC Smart Parking · Operations console</span>
            <span>
              Time display: {Intl.DateTimeFormat().resolvedOptions().timeZone}
            </span>
          </footer>
        </main>
      </div>
      {modal && (
        <Modal
          title={
            modal.type === "edit"
              ? `${modal.record ? "Edit" : "Add"} ${config.singular}`
              : modal.type === "qr"
                ? "Site QR code"
                : "Record details"
          }
          onClose={() => !saving && setModal(null)}
        >
          {modal.type === "edit" ? (
            <form onSubmit={save}>
              <div className="modal-content">
                {formError && (
                  <div role="alert" className="admin-alert error">
                    {formError}
                  </div>
                )}
                <p className="form-hint">
                  {modal.record && config.edit
                    ? "Only the fields below can be changed. Historical terms are preserved."
                    : "Required fields are marked with *."}{" "}
                  Dates use {Intl.DateTimeFormat().resolvedOptions().timeZone}{" "}
                  and are stored in UTC.
                </p>
                <div className="form-grid">
                  {fieldsFor(modal.record).map((f) => {
                    let value =
                      (f.type === "password" ? "" : modal.record?.[f.key]) ??
                      f.default ??
                      (f.values?.[0] || "");
                    if (f.type === "datetime-local" && value) {
                      const date = new Date(value);
                      date.setMinutes(
                        date.getMinutes() - date.getTimezoneOffset(),
                      );
                      value = date.toISOString().slice(0, 16);
                    }
                    return (
                      <label
                        key={f.key}
                        className={
                          f.type === "checkbox" ? "checkbox-label" : ""
                        }
                      >
                        {f.type === "checkbox" ? (
                          <>
                            <input
                              type="checkbox"
                              name={f.key}
                              defaultChecked={!!value}
                            />
                            {f.label}
                          </>
                        ) : (
                          <>
                            {f.label}
                            {f.required && " *"}
                            {f.type === "select" || f.type === "reference" ? (
                              <select
                                name={f.key}
                                defaultValue={value}
                                required={f.required}
                                onChange={(event) =>
                                  setFormScope((current) => ({
                                    ...current,
                                    [f.key]: event.target.value,
                                  }))
                                }
                              >
                                {f.type === "reference" && (
                                  <option value="">
                                    Select {f.label.toLowerCase()}
                                  </option>
                                )}
                                {fieldOptions(
                                  user,
                                  mode,
                                  view,
                                  f,
                                  options,
                                  modal.record || formScope,
                                ).map((o) => (
                                  <option key={o.id ?? o} value={o.id ?? o}>
                                    {typeof o === "object"
                                      ? `${display(o)}${o.organization?.name ? ` · ${o.organization.name}` : ""} (#${o.id})`
                                      : display(o)}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <input
                                name={f.key}
                                type={
                                  f.type === "money" || f.type === "decimal"
                                    ? "text"
                                    : f.type
                                }
                                defaultValue={value}
                                required={f.required}
                                min={f.type === "number" ? 0 : undefined}
                                step={f.type === "number" ? 1 : undefined}
                                pattern={
                                  f.type === "money" ? "[0-9]+" : undefined
                                }
                                inputMode={
                                  f.type === "money" ? "numeric" : undefined
                                }
                                minLength={
                                  f.type === "password" ? 12 : undefined
                                }
                                autoComplete={
                                  f.type === "password"
                                    ? "new-password"
                                    : undefined
                                }
                              />
                            )}
                          </>
                        )}
                      </label>
                    );
                  })}
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="secondary"
                  disabled={saving}
                  onClick={() => setModal(null)}
                >
                  Cancel
                </button>
                <button className="primary" disabled={saving}>
                  {saving ? "Saving…" : "Save changes"}
                </button>
              </div>
            </form>
          ) : modal.type === "qr" ? (
            <QrPreview record={modal.record} mode={mode} />
          ) : (
            <div className="modal-content">
              <dl className="record-details">
                {Object.entries(modal.record)
                  .filter(
                    ([key]) => key !== "passwordHash" && key !== "_access",
                  )
                  .map(([key, value]) => (
                    <div key={key}>
                      <dt>{label(key)}</dt>
                      <dd>
                        {typeof value === "object" && value !== null ? (
                          <pre>{JSON.stringify(value, null, 2)}</pre>
                        ) : (
                          display(value, key)
                        )}
                      </dd>
                    </div>
                  ))}
              </dl>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
function Overview({ data, navigate, canRead, canAdd }) {
  const c = data.counts;
  const occupancy = c.slots ? Math.round((c.occupied / c.slots) * 100) : 0;
  return (
    <>
      <div className="overview-stats">
        <div>
          <span>Parking areas</span>
          <strong>{String(c.sites).padStart(2, "0")}</strong>
          <small>Across {c.organizations} organizations</small>
        </div>
        <div>
          <span>Total parking slots</span>
          <strong>{c.slots}</strong>
          <small>Registered physical inventory</small>
        </div>
        <div>
          <span>Checked-in occupancy</span>
          <strong>
            {occupancy}
            <em>%</em>
          </strong>
          <small>{c.occupied} currently checked in</small>
        </div>
        <div>
          <span>
            {canRead("payments")
              ? "Successful collections"
              : "Recorded bookings"}
          </span>
          <strong className="money-stat">
            {!canRead("payments")
              ? c.bookings
              : data.revenue.length
                ? data.revenue.map((r) => (
                    <span key={r.currency}>
                      {r.currency} {display(r.amountMinor, "amountMinor")}
                    </span>
                  ))
                : "—"}
          </strong>
          <small>
            {canRead("payments")
              ? "All time · before refunds"
              : "Within your access scope"}
          </small>
        </div>
      </div>
      <div className="overview-columns">
        <section className="network-section">
          <div className="section-heading">
            <h2>Your parking network</h2>
            {canRead("sites") && (
              <button onClick={() => navigate("sites")}>
                View all areas ↗
              </button>
            )}
          </div>
          {data.sites.length ? (
            data.sites.map((site, i) => (
              <article className="site-strip" key={site.id}>
                <span className="site-number">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="site-info">
                  <h3>{site.name}</h3>
                  <p>
                    {site.leases?.find((l) => l.status === "ACTIVE")
                      ?.organization?.name || "No active leaseholder"}{" "}
                    · {site.code}
                  </p>
                  <div className="slot-track">
                    {Array.from(
                      { length: Math.min(24, site._count?.slots || 0) },
                      (_, j) => (
                        <span
                          key={j}
                          className={
                            site.status === "ACTIVE"
                              ? "available"
                              : "unavailable"
                          }
                        />
                      ),
                    )}
                  </div>
                  <small>
                    {site._count?.slots || 0} registered slots · inventory
                    indicator
                  </small>
                </div>
                <Badge value={site.status} />
              </article>
            ))
          ) : (
            <div className="empty-state">
              <h3>No active parking areas in your scope</h3>
              <p>
                {canAdd("organizations")
                  ? "Add an organization, then register your first parking area."
                  : "Ask your administrator to check your operating leases and site assignments."}
              </p>
              {canAdd("organizations") && (
                <button
                  className="primary"
                  onClick={() => navigate("organizations")}
                >
                  Start with an organization
                </button>
              )}
            </div>
          )}
        </section>
        <aside className="attention-panel">
          <p className="eyebrow">KEEP THINGS MOVING</p>
          <h2>Needs attention</h2>
          {canRead("payments") && (
            <button onClick={() => navigate("payments")}>
              <span className="attention-number">{c.pendingPayments}</span>
              <div>
                <b>Pending payments</b>
                <p>Review collection history</p>
              </div>
              <span>↗</span>
            </button>
          )}
          {canRead("leases") && (
            <button onClick={() => navigate("leases")}>
              <span className="attention-number">
                {data.expiringLeases.length}
              </span>
              <div>
                <b>Expiring leases</b>
                <p>Upcoming renewals</p>
              </div>
              <span>↗</span>
            </button>
          )}
          <div className="attention-note">
            <b>A place for every detail.</b>
            <p>
              Link operators, set opening hours and publish site QR codes before
              opening a parking area.
            </p>
            <button onClick={() => navigate("help")}>
              View setup guide <Icon name="arrow" />
            </button>
          </div>
        </aside>
      </div>
      <section className="recent-section">
        <div className="section-heading">
          <div>
            <h2>Recent bookings</h2>
            <p>{c.bookings} bookings recorded across your network</p>
          </div>
          {canRead("bookings") && (
            <button onClick={() => navigate("bookings")}>
              View bookings ↗
            </button>
          )}
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Booking</th>
                <th>Customer</th>
                <th>Parking area</th>
                <th>Vehicle</th>
                <th>Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.recentBookings.slice(0, 5).map((b) => (
                <tr key={b.id}>
                  <td className="strong-cell">{b.reference}</td>
                  <td>{b.user?.name || "—"}</td>
                  <td>{b.slot?.parkingArea?.name || "—"}</td>
                  <td>{b.vehicleRegistration}</td>
                  <td>
                    {b.currency} {display(b.totalMinor, "totalMinor")}
                  </td>
                  <td>
                    <Badge value={b.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!data.recentBookings.length && (
            <div className="empty-state">No bookings recorded yet.</div>
          )}
        </div>
      </section>
    </>
  );
}
function QrPreview({ record, mode }) {
  const ref = useRef(null);
  const [message, setMessage] = useState("");
  const url = `${typeof location !== "undefined" ? location.origin : ""}/scan/?token=${encodeURIComponent(record.token)}`;
  const unavailable =
    record.revokedAt ||
    (record.expiresAt && new Date(record.expiresAt) < new Date());
  function download() {
    const svg = ref.current.querySelector("svg");
    const blob = new Blob([new XMLSerializer().serializeToString(svg)], {
      type: "image/svg+xml",
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `parking-qr-${record.id}.svg`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }
  return (
    <div className="modal-content qr-preview">
      {mode === "demo" && (
        <div className="admin-alert">
          Demo preview only. This code will not resolve to a live parking area.
        </div>
      )}
      {unavailable && (
        <div className="admin-alert error">
          This QR code is revoked or expired. Do not distribute it.
        </div>
      )}
      <h3>{record.parkingArea?.name || record.label || "Parking area"}</h3>
      <div ref={ref} className="qr-paper">
        <QRCodeSVG value={url} size={224} marginSize={4} />
      </div>
      <p>{record.label}</p>
      <code>{url}</code>
      <div className="qr-actions">
        <button
          className="secondary"
          disabled={!!unavailable}
          onClick={download}
        >
          Download SVG
        </button>
        <button
          className="primary"
          disabled={!!unavailable}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(url);
              setMessage("Link copied.");
            } catch {
              setMessage("Copy unavailable. Select and copy the link above.");
            }
          }}
        >
          Copy link
        </button>
      </div>
      <p role="status">{message}</p>
    </div>
  );
}
function Help() {
  return (
    <div className="help-content">
      <section className="help-intro">
        <p className="eyebrow">SETUP PLAYBOOK</p>
        <h2>
          One connected network.
          <br />A straightforward setup.
        </h2>
        <p>
          Use the sequence below to establish a parking operation. Super
          administrators can inspect every organization and service; staff see
          only the organizations and sites granted by their active roles.
        </p>
      </section>
      <ol className="help-steps">
        {[
          [
            "Create the organization",
            "Record the leaseholder’s name, unique code and contact details in Organizations.",
          ],
          [
            "Register the parking area",
            "Add its address, timezone and site code. The physical site remains the same when its leaseholder changes.",
          ],
          [
            "Connect it with a lease",
            "Select the organization and parking area. Record the work order and lease dates, then activate when ready.",
          ],
          [
            "Set up slots, hours and prices",
            "Create slots by vehicle type. Opening hours use local minutes after midnight. Add closures as needed. Pricing values are integer paise: 4,000 means ₹40.",
          ],
          [
            "Give your team the right roles",
            "Create staff with an email and password. Use MEMBER for site-only staff, then assign a MANAGER, OPERATOR, TICKET_COLLECTOR or VIEWER role on an active lease. Organization OWNER, ADMIN, ACCOUNTANT and VIEWER grant organization-wide access. Everyone uses this same sign-in page.",
          ],
          [
            "Publish the site QR code",
            "Create a QR code for the area and download it from the QR action. Codes resolve to site information. Online booking and payment processing are not enabled by this admin panel.",
          ],
          [
            "Monitor and maintain",
            "Review bookings, payment attempts, refunds and audit history. Retire slots or deactivate records instead of deleting history. Version tariff terms by creating a new plan.",
          ],
        ].map(([title, text], i) => (
          <li key={title}>
            <span>{String(i + 1).padStart(2, "0")}</span>
            <div>
              <h3>{title}</h3>
              <p>{text}</p>
            </div>
          </li>
        ))}
      </ol>
      <div className="admin-alert">
        <b>Working with dates and history</b>
        <p>
          Form dates and displayed timestamps use your browser timezone; the
          service stores UTC. Opening hours are interpreted in each parking
          area’s timezone. Finance and bookings are read only. Demo mode saves
          only sample changes in this browser.
        </p>
      </div>
      <p className="form-hint">
        Full setup and administration documentation:{" "}
        <code>backend/docs/admin-panel.md</code>
      </p>
    </div>
  );
}
