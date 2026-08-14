import { useMutation, useQueryClient } from "@tanstack/react-query"
import { ApiHelper, type ApiEnvelope, unwrap } from "@/shared/api/api.base"
import { API_PATH } from "@/shared/api/api.path"
import type { StructuringResult } from "./types"

export const postRunStructuring = (ingestionId: number | string) =>
    unwrap(ApiHelper.post<ApiEnvelope<StructuringResult>>(API_PATH.STRUCTURING.RUN(ingestionId)))

export function useRunStructuring() {
    const qc = useQueryClient()
    return (useMutation as any)({
        mutationFn: (ingestionId: number | string) => postRunStructuring(ingestionId),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["ingestion"] }),
    })
}

export default { postRunStructuring, useRunStructuring }
