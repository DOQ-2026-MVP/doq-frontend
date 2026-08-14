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

export type IngestionRecord = {
    id: number
    uploadId: number | null
    uploadType: string | null
    uploadRowNo: number | null
    content: Record<string, string | null>
    createdAt: string
}
