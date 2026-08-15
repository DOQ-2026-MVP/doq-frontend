import { useEffect } from "react"
import { useSearchParams } from "react-router-dom"
import { useStructuredIngestionIds } from "@/apis/ingestion"

/**
 * 검수·내보내기가 다루는 세션을 URL(`?ingestionId=`)에 둔다.
 *
 * 화면 상태로 들고 있으면 새로고침·링크 공유에서 잃는다. 지정이 없으면 구조화가 끝난 세션 중
 * 가장 최근 것으로 맞춰준다(등록 직후 곧바로 검수로 넘어오는 흐름이 가장 흔하다).
 */
export function useSelectedIngestionId() {
    const [searchParams, setSearchParams] = useSearchParams()
    const { ids, isLoading, isError } = useStructuredIngestionIds()
    const param = searchParams.get("ingestionId")

    // 지정이 없거나 구조화된 세션이 아니면(삭제·오타) 최근 세션으로 되돌린다.
    const resolved = param !== null && ids.includes(param) ? param : (ids[ids.length - 1] ?? null)

    useEffect(() => {
        if (isLoading || resolved === null || param === resolved) return
        setSearchParams((prev) => {
            const next = new URLSearchParams(prev)
            next.set("ingestionId", resolved)
            return next
        }, { replace: true })
    }, [isLoading, resolved, param, setSearchParams])

    const select = (ingestionId: string) =>
        setSearchParams((prev) => {
            const next = new URLSearchParams(prev)
            next.set("ingestionId", ingestionId)
            return next
        })

    return { ingestionId: resolved, select, ids, isLoading, isError }
}
