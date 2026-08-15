export type IngestionUpload = {
    id: number
    type: string
    status: string
    fileName: string
    contentType?: string
    size?: number
    failureReason?: string
    createdAt?: string
}

export type IngestionDetail = {
    ingestionId: number | string
    status: string
    uploads: IngestionUpload[]
    manuals?: any[]
}

/** 세션 목록 한 줄 — 서버가 돌려주는 세션 요약. 업로드·행 내용은 없다. */
export type IngestionSessionSummary = {
    ingestionId: number
    status: "DRAFT" | "STRUCTURED" | "FAILED"
    uploadCount: number
    recordCount: number
    createdAt: string
}

export type IngestionRecord = {
    id: number
    uploadId: number | null
    uploadType: string | null
    uploadRowNo: number | null
    content: Record<string, string | null>
    createdAt: string
}
