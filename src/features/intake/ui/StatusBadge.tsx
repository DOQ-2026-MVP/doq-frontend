import type { RecordStatus, IngestionStatus } from "@/shared/model/inspection"

export const RECORD_STATUS_LABEL: Record<RecordStatus, string> = {
    NEW: "신규",
    CONFIRMED: "확정",
    REJECTED: "반려",
}

const RECORD_STATUS_STYLE: Record<RecordStatus, string> = {
    NEW: "bg-gray-100 text-gray-700 ring-gray-200",
    CONFIRMED: "bg-green-50 text-green-700 ring-green-200",
    REJECTED: "bg-red-50 text-red-700 ring-red-200",
}

export const INGESTION_STATUS_LABEL: Record<IngestionStatus, string> = {
    DRAFT: "작성 중",
    STRUCTURING: "구조화 진행 중",
    STRUCTURED: "구조화 완료",
}

const INGESTION_STATUS_STYLE: Record<IngestionStatus, string> = {
    DRAFT: "bg-gray-100 text-gray-700 ring-gray-200",
    STRUCTURING: "bg-orange-50 text-orange-700 ring-orange-200",
    STRUCTURED: "bg-blue-50 text-blue-700 ring-blue-200",
}

const BASE = "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset "

export function StatusBadge({ status }: { status: RecordStatus }) {
    return <span className={BASE + RECORD_STATUS_STYLE[status]}>{RECORD_STATUS_LABEL[status]}</span>
}

export function IngestionStatusBadge({ status }: { status: IngestionStatus }) {
    return <span className={BASE + INGESTION_STATUS_STYLE[status]}>{INGESTION_STATUS_LABEL[status]}</span>
}
