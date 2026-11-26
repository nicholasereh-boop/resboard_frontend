import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useBlocker, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import ConfirmDialog from "../../../components/ConfirmDialog";
import ErrorBoundary from "../../../components/ErrorBoundary";
import MediaPicker from "../../../components/media/MediaPicker";
import StatusBadge from "../../../components/StatusBadge";
import StoryEditor from "../../../editor/StoryEditor";
import { emptyDoc, fromServerDoc, toServerDoc } from "../../../editor/schema";
import { useAutosave } from "../../../hooks/useAutosave";
import { changedKeys, pickChanged } from "../../../utils/autosave";
import { clearDraft, readDraft, writeDraft } from "../../../utils/draftStore";
import { defaultScheduleValue, fmtClock, fmtDateTime } from "../../../utils/format";
import { createNewsArticle, createNewsCategory, listNewsCategoriesAdmin, newsArticleAction, updateNewsArticle } from "../api/newsroom";
import { useNewsConfig } from "../hooks/useNewsConfig";
import { htmlToDoc } from "../utils/htmlToDoc";
import { errorText } from "../utils/text";

// The News writing screen: the Story editor (same editor, same media library), with only what news needs beside it.
// Written here = in-house news: no source to pick, no rights forms. It leaves the public site automatically after the retention period.
const KEYS = ["title", "standfirst", "content_json", "cover_image", "category", "author_name", "is_featured", "is_breaking"];
const DRAFT_PREFIX = "news-";

const blank = () => ({ title: "", standfirst: "", content_json: emptyDoc(), cover: null, category: "", author_name: "", is_featured: false, is_breaking: false });
const fromArticle = (a) => ({
  title: a.title || "", standfirst: a.standfirst || "", cover: a.cover || null, category: a.category?.id || "", author_name: a.author_name || "",
  is_featured: Boolean(a.is_featured), is_breaking: Boolean(a.is_breaking),
  content_json: a.content_json ? fromServerDoc(a.content_json) : fromServerDoc(htmlToDoc(a.body)), // older articles only have plain HTML
});
const toPayload = (f) => ({
  title: f.title, standfirst: f.standfirst, content_json: toServerDoc(f.content_json), cover_image: f.cover?.id ?? null,
  category: f.category ? Number(f.category) : null, author_name: f.author_name, is_featured: f.is_featured, is_breaking: f.is_breaking,
});
const slugify = (s) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);

export default function NewsEditPage({ article = null }) {
  return <NewsEditScreen key={article?.id || "new"} initial={article} />;
}

