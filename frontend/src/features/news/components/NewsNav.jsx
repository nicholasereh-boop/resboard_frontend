import { useQuery } from "@tanstack/react-query";
import { Link, NavLink } from "react-router-dom";
import { listNewsCategories } from "../api/news";

// The News section's own sub-navigation: all news and one link per category. Searching the news is done with the site header search box.
export default function NewsNav() {
  const categories = useQuery({ queryKey: ["news", "categories"], queryFn: listNewsCategories, staleTime: 5 * 60_000 });
  const link = ({ isActive }) => (isActive ? "nw-tab is-active" : "nw-tab");
  return (
    <div className="nw-nav">
      <nav aria-label="News sections" className="nw-tabs">
        <NavLink to="/news" end className={link}>Latest</NavLink>
        {(categories.data || []).map((c) => <NavLink key={c.slug} to={`/news/category/${c.slug}`} className={link}>{c.name}</NavLink>)}
      </nav>
      <Link to="/news/report" className="nw-report">Report a problem</Link>
    </div>
  );
}
