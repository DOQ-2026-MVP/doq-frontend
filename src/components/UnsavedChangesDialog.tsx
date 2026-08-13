import { AlertCircleIcon } from "lucide-react"

interface UnsavedChangesDialogProps {
    open: boolean
    onCancel: () => void
    onContinue: () => void
    onSave: () => void
}

export function UnsavedChangesDialog({ open, onCancel, onContinue, onSave }: UnsavedChangesDialogProps) {
    if (!open) return null

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 px-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="unsaved-dialog-title"
        >
            <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-lg">
                <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange-50">
                        <AlertCircleIcon className="h-4 w-4 text-orange-600" aria-hidden="true" />
                    </span>
                    <div>
                        <h2 id="unsaved-dialog-title" className="text-sm font-semibold text-gray-900">
                            저장되지 않은 변경사항이 있습니다.
                        </h2>
                        <p className="mt-1 text-sm text-gray-500">저장하지 않으면 수정한 내용이 사라집니다.</p>
                    </div>
                </div>

                <div className="mt-5 flex flex-wrap justify-end gap-2">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="rounded-xl border border-gray-300 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                        취소
                    </button>
                    <button
                        type="button"
                        onClick={onContinue}
                        className="rounded-xl border border-gray-300 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                        저장하지 않고 계속
                    </button>
                    <button
                        type="button"
                        onClick={onSave}
                        className="rounded-xl bg-primary px-3.5 py-2 text-sm font-semibold text-white hover:bg-primary-700"
                    >
                        저장하고 계속
                    </button>
                </div>
            </div>
        </div>
    )
}
