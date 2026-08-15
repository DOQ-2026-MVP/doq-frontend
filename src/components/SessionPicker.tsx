import { useMemo } from "react"
import { useIngestionSessions } from "@/apis/ingestion"
import { formatDateTime } from "@/shared/utils/format"

/** 세션 선택 드롭다운 — 구조화가 끝난 세션만 고를 수 있다(그 전엔 검수 대상이 없다). */
export function SessionPicker({
    ingestionId,
    onSelect,
}: {
    ingestionId: string | null
    onSelect: (ingestionId: string) => void
}) {
    const { data } = useIngestionSessions()
    const options = useMemo(
        () => (data ?? []).filter((session) => session.status === "STRUCTURED"),
        [data]
    )

    if (options.length === 0) return null

    return (
        <label className="flex items-center gap-2 text-sm text-gray-600">
            <span className="shrink-0">세션</span>
            <select
                value={ingestionId ?? ""}
                onChange={(event) => onSelect(event.target.value)}
                className="rounded-xl border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-100"
            >
                {options.map((session) => (
                    <option key={session.ingestionId} value={String(session.ingestionId)}>
                        {"등록 세션 #" + session.ingestionId + " · " + session.recordCount + "건 · " + formatDateTime(session.createdAt)}
                    </option>
                ))}
            </select>
        </label>
    )
}
