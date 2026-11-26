import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

// Header search. Trims the text, ignores an empty submit and goes to /search?q=... On the News section (/news...) the same box
// searches the news instead: placeholder "Search news…" and it goes to /news/search?q=...
export default function SearchBar({ onDone }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [value, setValue] = useState("");
  const inNews = location.pathname === "/news" || location.pathname.startsWith("/news/");
  const resultsPath = inNews ? "/news/search" : "/search";

  // Show the current query while on the results page.
  useEffect(() => {
    setValue(location.pathname === resultsPath ? new URLSearchParams(location.search).get("q") || "" : "");
  }, [location.pathname, location.search, resultsPath]);

  const submit = (event) => {
    event.preventDefault();
    const q = value.trim();
    if (!q) return;
    if (inNews && q.length < 2) return; // the news search needs two characters
    navigate(`${resultsPath}?q=${encodeURIComponent(q)}`);
    onDone?.();
  };

  return (
    <form className="search-bar" role="search" onSubmit={submit}>
      <label htmlFor="site-search" className="sr-only">{inNews ? "Search news" : "Search stories"}</label>
      <input id="site-search" type="search" placeholder={inNews ? "Search news…" : "Search stories…"} value={value} onChange={(e) => setValue(e.target.value)} autoComplete="off" />
      <button type="submit" className="btn small">Search</button>
    </form>
  );
}
