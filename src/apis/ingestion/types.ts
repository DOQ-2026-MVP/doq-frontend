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
    status: "DRAFT" | "STRUCTURED" | "FAILED"
    uploads: IngestionUpload[]
    /** 수기로 넣은 행들. 파일에서 나온 행은 담기지 않는다(파일은 업로드 단위로 보여준다). */
    manuals?: IngestionRecord[]
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
