import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { deleteMedia, getMedia, replaceMedia, updateMedia } from "../../api";
import { fieldMessage, fileSize } from "../../utils/format";
import ConfirmDialog from "../ConfirmDialog";
import StatusBadge from "../StatusBadge";

// Side panel for one asset: preview, alt/caption, where it is used, replace file, delete.
export default function MediaPanel({ assetId, onClose }) {
  const queryClient = useQueryClient();
  const replaceInput = useRef(null);
  const [alt, setAlt] = useState("");
  const [caption, setCaption] = useState("");
  const [message, setMessage] = useState(null); // {type: "ok"|"error", text}
  const [confirm, setConfirm] = useState(null); // null | {usedIn: [...]|null}

  const { data: asset, isLoading, isError, error } = useQuery({
    queryKey: ["media", assetId],
    queryFn: () => getMedia(assetId),
  });

  useEffect(() => {
    if (asset) {
      setAlt(asset.alt_text || "");
      setCaption(asset.caption || "");
    }
  }, [asset]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["media"] });

  const save = useMutation({
    mutationFn: () => updateMedia(assetId, { alt_text: alt, caption }),
    onSuccess: () => { setMessage({ type: "ok", text: "Saved." }); refresh(); },
    onError: (err) => setMessage({ type: "error", text: fieldMessage(err, "alt_text", "caption") || err.friendly }),
  });

  const replace = useMutation({
    mutationFn: (file) => replaceMedia(assetId, file),
    onSuccess: () => { setMessage({ type: "ok", text: "File replaced. Stories using it now show the new picture." }); refresh(); },
    onError: (err) => setMessage({ type: "error", text: fieldMessage(err, "file") || err.friendly }),
  });

  const remove = useMutation({
    mutationFn: (force) => deleteMedia(assetId, force),
    onSuccess: () => { setConfirm(null); refresh(); onClose(); },
    onError: (err) => {
      // The server refuses (400) when the image is in use and sends the list in errors.used_in.
      const usedIn = err.fieldErrors?.used_in;
      if (Array.isArray(usedIn) && usedIn.length) {
        setConfirm({ usedIn, text: err.friendly });
      } else {
        setConfirm(null);
        setMessage({ type: "error", text: err.friendly });
      }
    },
  });

  if (isLoading) return <aside className="side-card"><p className="muted">Loading…</p></aside>;
  if (isError) return <aside className="side-card"><div className="notice error" role="alert">{error.friendly}</div></aside>;

  return (
    <aside className="side-card" aria-label="Image details">
      <div className="row">
        <h2 className="grow">Image details</h2>
        <button type="button" className="btn ghost small" aria-label="Close details" onClick={onClose}>✕</button>
      </div>
      <img className="panel-preview" src={asset.url} alt={asset.alt_text || ""} />
      <p className="muted small">
        {asset.width}×{asset.height} · {fileSize(asset.size_bytes)} · {asset.mime_type}
      </p>

      {message && <div className={`notice ${message.type === "ok" ? "info" : "error"}`} role={message.type === "ok" ? "status" : "alert"}>{message.text}</div>}

      <div className="field">
        <label htmlFor="mp-alt">Alt text</label>
        <input id="mp-alt" maxLength={300} value={alt} onChange={(e) => setAlt(e.target.value)} />
        <p className="hint">Describe what the picture shows, for people who cannot see it.</p>
      </div>
      <div className="field">
        <label htmlFor="mp-caption">Caption</label>
        <input id="mp-caption" maxLength={500} value={caption} onChange={(e) => setCaption(e.target.value)} />
      </div>
      <button type="button" className="btn" disabled={save.isPending} onClick={() => save.mutate()}>
        {save.isPending ? "Saving…" : "Save details"}
      </button>

      <h3>Used in</h3>
      {asset.used_in?.length ? (
        <ul className="plain-list">
          {asset.used_in.map((use) => (
            <li key={`${use.id}-${use.used_as}`}>
              <Link to={`/admin/stories/${use.id}/edit`}>{use.title || `Story ${use.id}`}</Link> <StatusBadge status={use.status} />{" "}
              <span className="muted small">({use.used_as})</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted small">Not used in any story.</p>
      )}

      <h3>Manage</h3>
      <div className="row wrap">
        <input ref={replaceInput} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) replace.mutate(f); }} />
        <button type="button" className="btn secondary" disabled={replace.isPending} onClick={() => replaceInput.current?.click()}>
          {replace.isPending ? "Replacing…" : "Replace file"}
        </button>
        <button type="button" className="btn danger" onClick={() => remove.mutate(false)} disabled={remove.isPending}>Delete</button>
      </div>

      {confirm && (
        <ConfirmDialog
          title="This image is in use"
          message={confirm.text}
          confirmLabel="Delete anyway"
          danger
          busy={remove.isPending}
          onCancel={() => setConfirm(null)}
          onConfirm={() => remove.mutate(true)}
        >
          <ul className="plain-list">
            {confirm.usedIn.map((use) => (
              <li key={`${use.id}-${use.used_as}`}>{use.title || `Story ${use.id}`} <span className="muted small">({use.status}, {use.used_as})</span></li>
            ))}
          </ul>
        </ConfirmDialog>
      )}
    </aside>
  );
}
