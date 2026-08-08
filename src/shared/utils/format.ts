export function formatPrice(value: string): string {
    if (!value || value.trim() === "") return "-"
    const numeric = Number(value.replace(/,/g, ""))
    if (Number.isNaN(numeric)) return value
    return numeric.toLocaleString("ko-KR") + "원"
}

export function formatText(value: string): string {
    return value && value.trim() !== "" ? value : "-"
}

export function formatDateTime(iso: string): string {
    const date = new Date(iso)
    if (Number.isNaN(date.getTime())) return iso
    const pad = (n: number) => String(n).padStart(2, "0")
    return (
        date.getFullYear() +
        "-" +
        pad(date.getMonth() + 1) +
        "-" +
        pad(date.getDate()) +
        " " +
        pad(date.getHours()) +
        ":" +
        pad(date.getMinutes())
    )
}
