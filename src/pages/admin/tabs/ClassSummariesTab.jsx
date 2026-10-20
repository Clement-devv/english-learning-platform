// src/pages/admin/tabs/ClassSummariesTab.jsx
// Admin: every class summary teachers have written (one-to-one classes and group
// classes), newest first — search, filter by teacher / dates, see which families got it
// by email, "Email to family" now. The switch at the top emails new summaries to
// families automatically. Server: GET /class-summaries/admin, POST …/email
// (server/routes/classSummaryRoutes.js, server/utils/classSummaryEmails.js).
import { useState, useEffect, useCallback, useRef } from "react";
import { Search, Mail, CheckCircle2, MailX, Users, ChevronDown, ChevronUp, FileText } from "lucide-react";
import { useTranslation } from "react-i18next";
import api from "../../../api";
import { useOnDataChanged } from "../../../hooks/useLiveData";
import Pagination from "../../../components/Pagination";
import FamilyEmailSwitch from "../../../components/admin/FamilyEmailSwitch.jsx";
import { dateLocale } from "../../../i18n/dateLocale.js";

const fmtWhen = (d) => new Date(d).toLocaleString(dateLocale("en-GB"), { weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const fmtShort = (d) => new Date(d).toLocaleString(dateLocale("en-GB"), { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const inputCls = "w-full px-3 py-2 text-sm rounded-lg border border-ad-line bg-ad-surface text-ad-ink placeholder:text-ad-muted focus:outline-none focus:ring-2 focus:ring-[var(--a-accent-line)]";

export default function ClassSummariesTab({ teachers = [], isDarkMode }) {
  const { t } = useTranslation("admin");
  const tr = (key, def, opts) => t(`classSummariesTab.${key}`, def, opts);
  const [rows, setRows] = useState([]);
  const [pager, setPager] = useState({ page: 1, totalPages: 1, total: 0, limit: 10 });
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState({ teacherId: "", from: "", to: "" });
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(() => new Set());
  const [busy, setBusy] = useState("");
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  const showToast = (msg, type = "ok") => {
    setToast({ msg, type });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => { const id = setTimeout(() => setQ(search.trim()), 300); return () => clearTimeout(id); }, [search]);
  useEffect(() => { setPage(1); }, [q, filter]);

  const load = useCallback(async () => {
    try {
      const params = { page, limit: 10, q: q || undefined, ...Object.fromEntries(Object.entries(filter).filter(([, v]) => v)) };
      const { data } = await api.get("/class-summaries/admin", { params });
      setRows(data.summaries || []);
      setPager(data.pagination || { page: 1, totalPages: 1, total: 0, limit: 10 });
    } catch {
      showToast(tr("loadFailed", "Couldn't load class summaries"), "err");
    } finally { setLoading(false); }
  }, [page, q, filter]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);
  useOnDataChanged(["bookings", "group-classes"], load);

  const emailNow = async (row) => {
    // Already sent (automatically or by hand)? Ask before sending it again
    const last = row.students.filter((s) => s.emailedAt).sort((a, b) => new Date(b.emailedAt) - new Date(a.emailedAt))[0];
    if (last && !window.confirm(last.emailedManual
      ? tr("confirmAgain", "This summary was already emailed on {{date}}. Send it again?", { date: fmtShort(last.emailedAt) })
      : tr("confirmAgainAuto", "This summary was already emailed automatically on {{date}}. Send it again?", { date: fmtShort(last.emailedAt) }))) return;
    setBusy(row.id);
    try {
      const url = row.group ? `/class-summaries/group/${row.id}/email` : `/class-summaries/${row.id}/email`;
      const { data } = await api.post(url);
      showToast(data.message || tr("emailed", "Summary emailed"));
      load();
    } catch (err) {
      showToast(err?.response?.data?.message || tr("emailFailed", "Couldn't send the email"), "err");
    } finally { setBusy(""); }
  };

  const toggleOpen = (id) => setOpen((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const setF = (k) => (e) => setFilter((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-extrabold text-ad-ink m-0">{tr("title", "Class summaries")}</h2>
        <p className="text-sm text-ad-muted m-0 mt-1">{tr("subtitle", "What teachers wrote after each class. Families of managed students can get them by email.")}</p>
      </div>

      <FamilyEmailSwitch kind="classSummaryEmails" onToast={(m) => showToast(m)}
        title={tr("autoTitle", "Email class summaries to families automatically")}
        help={tr("autoHelp", "A few minutes after a teacher writes a class summary, managed students with an email address get it. Teachers and admins can also press \"Email to family\".")} />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
        <div className="relative sm:col-span-2 lg:col-span-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ad-muted" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} className={`${inputCls} !pl-9`}
            placeholder={tr("search", "Search class, student, teacher or text…")} aria-label={tr("search", "Search class, student, teacher or text…")} />
        </div>
        <select value={filter.teacherId} onChange={setF("teacherId")} className={inputCls} aria-label={tr("teacher", "Teacher")}>
          <option value="">{tr("allTeachers", "All teachers")}</option>
          {teachers.map((tch) => (
            <option key={tch._id} value={tch._id}>{tch.displayName?.trim() || `${tch.firstName || ""} ${tch.lastName || ""}`.trim()}</option>
          ))}
        </select>
        <input type="date" value={filter.from} onChange={setF("from")} className={inputCls} aria-label={tr("from", "From")} />
        <input type="date" value={filter.to} onChange={setF("to")} className={inputCls} aria-label={tr("to", "To")} />
      </div>

      <p className="text-xs text-ad-muted m-0">{tr("count", "{{count}} summaries", { count: pager.total })}</p>

      {loading ? (
        <div className="py-12 flex justify-center"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-ad-accent" /></div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-ad-line bg-ad-surface p-8 text-center">
          <FileText className="mx-auto mb-2 text-ad-muted" size={28} />
          <p className="m-0 font-bold text-ad-ink">{q || filter.teacherId || filter.from || filter.to ? tr("noMatch", "No summaries match") : tr("none", "No class summaries yet")}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => {
            const expanded = open.has(r.id);
            const long = (r.summary || "").length > 260;
            const families = r.students.filter((s) => s.isManaged);
            const canEmail = families.some((s) => s.email);
            return (
              <article key={r.id} className="rounded-xl border border-ad-line bg-ad-surface p-4 shadow-[var(--a-shadow)]">
                <div className="flex flex-wrap items-start gap-3 justify-between">
                  <div className="min-w-0">
                    <h3 className="m-0 text-base font-extrabold text-ad-ink flex items-center gap-2 flex-wrap">
                      {r.title}
                      {r.group && <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-ad-accent-soft text-ad-accent-ink inline-flex items-center gap-1"><Users size={11} /> {tr("group", "Group class")}</span>}
                    </h3>
                    <p className="m-0 mt-1 text-xs text-ad-muted">
                      {fmtWhen(r.scheduledTime)} · {r.duration} min{r.teacher ? ` · ${r.teacher.name}` : ""}
                    </p>
                  </div>
                  <button type="button" onClick={() => emailNow(r)} disabled={!!busy || !canEmail}
                    title={canEmail ? undefined : tr("noAddressTitle", "No managed student in this class has a family email address")}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-ad-accent text-ad-on-accent hover:bg-ad-accent-hover disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap">
                    <Mail size={14} /> {busy === r.id ? tr("sending", "Sending…") : r.students.some((s) => s.emailedAt) ? tr("emailAgain", "Email again") : tr("emailFamily", "Email to family")}
                  </button>
                </div>

                <p className="m-0 mt-3 text-sm text-ad-ink-2 whitespace-pre-wrap leading-relaxed">
                  {long && !expanded ? `${r.summary.slice(0, 260)}…` : r.summary}
                </p>
                {long && (
                  <button type="button" onClick={() => toggleOpen(r.id)} className="mt-1 text-xs font-bold text-ad-accent-ink inline-flex items-center gap-1 bg-transparent border-0 p-0 cursor-pointer">
                    {expanded ? <>{tr("less", "Show less")} <ChevronUp size={13} /></> : <>{tr("more", "Show all")} <ChevronDown size={13} /></>}
                  </button>
                )}

                <div className="mt-3 flex flex-wrap gap-2">
                  {r.students.map((s) => (
                    <span key={s.id} className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border border-ad-line text-ad-ink-2"
                      title={s.email || undefined}>
                      <strong className="text-ad-ink">{s.name}</strong>
                      {!s.isManaged ? <span className="text-ad-muted">· {tr("ownLogin", "own login")}</span>
                        : s.emailedAt ? <span className="text-emerald-700 inline-flex items-center gap-1"><CheckCircle2 size={12} /> {tr("emailedOn", "emailed {{date}}", { date: fmtShort(s.emailedAt) })}{s.emailedManual ? "" : ` · ${tr("auto", "auto")}`}</span>
                        : s.email ? <span className="text-ad-muted">· {tr("notEmailed", "not emailed yet")}</span>
                        : <span className="text-ad-muted inline-flex items-center gap-1"><MailX size={12} /> {tr("noEmail", "no email")}</span>}
                    </span>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
      )}

      <Pagination page={pager.page} totalPages={pager.totalPages} total={pager.total} pageSize={pager.limit}
        onPage={(p) => { setPage(p); window.scrollTo({ top: 0, behavior: "smooth" }); }} isDarkMode={isDarkMode} />

      {toast && (
        <div role="status" className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-lg shadow-lg text-white text-sm font-semibold ${toast.type === "err" ? "bg-rose-600" : "bg-emerald-600"}`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
