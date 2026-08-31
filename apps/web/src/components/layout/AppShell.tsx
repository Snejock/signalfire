import { LayoutDashboard, Menu, Settings, TrendingUp, User } from "lucide-react"
import { useLayoutEffect, useRef } from "react"
import { Link, Outlet, useLocation, useParams } from "react-router"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Separator } from "@/components/ui/separator"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { useCompanyName } from "@/lib/queries"

function AppSidebar() {
  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1.5">
          <TrendingUp className="size-5 text-primary" />
          <span className="font-semibold">Signalfire</span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton render={<Link to="/dashboard" />}>
                  <LayoutDashboard />
                  <span>Компании</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}

function AppBreadcrumb() {
  const { secId } = useParams<{ secId: string }>()
  // Резолв из уже загрученного кэша ['companies'] — без отдельного запроса под breadcrumb.
  const companyName = useCompanyName(secId)

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink render={<Link to="/dashboard" />}>Компании</BreadcrumbLink>
        </BreadcrumbItem>
        {secId && (
          <>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{companyName ?? secId}</BreadcrumbPage>
            </BreadcrumbItem>
          </>
        )}
      </BreadcrumbList>
    </Breadcrumb>
  )
}

// Пункты меню — touch target ~48px (py-3 + text-base), по стандарту Material Design
// (минимум 48dp) и с запасом над минимумом Apple HIG (44pt) — приложение mobile-first,
// в десктопе это меню не используется больше нигде.
// TODO: временное меню-заглушка — пункты декоративные, ни один пока никуда не ведёт.
function HeaderMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-lg"
            className="ml-auto size-11"
            aria-label="Меню"
          >
            <Menu className="size-5" />
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="min-w-56 p-1.5">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="px-3 py-2 text-sm">Меню</DropdownMenuLabel>
          <DropdownMenuSeparator className="my-1.5" />
          <DropdownMenuItem className="gap-3 px-3 py-3 text-base [&_svg:not([class*='size-'])]:size-5">
            <User />
            Профиль
          </DropdownMenuItem>
          <DropdownMenuItem className="gap-3 px-3 py-3 text-base [&_svg:not([class*='size-'])]:size-5">
            <Settings />
            Настройки
          </DropdownMenuItem>
          <DropdownMenuSeparator className="my-1.5" />
          <DropdownMenuItem className="gap-3 px-3 py-3 text-base [&_svg:not([class*='size-'])]:size-5">
            О сервисе
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function AppShell() {
  const { pathname } = useLocation()
  const scrollRef = useRef<HTMLDivElement>(null)

  // Сброс скролла контентной области при смене страницы.
  useLayoutEffect(() => {
    scrollRef.current?.scrollTo(0, 0)
  }, [pathname])

  return (
    // h-svh + overflow-hidden: скроллится не вся страница, а только div ниже (scrollRef).
    // Header остаётся в обычном потоке вне скролла — перекрыть его нечем.
    <SidebarProvider className="h-svh overflow-hidden">
      <AppSidebar />
      <SidebarInset>
        <header className="bg-background flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <AppBreadcrumb />
          <HeaderMenu />
        </header>
        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          {/* min-h-full + flex-col + flex-1 на контенте: если контента меньше высоты экрана,
              футер всё равно прижат к низу (а не "висит" сразу под коротким контентом); если
              контента больше — обычный поток, футер уезжает вниз вместе со скроллом. */}
          <div className="flex min-h-full flex-col">
            <div className="flex flex-1 flex-col gap-4 p-4">
              <Outlet />
            </div>
            <footer className="text-muted-foreground border-t px-4 py-3 text-xs">
              Графики:{" "}
              <a
                href="https://www.tradingview.com/"
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-2 hover:text-foreground"
              >
                Lightweight Charts™ by TradingView
              </a>
            </footer>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
