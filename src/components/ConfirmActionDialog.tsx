interface ConfirmActionDialogProps {
    open: boolean
    title: string
    description: string
    confirmLabel: string
    tone?: "primary" | "danger"
    onCancel: () => void
    onConfirm: () => void
}

/**
 * 승인·반려·재검토 확인 창.
 *
 * 메모 입력칸이 없다 — 검수 상태를 바꾸는 세 API 는 모두 경로 변수만 받고 바디를 읽지 않는다.
 * 예전엔 여기서 메모를 받아 보냈지만 서버가 통째로 버리고 있었다. 메모는 편집(PATCH)이 들고 간다.
 */
export function ConfirmActionDialog({
    open,
    title,
    description,
    confirmLabel,
    tone = "primary",
    onCancel,
    onConfirm,
}: ConfirmActionDialogProps) {
    if (!open) return null

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 px-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-dialog-title"
        >
            <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-lg">
                <h2 id="confirm-dialog-title" className="text-sm font-semibold text-gray-900">
                    {title}
                </h2>
                <p className="mt-1 text-sm text-gray-500">{description}</p>

                <div className="mt-5 flex justify-end gap-2">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="rounded-xl border border-gray-300 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                        취소
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        className={
                            "rounded-xl px-3.5 py-2 text-sm font-semibold text-white " +
                            (tone === "danger" ? "bg-red-600 hover:bg-red-700" : "bg-primary hover:bg-primary-700")
                        }
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    )
}
