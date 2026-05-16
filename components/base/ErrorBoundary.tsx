import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, Pressable, useColorScheme } from 'react-native';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

// ErrorBoundary mounts above ThemeProvider, so we can't useTheme() here.
// Fall back to the system color scheme via useColorScheme inside a tiny
// functional child — palettes mirror the light/dark inversion in
// constants/ThemePalettes.ts.
const LIGHT = {
  bg: '#fafafa',
  text: '#0a0a0a',
  muted: '#737373',
  surface: '#e5e5e5',
  errorTitle: '#DC143C',
  errorText: '#171717',
  buttonBg: '#0a0a0a',
  buttonText: '#fafafa',
};
const DARK = {
  bg: '#0a0a0a',
  text: '#fafafa',
  muted: '#a3a3a3',
  surface: '#262626',
  errorTitle: '#DC143C',
  errorText: '#d4d4d4',
  buttonBg: '#fafafa',
  buttonText: '#0a0a0a',
};

function ErrorFallback({
  error,
  onRetry,
}: {
  error: Error | null;
  onRetry: () => void;
}) {
  const scheme = useColorScheme();
  const c = scheme === 'dark' ? DARK : LIGHT;

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: c.bg,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 24,
      }}
    >
      <View style={{ alignItems: 'center', maxWidth: 320 }}>
        <Text
          style={{
            fontSize: 24,
            fontWeight: '600',
            color: c.text,
            marginBottom: 12,
            textAlign: 'center',
          }}
        >
          Something went wrong
        </Text>
        <Text
          style={{
            fontSize: 16,
            color: c.muted,
            textAlign: 'center',
            marginBottom: 24,
            lineHeight: 24,
          }}
        >
          The app hit an unexpected error. Try again — if it keeps happening, restart the app.
        </Text>
        {__DEV__ && error && (
          <View
            style={{
              backgroundColor: c.surface,
              borderRadius: 8,
              padding: 12,
              marginBottom: 24,
              width: '100%',
            }}
          >
            <Text style={{ fontSize: 12, fontWeight: '600', color: c.errorTitle, marginBottom: 4 }}>
              Error details
            </Text>
            <Text style={{ fontSize: 12, color: c.errorText, fontFamily: 'monospace' }}>
              {error.message}
            </Text>
          </View>
        )}
        <Pressable
          onPress={onRetry}
          style={{
            backgroundColor: c.buttonBg,
            paddingHorizontal: 24,
            paddingVertical: 12,
            borderRadius: 8,
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: '600', color: c.buttonText }}>
            Try again
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error);
    console.error('Component stack:', errorInfo.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return <ErrorFallback error={this.state.error} onRetry={this.handleRetry} />;
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
