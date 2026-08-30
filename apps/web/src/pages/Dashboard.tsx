import { Link } from "react-router"
import { NewsFeed } from "@/components/news-feed"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
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

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <h1 className="text-2xl font-semibold tracking-tight">Компании</h1>

        {isError && (
          <p className="text-muted-foreground text-sm">
            Не удалось загрузить список компаний: {error instanceof Error ? error.message : "неизвестная ошибка"}
          </p>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {isPending &&
            Array.from({ length: 8 }).map((_, i) => <CompanyCardSkeleton key={i} />)}

          {companies?.map((company) => (
            <CompanyCard key={`${company.sec_id}-${company.board_id}`} company={company} />
          ))}

          {companies && companies.length === 0 && (
            <p className="text-muted-foreground col-span-full text-sm">Нет данных по компаниям.</p>
          )}
        </div>
      </div>

      <div>
        <NewsFeed />
      </div>
    </div>
  )
}
