import { Component, type ReactNode } from "react"

interface ErrorBoundaryProps {
  children: ReactNode
  fallback: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
}

/**
 * React не даёт хук-API для error boundary — только class-компонент. Используется вокруг
 * CandlestickChart: сторонняя библиотека рисует в canvas в эффекте, и её падение не должно
 * рушить всю страницу (см. candlestick-chart.tsx — уже был реальный такой случай с oklch()).
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) return this.props.fallback
    return this.props.children
  }
}
