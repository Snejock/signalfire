import { Route, Routes } from "react-router"
import { AppShell } from "@/components/layout/AppShell"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Company } from "@/pages/Company"
import { Dashboard } from "@/pages/Dashboard"
import { Home } from "@/pages/Home"

function App() {
  return (
    <TooltipProvider>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route element={<AppShell />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/company/:secId" element={<Company />} />
        </Route>
      </Routes>
    </TooltipProvider>
  )
}

export default App
