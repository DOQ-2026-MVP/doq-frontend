import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { CheckCircle2Icon, Loader2Icon, PlayIcon } from "lucide-react"
import type { IngestionStatus } from "@/shared/model/inspection"
import { useInspection } from "@/shared/context/useInspection"

interface StructuringPanelProps {
    ingestionId: string
    status: IngestionStatus
    showRawLink?: boolean
}

export function StructuringPanel({ ingestionId, status, showRawLink = false }: StructuringPanelProps) {
    const navigate = useNavigate()
    const { runStructuring, getSession } = useInspection()
    const [running, setRunning] = useState(false)
    const [done, setDone] = useState(false)

    const session = getSession(ingestionId)
    const inspectionId = session?.inspectionId ?? null
    const structured = status === "STRUCTURED"

    async function handleRun() {
        setRunning(true)
        setDone(false)
        await runStructuring(ingestionId)
        setRunning(false)
        setDone(true)
    }

    return (
        <div className="flex flex-wrap items-center gap-2">
            {showRawLink && (
                <button
                    type="button"
                    onClick={() => navigate("/ingestion/" + ingestionId)}
                    className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                    원본 행 확인
                </button>
            )}

            {!structured && (
                <button
                    type="button"
                    onClick={handleRun}
                    disabled={running}
                    className={
                        "inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold " +
                        (running
                            ? "cursor-not-allowed bg-gray-100 text-gray-400"
                            : "bg-blue-600 text-white hover:bg-blue-700")
                    }
                >
                    {running ? (
                        <Loader2Icon className="h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                        <PlayIcon className="h-4 w-4" aria-hidden="true" />
                    )}
                    구조화 실행
                </button>
            )}

            {running && (
                <span className="text-sm text-gray-600" role="status">
                    구조화 진행 중...
                </span>
            )}

            {structured && (
                <>
                    {done && (
                        <span className="inline-flex items-center gap-1.5 text-sm text-green-700" role="status">
                            <CheckCircle2Icon className="h-4 w-4" aria-hidden="true" />
                            구조화가 완료되었습니다.
                        </span>
                    )}
                    <button
                        type="button"
                        onClick={() => navigate(inspectionId ? "/inbox?inspectionId=" + inspectionId : "/inbox")}
                        className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                    >
                        검수 인박스로 이동
                    </button>
                </>
            )}
        </div>
    )
}
