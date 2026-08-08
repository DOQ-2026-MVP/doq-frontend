import { AlertCircleIcon } from "lucide-react"

interface ConfirmDialogProps {
    open: boolean
    title: string
    description?: string
    confirmLabel: string
    onCancel: () => void
    onConfirm: () => void
}

export function ConfirmDialog({ open, title, description, confirmLabel, onCancel, onConfirm }: ConfirmDialogProps) {
    if (!open) return null

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 px-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-dialog-title"
        >
            <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-lg">
                <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-50">
                        <AlertCircleIcon className="h-4 w-4 text-blue-600" aria-hidden="true" />
                    </span>
                    <div>
                        <h2 id="confirm-dialog-title" className="text-sm font-semibold text-gray-900">
                            {title}
                        </h2>
                        {description && <p className="mt-1 text-sm text-gray-500">{description}</p>}
                    </div>
                </div>

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
                        className="rounded-xl bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    )
}
