import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import * as React from "react"
import { ApiHelper, type ApiEnvelope, unwrap } from "@/shared/api/api.base"
import { API_PATH } from "@/shared/api/api.path"
import type { IngestionDetail, IngestionRecord, IngestionSessionSummary } from "./types"

type IngestionState = IngestionDetail

/** 전체 세션 목록 (최근 것부터). 세션 목록의 출처는 서버다 — 브라우저 저장소가 아니다. */
export const getSessions = () =>
    unwrap(ApiHelper.get<ApiEnvelope<IngestionSessionSummary[]>>(API_PATH.INGESTION.SESSIONS()))

export function useIngestionSessions() {
    return useQuery({
        queryKey: ["ingestion", "sessions"],
        queryFn: getSessions,
    })
}

/** 구조화 완료된 세션의 ingestionId 목록 — 검수·내보내기가 대상 세션을 고를 때 쓴다. */
export function useStructuredIngestionIds() {
    const query = useIngestionSessions()
    const ids = React.useMemo(
        () => (query.data ?? []).filter((s) => s.status === "STRUCTURED").map((s) => String(s.ingestionId)),
        [query.data]
    )
    return { ...query, ids }
}

/** 전송 진행률(0~100) — 서버가 받기까지의 몫이다. 이후 파싱 진행은 현황 스트림이 알려준다. */
export type UploadProgress = (percent: number) => void

const uploadConfig = (onProgress?: UploadProgress) => ({
    headers: { "Content-Type": "multipart/form-data" },
    onUploadProgress: onProgress
        ? (event: { loaded: number; total?: number }) => {
              if (!event.total) return
              onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)))
          }
        : undefined,
})

export const postUpload = (file: File, onProgress?: UploadProgress) => {
    const form = new FormData()
    form.append("file", file)
    return unwrap(
        ApiHelper.post<ApiEnvelope<IngestionState>>(API_PATH.INGESTION.UPLOADS(), form, uploadConfig(onProgress))
    )
}

export const postUploadFor = (ingestionId: number | string, file: File, onProgress?: UploadProgress) => {
    const form = new FormData()
    form.append("file", file)
    return unwrap(
        ApiHelper.post<ApiEnvelope<IngestionState>>(
            API_PATH.INGESTION.UPLOADS_FOR(ingestionId),
            form,
            uploadConfig(onProgress)
        )
    )
}

export const getUploadContent = (ingestionId: number | string, uploadId: number | string) =>
    ApiHelper.get<Blob>(API_PATH.INGESTION.UPLOAD_CONTENT(ingestionId, uploadId), { responseType: "blob" as const })

export const deleteUpload = (ingestionId: number | string, uploadId: number | string) =>
    unwrap(ApiHelper.delete<ApiEnvelope<IngestionState>>(API_PATH.INGESTION.UPLOAD_DELETE(ingestionId, uploadId)))

export const postRecords = (ingestionId: number | string, body: unknown[]) =>
    unwrap(ApiHelper.post<ApiEnvelope<IngestionState>>(API_PATH.INGESTION.RECORDS_FOR(ingestionId), body))

export const getRecordsFor = async (ingestionId: number | string): Promise<IngestionRecord[]> => {
    try {
        return await unwrap(ApiHelper.get<ApiEnvelope<IngestionRecord[]>>(API_PATH.INGESTION.RECORDS_FOR(ingestionId)))
    } catch (e: any) {
        if (e?.response?.status === 404) return []
        throw e
    }
}

export const putRecord = (ingestionId: number | string, recordId: number | string, body: unknown) =>
    unwrap(ApiHelper.put<ApiEnvelope<unknown>>(API_PATH.INGESTION.RECORD_PUT(ingestionId, recordId), body))

export const deleteRecordsAll = (ingestionId: number | string) =>
    unwrap(ApiHelper.delete<ApiEnvelope<IngestionState>>(API_PATH.INGESTION.RECORDS_DELETE_ALL(ingestionId)))

export const getIngestionDetail = async (ingestionId: number | string) => {
    try {
        return await unwrap(ApiHelper.get<ApiEnvelope<IngestionDetail>>(API_PATH.INGESTION.INGESTION_DETAIL(ingestionId)))
    } catch (e: any) {
        if (e?.response?.status === 404) return null
        throw e
    }
}

// Global records endpoint (no ingestionId in path)
export const postRecordsGlobal = (body: unknown[]) =>
    unwrap(ApiHelper.post<ApiEnvelope<IngestionState>>(API_PATH.INGESTION.RECORDS_GLOBAL(), body))

export const deleteRecord = (ingestionId: number | string, recordId: number | string) =>
    unwrap(ApiHelper.delete<ApiEnvelope<IngestionState>>(API_PATH.INGESTION.RECORD_DELETE(ingestionId, recordId)))

// SSE events are consumed by EventSource directly in hook below

export function useIngestionDetail(ingestionId?: number | string) {
    return useQuery({
        queryKey: ["ingestion", ingestionId],
        queryFn: () => getIngestionDetail(ingestionId as string),
        enabled: !!ingestionId,
    })
}

