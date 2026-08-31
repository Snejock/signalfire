import { Search } from "lucide-react"
import { useState } from "react"
import { Link } from "react-router"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { useCompanies } from "@/lib/queries"
import type { Company } from "@/lib/types"

function CompanyCard({ company }: { company: Company }) {
  return (
    <Link to={`/company/${company.sec_id}`}>
      <Card className="transition-colors hover:bg-accent">
        <CardContent className="flex items-center gap-3">
          <Avatar>
            <AvatarFallback>{company.sec_id.slice(0, 2)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{company.name ?? company.sec_id}</p>
            <p className="text-muted-foreground text-xs">{company.board_id}</p>
          </div>
          <Badge variant="secondary">{company.sec_id}</Badge>
        </CardContent>
      </Card>
    </Link>
  )
}

// 0 — тикер или название начинаются с запроса, 1 — запрос встречается только внутри строки.
function matchRank(c: Company, normalizedQuery: string): number {
  const startsWith =
    c.sec_id.toLowerCase().startsWith(normalizedQuery) ||
    (c.name?.toLowerCase().startsWith(normalizedQuery) ?? false)
  return startsWith ? 0 : 1
}

function CompanyCardSkeleton() {
  return (
    <Card>
      <CardContent className="flex items-center gap-3">
        <Skeleton className="size-10 shrink-0 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      </CardContent>
    </Card>
  )
}

export function Dashboard() {
  const { data: companies, isPending, isError, error } = useCompanies()
  const [query, setQuery] = useState("")

  // Список компаний уже загружен целиком одним запросом (см. useCompanies) — фильтруем
  // на клиенте, без похода на бэкенд. Без запроса список вообще не показываем (тикеров
  // слишком много, чтобы листать их все) — только сам поиск.
  const normalizedQuery = query.trim().toLowerCase()
  const filteredCompanies = normalizedQuery
    ? companies
        ?.filter(
          (c) =>
            c.sec_id.toLowerCase().includes(normalizedQuery) ||
            c.name?.toLowerCase().includes(normalizedQuery)
        )
        // .filter() уже вернул новый массив — сортировка не мутирует кэш react-query.
        // Приоритет — совпадениям в начале тикера/названия (AFLT раньше SNAFLT по "afl"),
        // .sort() в JS стабилен, так что порядок внутри каждой группы не скачет между рендерами.
        .sort((a, b) => matchRank(a, normalizedQuery) - matchRank(b, normalizedQuery))
    : undefined

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Компании</h1>

      <div className="relative">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Поиск по тикеру или названию…"
          className="pl-8"
        />
      </div>

      {isError && (
        <p className="text-muted-foreground text-sm">
          Не удалось загрузить список компаний: {error instanceof Error ? error.message : "неизвестная ошибка"}
        </p>
      )}

      {!normalizedQuery && !isError && (
        <p className="text-muted-foreground text-sm">Начните вводить тикер или название компании.</p>
      )}

      {normalizedQuery && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {isPending &&
            Array.from({ length: 4 }).map((_, i) => <CompanyCardSkeleton key={i} />)}

          {filteredCompanies?.map((company) => (
            <CompanyCard key={`${company.sec_id}-${company.board_id}`} company={company} />
          ))}

          {!isPending && filteredCompanies?.length === 0 && (
            <p className="text-muted-foreground col-span-full text-sm">Ничего не найдено.</p>
          )}
        </div>
      )}
    </div>
  )
}
