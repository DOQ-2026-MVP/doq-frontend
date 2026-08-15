import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import { PAGE_SIZE, pageSliceOf, totalPagesOf } from "@/shared/lib/paging"

interface PaginationProps {
    page: number
    totalCount: number
    onChange: (page: number) => void
    pageSize?: number
}

export function Pagination({ page, totalCount, onChange, pageSize = PAGE_SIZE }: PaginationProps) {
    const totalPages = totalPagesOf(totalCount, pageSize)
    if (totalPages <= 1) return null

    const { start } = pageSliceOf(page, pageSize)
    const from = totalCount === 0 ? 0 : start + 1
    const to = Math.min(start + pageSize, totalCount)

    // 현재 페이지 주변만 — 페이지가 많아도 버튼 줄이 넘치지 않는다.
    const windowStart = Math.max(1, Math.min(page - 2, totalPages - 4))
    const pages = Array.from({ length: Math.min(5, totalPages) }, (_, index) => windowStart + index)

    const buttonClass = (active: boolean) =>
        "min-w-8 rounded-lg px-2 py-1 text-xs font-medium " +
        (active ? "bg-primary text-white" : "border border-gray-300 bg-white text-gray-700 hover:bg-surface")

    return (
        <nav
            aria-label="페이지 이동"
            className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 px-5 py-3"
        >
            <p className="text-xs text-gray-500">
                {totalCount}건 중 {from}–{to}
            </p>
            <div className="flex items-center gap-1">
                <button
                    type="button"
                    onClick={() => onChange(page - 1)}
                    disabled={page <= 1}
                    aria-label="이전 페이지"
                    className={
                        "rounded-lg border border-gray-300 bg-white p-1.5 text-gray-600 " +
                        (page <= 1 ? "cursor-not-allowed opacity-40" : "hover:bg-surface")
                    }
                >
                    <ChevronLeftIcon className="h-4 w-4" aria-hidden="true" />
                </button>
                {pages.map((item) => (
                    <button
                        key={item}
                        type="button"
                        onClick={() => onChange(item)}
                        aria-current={item === page ? "page" : undefined}
                        className={buttonClass(item === page)}
                    >
                        {item}
                    </button>
                ))}
                <button
                    type="button"
                    onClick={() => onChange(page + 1)}
                    disabled={page >= totalPages}
                    aria-label="다음 페이지"
                    className={
                        "rounded-lg border border-gray-300 bg-white p-1.5 text-gray-600 " +
                        (page >= totalPages ? "cursor-not-allowed opacity-40" : "hover:bg-surface")
                    }
                >
                    <ChevronRightIcon className="h-4 w-4" aria-hidden="true" />
                </button>
            </div>
        </nav>
    )
}
