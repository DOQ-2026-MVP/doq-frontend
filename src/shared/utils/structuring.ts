import type { ExceptionFlag, RecordStatus } from "../model/inspection"

/**
 * 예외 플래그에 따른 검수 대기 상태.
 *
 * 예외 판정 자체는 백엔드가 한다 — 여기서 다시 규칙을 세우면 두 벌이 어긋난다.
 * 명세(exception-rules §복수 플래그): `missing_required` 가 하나라도 있으면 `확인 필요`
 * (보완 전 승인 차단), 나머지 예외는 종류·개수와 무관하게 전부 `보류 필요`,
 * 예외가 없으면 `승인 가능`.
 */
function pendingStatus(flags: ExceptionFlag[]): RecordStatus {
    if (flags.length === 0) return "APPROVABLE"
    if (flags.includes("MISSING_REQUIRED")) return "NEEDS_CHECK"
    return "NEEDS_HOLD"
}

/**
 * 실제 백엔드 status(NEW/CONFIRMED/REJECTED)를 화면용 세분화 상태로 매핑한다.
 * NEW는 아직 확정 전이라 탐지된 flags로 검토 우선순위를 세분화해서 보여준다.
 */
export function deriveDisplayStatus(backendStatus: string, flags: ExceptionFlag[]): RecordStatus {
    if (backendStatus === "CONFIRMED") return "APPROVED"
    if (backendStatus === "REJECTED") return "REJECTED"
    return pendingStatus(flags)
}
