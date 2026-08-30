import { TrendingUp } from "lucide-react"
import { Link } from "react-router"
import { Button } from "@/components/ui/button"

export function Home() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 text-center">
      <TrendingUp className="size-12 text-primary" />
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Signalfire</h1>
        <p className="text-muted-foreground max-w-md">
          Дашборд котировок MOEX и рыночных новостей в реальном времени.
        </p>
      </div>
      <Button render={<Link to="/dashboard" />} size="lg">
        Открыть дашборд
      </Button>
    </div>
  )
}