export function useUpload() {
    const qc = useQueryClient()
    return (useMutation as any)({
        mutationFn: (file: File) => postUpload(file),
        onSettled: () => qc.invalidateQueries({ queryKey: ["ingestion"] }),
    })
}

export function useUploadFor() {
    const qc = useQueryClient()
    return (useMutation as any)({
        mutationFn: ({ ingestionId, file }: { ingestionId: number | string; file: File }) =>
            postUploadFor(ingestionId, file),
        onSettled: () => qc.invalidateQueries({ queryKey: ["ingestion"] }),
    })
}

export function useUploadContent() {
    return (useMutation as any)({
        mutationFn: ({ ingestionId, uploadId }: { ingestionId: number | string; uploadId: number | string }) =>
            getUploadContent(ingestionId, uploadId),
    })
}

export function useDeleteUpload() {
    const qc = useQueryClient()
    return (useMutation as any)({
        mutationFn: ({ ingestionId, uploadId }: { ingestionId: number | string; uploadId: number | string }) =>
            deleteUpload(ingestionId, uploadId),
        onSettled: () => qc.invalidateQueries({ queryKey: ["ingestion"] }),
    })
}

export function usePostRecords() {
    const qc = useQueryClient()
    return (useMutation as any)({
        mutationFn: ({ ingestionId, body }: { ingestionId: number | string; body: unknown[] }) =>
            postRecords(ingestionId, body),
        onSettled: () => qc.invalidateQueries({ queryKey: ["ingestion"] }),
    })
}

export function usePostRecordsGlobal() {
    const qc = useQueryClient()
    return (useMutation as any)({
        mutationFn: (body: unknown[]) => postRecordsGlobal(body),
        onSettled: () => qc.invalidateQueries({ queryKey: ["ingestion"] }),
    })
}

export function useDeleteRecord() {
    const qc = useQueryClient()
    return (useMutation as any)({
        mutationFn: ({ ingestionId, recordId }: { ingestionId: number | string; recordId: number | string }) =>
            deleteRecord(ingestionId, recordId),
        onSettled: () => qc.invalidateQueries({ queryKey: ["ingestion"] }),
    })
}

/**
 * 세션 현황 실시간 구독 (SSE).
 *
 * 서버는 `event: state` 로 **이름 붙은** 이벤트를 보낸다 — 기본 `message` 리스너로는 잡히지 않는다.
 * 매 이벤트에 그 시점 현황 전체가 실려 오므로 받은 것을 그대로 캐시에 넣는다(되물어볼 필요가 없다).
 */
export function useIngestionEvents(ingestionId?: number | string) {
    const qc = useQueryClient()

    React.useEffect(() => {
        if (!ingestionId) return
        const base = `${import.meta.env.VITE_API_BASE_URL}`
        const source = new EventSource(base + API_PATH.INGESTION.INGESTION_EVENTS(ingestionId))

        const handler = (event: MessageEvent) => {
            try {
                const payload = JSON.parse(event.data) as { state?: IngestionState }
                if (payload.state) qc.setQueryData(["ingestion", ingestionId], payload.state)
            } catch {
                // 형식이 바뀌었더라도 다시 읽어오면 화면은 맞는다.
                qc.invalidateQueries({ queryKey: ["ingestion", ingestionId] })
            }
            // 행 수·세션 상태가 바뀌었을 수 있다 — 목록과 원본 행은 따로 다시 읽는다.
            qc.invalidateQueries({ queryKey: ["ingestion", "sessions"] })
            qc.invalidateQueries({ queryKey: ["ingestion", ingestionId, "records"] })
        }

        source.addEventListener("state", handler)
        return () => {
            source.removeEventListener("state", handler)
            source.close()
        }
    }, [ingestionId, qc])
}

export function useGetRecordsFor(ingestionId?: number | string) {
    return useQuery({
        queryKey: ["ingestion", ingestionId, "records"],
        queryFn: () => getRecordsFor(ingestionId as string),
        enabled: !!ingestionId,
    })
}

export function usePutRecord() {
    const qc = useQueryClient()
    return (useMutation as any)({
        mutationFn: ({
            ingestionId,
            recordId,
            body,
        }: {
            ingestionId: number | string
            recordId: number | string
            body: unknown
        }) => putRecord(ingestionId, recordId, body),
        onSettled: () => qc.invalidateQueries({ queryKey: ["ingestion"] }),
    })
}

export function useDeleteRecordsAll() {
    const qc = useQueryClient()
    return (useMutation as any)({
        mutationFn: (ingestionId: number | string) => deleteRecordsAll(ingestionId),
        onSettled: () => qc.invalidateQueries({ queryKey: ["ingestion"] }),
    })
}

export default {
    getSessions,
    useIngestionSessions,
    useStructuredIngestionIds,
    postUpload,
    postUploadFor,
    getUploadContent,
    deleteUpload,
    postRecords,
    getRecordsFor,
    putRecord,
    deleteRecordsAll,
    getIngestionDetail,
    useIngestionDetail,
    useUpload,
    useUploadFor,
    useUploadContent,
    useDeleteUpload,
    usePostRecords,
    useGetRecordsFor,
    usePutRecord,
    useDeleteRecordsAll,
}
