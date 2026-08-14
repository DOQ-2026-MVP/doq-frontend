import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import * as React from "react"
import { ApiHelper, type ApiEnvelope, unwrap } from "@/shared/api/api.base"
import { API_PATH } from "@/shared/api/api.path"
import type { IngestionDetail, IngestionRecord } from "./types"

type IngestionState = IngestionDetail

export const postUpload = (file: File) => {
    const form = new FormData()
    form.append("file", file)
    return unwrap(
        ApiHelper.post<ApiEnvelope<IngestionState>>(API_PATH.INGESTION.UPLOADS(), form, {
            headers: { "Content-Type": "multipart/form-data" },
        })
    )
}

export const postUploadFor = (ingestionId: number | string, file: File) => {
    const form = new FormData()
    form.append("file", file)
    return unwrap(
        ApiHelper.post<ApiEnvelope<IngestionState>>(API_PATH.INGESTION.UPLOADS_FOR(ingestionId), form, {
            headers: { "Content-Type": "multipart/form-data" },
        })
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
    return (useQuery as any)({
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

export function useIngestionEvents(ingestionId?: number | string, onMessage?: (ev: MessageEvent) => void) {
    // lightweight SSE hook: returns an EventSource instance or null
    const [es, setEs] = React.useState<EventSource | null>(null)
    React.useEffect(() => {
        if (!ingestionId) return
        const base = `${import.meta.env.VITE_API_BASE_URL}`
        const url = base + API_PATH.INGESTION.INGESTION_EVENTS(ingestionId)
        const s = new EventSource(url)
        const handler = (ev: MessageEvent) => onMessage?.(ev)
        s.addEventListener("message", handler)
        setEs(s)
        return () => {
            s.removeEventListener("message", handler)
            s.close()
            setEs(null)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ingestionId])
    return es
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
