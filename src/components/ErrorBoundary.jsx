import React from 'react';
import { RotateCcw } from 'lucide-react';

/** Keeps one broken screen from blanking the whole app. Resets on route change. */
export class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidUpdate(prev) { if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null }); }
  componentDidCatch(error, info) { console.error('Screen crashed:', error, info.componentStack); } // eslint-disable-line no-console
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="empty card" role="alert">
        <h4>Something went wrong on this screen</h4>
        <p className="muted">Your data is safe. Try again, or go back home.</p>
        <div className="row" style={{ justifyContent: 'center', marginTop: 12 }}>
          <button className="btn btn-primary" onClick={() => this.setState({ error: null })}><RotateCcw size={16} />Try again</button>
          <a className="btn btn-ghost" href="#/overview">Go home</a>
        </div>
      </div>
    );
  }
}
