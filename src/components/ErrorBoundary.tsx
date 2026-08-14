import { Component } from 'react';

import type { ReactNode } from 'react';

export default class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
    state = { hasError: false };

    static getDerivedStateFromError() {
        return { hasError: true };
    }

    render() {
        if (this.state.hasError) return null;

        return this.props.children;
    }
}
