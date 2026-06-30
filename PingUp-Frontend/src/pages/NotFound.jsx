import { Link, useNavigate } from "react-router-dom";
import { Home, ArrowLeft } from "lucide-react";
import "../styles/notfound.css";

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="notfound-container">
      <div className="notfound-code">404</div>

      <h1 className="notfound-title">Page Not Found</h1>

      <p className="notfound-text">
        The page you are looking for doesn&apos;t exist or has been moved.
      </p>

      <div className="notfound-actions">
        <button onClick={() => navigate(-1)} className="notfound-btn notfound-btn-secondary">
          <ArrowLeft size={18} />
          Go Back
        </button>
        <Link to="/" className="notfound-btn notfound-btn-primary">
          <Home size={18} />
          Go Home
        </Link>
      </div>
    </div>
  );
}
