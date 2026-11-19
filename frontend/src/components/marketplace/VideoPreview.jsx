import { youtubeEmbedUrl } from "../../utils/youtube";

// The seller's demo video. Only an 11-character id ever reaches the iframe address (the server stores nothing else),
// the player is the privacy-friendly youtube-nocookie one, and it never autoplays.
export default function VideoPreview({ id, title, label = "Demo video", showHeading = false }) {
  if (!/^[A-Za-z0-9_-]{11}$/.test(id || "")) return null;
  return (
    <section aria-label={label} className="yt-embed">
      {showHeading ? <h3>{label}</h3> : null}
      <iframe
        src={youtubeEmbedUrl(id)}
        title={`${label}: ${title}`}
        allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        loading="lazy"
        referrerPolicy="strict-origin-when-cross-origin"
      />
    </section>
  );
}
