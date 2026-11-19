import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { SITE_NAME } from "../../config";
import { FEATURE_TAGS } from "../../features";
import { useConsent } from "../../privacy/ConsentContext";
import AnalyticsToggle from "./AnalyticsToggle";

export default function Footer() {
  const { isStaff } = useAuth() || {};
  const { mode, reopen } = useConsent();
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <p>© {new Date().getFullYear()} {SITE_NAME}</p>
        <nav aria-label="Footer">
          <Link to="/stories">Stories</Link>
          <Link to="/categories">Categories</Link>
          {FEATURE_TAGS && <Link to="/tags">Tags</Link>}
          <Link to="/privacy">Privacy</Link>
          {mode === "notice" ? (
            <AnalyticsToggle />
          ) : (
            <button type="button" className="link-button" onClick={reopen}>Privacy settings</button>
          )}
          {isStaff && <Link to="/admin/stories">Admin</Link>}
        </nav>
      </div>
    </footer>
  );
}
