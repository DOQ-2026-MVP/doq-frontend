import { useCallback, useEffect } from "react"
import { useSearchParams } from "react-router-dom"
import { useStructuredIngestionIds } from "@/apis/ingestion"

/** 마지막으로 보던 세션 — 화면을 옮겨도 따라오게 하는 용도. 세션의 내용은 서버가 안다. */
const LAST_SESSION_KEY = "doq.lastIngestionId"

const readLastSession = (): string | null => {
    try {
        return window.localStorage.getItem(LAST_SESSION_KEY)
    } catch {
        return null
    }
}

export const rememberIngestionId = (ingestionId: string) => writeLastSession(ingestionId)

const writeLastSession = (ingestionId: string) => {
    try {
        window.localStorage.setItem(LAST_SESSION_KEY, ingestionId)
    } catch {
        // 저장 실패는 치명적이지 않다 — 이번 세션 동안만 기억하지 못할 뿐이다.
    }
}

/**
 * 등록·검수·내보내기가 **같은 세션**을 보게 한다.
 *
 * 대상 세션은 URL(`?ingestionId=`)에 둔다 — 새로고침·링크 공유에서 잃지 않기 위해서다.
 * 다만 좌측 메뉴로 화면을 옮기면 쿼리가 떨어져 나가므로, 마지막으로 고른 세션을 따로 기억해
 * 지정이 없을 때 이어붙인다. 그것도 없으면 구조화가 끝난 세션 중 가장 최근 것으로 맞춘다.
 */
export function useSelectedIngestionId() {
    const [searchParams, setSearchParams] = useSearchParams()
    const { ids, isLoading, isError } = useStructuredIngestionIds()
    const param = searchParams.get("ingestionId")

    // URL 지정 → 마지막으로 보던 세션 → 최근 세션. 없는 세션(삭제·오타)은 건너뛴다.
    const remembered = readLastSession()
    const resolved =
        param !== null && ids.includes(param)
            ? param
            : remembered !== null && ids.includes(remembered)
              ? remembered
              : (ids[ids.length - 1] ?? null)

    useEffect(() => {
        if (resolved === null) return
        writeLastSession(resolved)
    }, [resolved])

    // URL 이 비어 있거나 어긋나면 해석된 세션으로 맞춘다(뒤로 가기 이력은 더럽히지 않는다).
    useEffect(() => {
        if (isLoading || resolved === null || param === resolved) return
        setSearchParams(
            (prev) => {
                const next = new URLSearchParams(prev)
                next.set("ingestionId", resolved)
                return next
            },
            { replace: true }
        )
    }, [isLoading, resolved, param, setSearchParams])

    const select = useCallback(
        (ingestionId: string) => {
            writeLastSession(ingestionId)
            setSearchParams((prev) => {
                const next = new URLSearchParams(prev)
                next.set("ingestionId", ingestionId)
                return next
            })
        },
        [setSearchParams]
    )

    return { ingestionId: resolved, select, ids, isLoading, isError }
}