function NewsEditScreen({ initial }) {
  const isNew = !initial;
  const id = initial?.id;
  const draftKey = DRAFT_PREFIX + (id || "new");
  const navigate = useNavigate();
  const qc = useQueryClient();
  const config = useNewsConfig();
  const days = config.inhouse_retention_days ?? 60;

  const start = useMemo(() => (initial ? fromArticle(initial) : blank()), [initial]);
  const [form, setForm] = useState(start);
  const [saved, setSaved] = useState(toPayload(start));
  const [meta, setMeta] = useState({ status: initial?.status || "draft", published_at: initial?.published_at, scheduled_for: initial?.scheduled_for, can_publish: initial?.can_publish ?? true, blockers: initial?.blockers || [] });
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(null);
  const [editorKey, setEditorKey] = useState(0);
  const [picker, setPicker] = useState(false);
  const [recovery, setRecovery] = useState(() => { const s = isNew ? readDraft(draftKey) : null; return s && s.form?.title ? s : null; });
  const [scheduleAt, setScheduleAt] = useState(defaultScheduleValue);
  const [newCat, setNewCat] = useState("");

  const savedRef = useRef(saved); const formRef = useRef(form); const currentRef = useRef(null); const skipBlock = useRef(false);
  const editorInit = useRef(start.content_json);
  formRef.current = form;
  const current = useMemo(() => toPayload(form), [form]);
  currentRef.current = current;
  const dirty = changedKeys(saved, current, KEYS).length > 0;
  const dirtyRef = useRef(dirty); dirtyRef.current = dirty;
  const getChanges = () => pickChanged(savedRef.current, currentRef.current, KEYS);

  const categories = useQuery({ queryKey: ["newsroom", "categories"], queryFn: listNewsCategoriesAdmin });
  const refreshLists = () => qc.invalidateQueries({ queryKey: ["newsroom", "articles"] });
  const metaFrom = (a) => ({ status: a.status, published_at: a.published_at, scheduled_for: a.scheduled_for, can_publish: a.can_publish, blockers: a.blockers || [] });

  const commit = (payload, result) => {
    savedRef.current = { ...savedRef.current, ...payload };
    setSaved(savedRef.current);
    if (result) setMeta(metaFrom(result));
    refreshLists();
  };
  const autosave = useAutosave({
    enabled: !isNew && ["draft", "pending", "rejected"].includes(meta.status), // published articles are saved by hand, so half-written edits never go live
    getChanges, send: (payload) => updateNewsArticle(id, payload),
    onSaved: commit, onFailed: (e) => setNotice({ type: "error", text: errorText(e) }),
  });

  const saveNow = () => {
    autosave.cancel();
    return autosave.exclusive(async () => {
      setNotice(null); autosave.setStatus("saving");
      try {
        if (isNew) {
          const created = await createNewsArticle(toPayload(formRef.current));
          clearDraft(draftKey); skipBlock.current = true; refreshLists();
          navigate(`/admin/news/articles/${created.id}`, { replace: true });
          return true;
        }
        const payload = getChanges();
        if (Object.keys(payload).length) commit(payload, await updateNewsArticle(id, payload));
        autosave.setStatus("saved"); setNotice({ type: "ok", text: "Saved." });
        return true;
      } catch (e) { autosave.setStatus("failed"); setNotice({ type: "error", text: errorText(e) }); return false; }
    });
  };

  const act = async (action, extra, okText) => {
    setBusy(action); setNotice(null);
    try {
      if (dirtyRef.current && !(await saveNow())) return;
      const fresh = await newsArticleAction(id, action, extra);
      setMeta(metaFrom(fresh)); refreshLists(); setNotice({ type: "ok", text: okText });
    } catch (e) { setNotice({ type: "error", text: errorText(e) }); } finally { setBusy(null); }
  };
  const publishNew = async () => { // new article: create, then publish in one click
    setBusy("publish");
    try {
      const created = await createNewsArticle(toPayload(formRef.current));
      clearDraft(draftKey); skipBlock.current = true; refreshLists();
      try { await newsArticleAction(created.id, "publish"); } catch { /* stays a draft; the next screen says why */ }
      navigate(`/admin/news/articles/${created.id}`, { replace: true });
    } catch (e) { setNotice({ type: "error", text: errorText(e) }); setBusy(null); }
  };
  const schedule = () => {
    const when = new Date(scheduleAt);
    if (!scheduleAt || Number.isNaN(when.getTime()) || when <= new Date()) return setNotice({ type: "error", text: "Pick a date and time in the future." });
    return act("schedule", { scheduled_for: when.toISOString() }, `Scheduled for ${fmtDateTime(when.toISOString())}.`);
  };

  const setField = (patch) => { setForm((f) => ({ ...f, ...patch })); autosave.trigger(); };
  const onEditorReady = useCallback((normalized) => {
    setForm((f) => ({ ...f, content_json: normalized }));
    if (JSON.stringify(editorInit.current) === JSON.stringify(savedRef.current?.content_json) || !initial?.content_json) {
      savedRef.current = { ...savedRef.current, content_json: normalized }; setSaved(savedRef.current);
    }
  }, [initial]);

  useEffect(() => {
    if (recovery) return undefined;
    const t = setTimeout(() => (dirty ? writeDraft(draftKey, form) : clearDraft(draftKey)), 500);
    return () => clearTimeout(t);
  }, [form, dirty, recovery, draftKey]);
  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (e) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirtyRef.current && !skipBlock.current && currentLocation.pathname !== nextLocation.pathname);

  const addCategory = async () => {
    const name = newCat.trim(); if (!name) return;
    try {
      const c = await createNewsCategory({ name, slug: slugify(name) || "news" });
      await qc.invalidateQueries({ queryKey: ["newsroom", "categories"] }); qc.invalidateQueries({ queryKey: ["news", "categories"] });
      setNewCat(""); setField({ category: c.id });
    } catch (e) { setNotice({ type: "error", text: errorText(e) }); }
  };

  const status = autosave.status;
  const statusText = status === "saving" ? "Saving…" : status === "retrying" ? "Autosave failed — retrying…" : status === "failed" ? "Not saved — see the message on this page"
    : dirty ? "Unsaved changes" : autosave.savedAt ? `Saved ${fmtClock(autosave.savedAt)}` : isNew ? "Not saved yet" : "All changes saved";
  const published = meta.status === "published";
  const live = published || meta.status === "scheduled";
  const saving = busy !== null || status === "saving";
  const recycleOn = meta.published_at && days > 0 ? fmtDateTime(new Date(new Date(meta.published_at).getTime() + days * 86400000).toISOString()) : "";

  return (
    <>
      <div className="row wrap edit-top">
        <Link to="/admin/news" className="btn ghost small">← News</Link>
        <h1 className="grow">{isNew ? "New article" : "Edit article"}</h1>
        <span className={`save-state ${status}${dirty ? " dirty" : ""}`} role="status" aria-live="polite">{statusText}</span>
        {published && <Link className="btn secondary small" to={`/news/${initial.slug}`} target="_blank">View live</Link>}
      </div>
      {recovery && (
        <div className="notice info" role="alert">We found unsaved changes from {fmtClock(recovery.savedAt)} that were never saved.
          <div className="row">
            <button type="button" className="btn small" onClick={() => { setForm(recovery.form); editorInit.current = recovery.form.content_json; setEditorKey((k) => k + 1); setRecovery(null); }}>Restore them</button>
            <button type="button" className="btn secondary small" onClick={() => { clearDraft(draftKey); setRecovery(null); }}>Discard</button>
          </div>
        </div>
      )}
      {notice && <div className={`notice ${notice.type === "ok" ? "info" : notice.type}`} role={notice.type === "error" ? "alert" : "status"}>{notice.text}</div>}
      {!isNew && !meta.can_publish && meta.blockers.length > 0 && !live && <div className="notice error">This article cannot be published yet: {meta.blockers.join(", ").replace(/_/g, " ")}.</div>}

      <div className="edit-grid">
        <div className="edit-main">
          <label htmlFor="news-title" className="sr-only">Title</label>
          <input id="news-title" className="title-input" placeholder="Headline" maxLength={220} value={form.title} onChange={(e) => setField({ title: e.target.value })} />
          <label htmlFor="news-summary" className="sr-only">Summary</label>
          <textarea id="news-summary" rows={2} maxLength={500} placeholder="One-line summary (shown under the headline and on cards)" value={form.standfirst} onChange={(e) => setField({ standfirst: e.target.value })} style={{ width: "100%", margin: "0.5rem 0" }} />
          <ErrorBoundary title="The editor hit a problem.">
            <StoryEditor key={editorKey} initialContent={editorInit.current} onChange={(doc) => setField({ content_json: doc })} onReady={onEditorReady} />
          </ErrorBoundary>
        </div>

        <aside className="edit-side" aria-label="Article settings">
          <section className="side-section">
            <h2>Publish</h2>
            <p><StatusBadge status={meta.status} />{" "}
              {meta.status === "scheduled" && meta.scheduled_for && <span className="muted small">for {fmtDateTime(meta.scheduled_for)}</span>}
              {published && meta.published_at && <span className="muted small">since {fmtDateTime(meta.published_at)}</span>}</p>
            {published && recycleOn && <p className="hint">Leaves the public site automatically on {recycleOn} ({days} days after publishing). It is archived, not deleted, and can be restored.</p>}
            {!published && days > 0 && <p className="hint">News you write leaves the public site automatically {days} days after it is published.</p>}
            <div className="row wrap">
              <button type="button" className="btn" disabled={saving || (!isNew && !dirty)} onClick={() => saveNow()}>{busy === "save" ? "Saving…" : isNew || meta.status === "draft" ? "Save draft" : "Save changes"}</button>
              {isNew && <button type="button" className="btn secondary" disabled={saving || !form.title.trim()} onClick={publishNew}>{busy === "publish" ? "Publishing…" : "Publish"}</button>}
              {!isNew && !live && ["draft", "pending", "rejected"].includes(meta.status) && <button type="button" className="btn secondary" disabled={saving} onClick={() => act("publish", undefined, "Published.")}>{busy === "publish" ? "Publishing…" : "Publish"}</button>}
              {!isNew && live && <button type="button" className="btn secondary" disabled={saving} onClick={() => act("withdraw", { reason: "Unpublished by the editor" }, "Taken off the site.")}>Unpublish</button>}
              {!isNew && ["withdrawn", "archived", "quarantined"].includes(meta.status) && <button type="button" className="btn secondary" disabled={saving} onClick={() => act("restore", undefined, "Restored. You can publish it again.")}>Restore</button>}
            </div>
            {!isNew && ["draft", "pending", "rejected"].includes(meta.status) && (
              <div className="field schedule">
                <label htmlFor="news-schedule">Schedule for</label>
                <input id="news-schedule" type="datetime-local" value={scheduleAt} onChange={(e) => setScheduleAt(e.target.value)} />
                <button type="button" className="btn secondary small" disabled={saving} onClick={schedule}>Schedule</button>
              </div>
            )}
          </section>

          <section className="side-section">
            <h2>Cover image</h2>
            {form.cover?.url ? <img className="cover-preview" src={form.cover.url} alt={form.cover.alt_text || "Cover image"} /> : <p className="muted small">No cover image. Pictures come from the same media library as stories.</p>}
            <div className="row wrap">
              <button type="button" className="btn secondary small" onClick={() => setPicker(true)}>{form.cover ? "Change" : "Choose image"}</button>
              {form.cover && <button type="button" className="btn ghost small" onClick={() => setField({ cover: null })}>Remove</button>}
            </div>
          </section>

          <section className="side-section">
            <h2>Category</h2>
            <select value={form.category} onChange={(e) => setField({ category: e.target.value })} aria-label="Category">
              <option value="">None</option>
              {(categories.data || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <div className="row">
              <input value={newCat} maxLength={60} placeholder="New category" aria-label="New category" onChange={(e) => setNewCat(e.target.value)} />
              <button type="button" className="btn secondary small" disabled={!newCat.trim()} onClick={addCategory}>Add</button>
            </div>
          </section>

          <section className="side-section">
            <h2>Author</h2>
            <input value={form.author_name} maxLength={160} placeholder="Shown under the headline" aria-label="Author" onChange={(e) => setField({ author_name: e.target.value })} />
          </section>

          <section className="side-section">
            <label className="switch"><input type="checkbox" checked={form.is_featured} onChange={(e) => setField({ is_featured: e.target.checked })} /> Featured</label>
            <label className="switch"><input type="checkbox" checked={form.is_breaking} onChange={(e) => setField({ is_breaking: e.target.checked })} /> Breaking news</label>
          </section>
        </aside>
      </div>

      {picker && <MediaPicker title="Choose cover image" onPick={(a) => setField({ cover: { id: a.id, url: a.url, alt_text: a.alt_text, width: a.width, height: a.height } })} onClose={() => setPicker(false)} />}
      {blocker.state === "blocked" && <ConfirmDialog title="Leave without saving?" message="You have changes that are not saved yet." confirmLabel="Leave anyway" danger onCancel={() => blocker.reset()} onConfirm={() => blocker.proceed()} />}
    </>
  );
}
