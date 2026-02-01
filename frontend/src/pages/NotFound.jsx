import { Link } from 'react-router-dom';

function NotFound() {
    return (
        <div className="notfound-container">
            <div className="notfound-box">
                <h1 className="notfound-code">404</h1>
                <h2 className="notfound-title">Page Not Found</h2>
                <p className="notfound-text">The page you are looking for does not exist.</p>
                <Link to="/" className="notfound-btn">Go Home</Link>
            </div>
        </div>
    );
}

export default NotFound;