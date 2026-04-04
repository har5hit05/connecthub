import React from 'react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        this.setState({
            error: error,
            errorInfo: errorInfo
        });
        // In the future, this is where we log to an error reporting service like Sentry
        console.error('ErrorBoundary caught an error:', error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{ padding: '40px', textAlign: 'center', backgroundColor: '#1a1a2e', color: '#fff', minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                    <h1 style={{ color: '#ff4d4f', marginBottom: '20px' }}>Something went wrong.</h1>
                    <p style={{ maxWidth: '600px', opacity: 0.8, marginBottom: '30px' }}>
                        ConnectHub encountered an unexpected error. Please refresh the page or try again later.
                    </p>
                    <button 
                        onClick={() => window.location.reload()} 
                        style={{ padding: '10px 24px', backgroundColor: '#4a4e69', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '16px' }}
                    >
                        Refresh Page
                    </button>
                    
                    {process.env.NODE_ENV === 'development' && (
                        <details style={{ whiteSpace: 'pre-wrap', marginTop: '40px', padding: '20px', backgroundColor: '#111', borderRadius: '8px', textAlign: 'left', maxWidth: '800px', width: '100%' }}>
                            <summary style={{ cursor: 'pointer', color: '#ff4d4f', fontWeight: 'bold' }}>View Stack Trace (Dev Only)</summary>
                            <br />
                            {this.state.error && this.state.error.toString()}
                            <br />
                            {this.state.errorInfo && this.state.errorInfo.componentStack}
                        </details>
                    )}
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
