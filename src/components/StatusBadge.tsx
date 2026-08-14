import type { RecordStatus, IngestionStatus } from "@/shared/model/inspection"

export const RECORD_STATUS_LABEL: Record<RecordStatus, string> = {
    NEW: "신규",
    NEEDS_CHECK: "확인 필요",
    NEEDS_HOLD: "보류 필요",
    APPROVABLE: "승인 가능",
    APPROVED: "승인",
    REJECTED: "반려",
}

const RECORD_STATUS_STYLE: Record<RecordStatus, string> = {
    NEW: "bg-[#EDE9FE] text-[#6D28D9] ring-[#DDD6FE]",
    NEEDS_CHECK: "bg-orange-50 text-orange-700 ring-orange-200",
    NEEDS_HOLD: "bg-yellow-50 text-yellow-700 ring-yellow-200",
    APPROVABLE: "bg-blue-50 text-blue-700 ring-blue-200",
    APPROVED: "bg-green-50 text-green-700 ring-green-200",
    REJECTED: "bg-red-50 text-red-700 ring-red-200",
}

export const INGESTION_STATUS_LABEL: Record<IngestionStatus, string> = {
    DRAFT: "작성 중",
    STRUCTURING: "처리 중",
    STRUCTURED: "완료",
}

const INGESTION_STATUS_STYLE: Record<IngestionStatus, string> = {
    DRAFT: "bg-gray-100 text-gray-700 ring-gray-200",
    STRUCTURING: "bg-orange-50 text-orange-700 ring-orange-200",
    STRUCTURED: "bg-green-50 text-green-700 ring-green-200",
}

const BASE = "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset "

export function StatusBadge({ status }: { status: RecordStatus }) {
    return <span className={BASE + RECORD_STATUS_STYLE[status]}>{RECORD_STATUS_LABEL[status]}</span>
}

export function IngestionStatusBadge({ status }: { status: IngestionStatus }) {
    return <span className={BASE + INGESTION_STATUS_STYLE[status]}>{INGESTION_STATUS_LABEL[status]}</span>
}
