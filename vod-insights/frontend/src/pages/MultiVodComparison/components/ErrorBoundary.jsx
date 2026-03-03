import React from "react";
import styles from "../styles/ErrorBoundary.module.scss";

/**
 * Error Boundary component to catch React component errors
 * Prevents entire app crash if a child component fails to render
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log error details for debugging
    console.error("ErrorBoundary caught an error:", error);
    console.error("Error info:", errorInfo);

    this.setState({
      error,
      errorInfo,
    });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    const { hasError, error, errorInfo } = this.state;
    const { children } = this.props;

    if (hasError) {
      return (
        <div className={styles.errorContainer} role="alert">
          <h2 className={styles.title}>⚠️ Something went wrong</h2>
          <p className={styles.message}>
            An error occurred while rendering this page. Please try refreshing or contact support.
          </p>

          {process.env.NODE_ENV === "development" && (
            <details className={styles.details}>
              <summary>Error details (dev only)</summary>
              <pre className={styles.errorStack}>
                {error && error.toString()}
                {errorInfo && errorInfo.componentStack}
              </pre>
            </details>
          )}

          <button
            className={styles.resetButton}
            onClick={this.handleReset}
            aria-label="Reset error boundary and retry"
          >
            Try Again
          </button>
        </div>
      );
    }

    return children;
  }
}
