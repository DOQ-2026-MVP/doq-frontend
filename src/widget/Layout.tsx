import { NavLink, Outlet } from "react-router-dom"
import { DownloadIcon, InboxIcon, UploadIcon } from "lucide-react"

const NAV_ITEMS = [
    { to: "/intake", label: "등록", icon: UploadIcon },
    { to: "/inbox", label: "검수 목록", icon: InboxIcon },
    { to: "/export", label: "내보내기", icon: DownloadIcon },
]

export function Layout() {
    return (
        <div className="flex min-h-full w-full flex-col bg-surface">
            <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center border-b border-gray-200 bg-white px-4 md:px-6">
                <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-xs font-bold text-gold">
                        C
                    </span>
                    <span className="text-sm font-semibold text-gray-900">ComfoziAI 구매 증빙 인박스</span>
                </div>
            </header>

            <div className="flex min-h-0 flex-1 flex-col md:flex-row">
                <nav
                    aria-label="주요 메뉴"
                    className="shrink-0 border-b border-gray-200 bg-white p-3 md:w-56 md:border-b-0 md:border-r"
                >
                    <ul className="flex gap-2 md:flex-col md:gap-1">
                        {NAV_ITEMS.map((item) => {
                            const Icon = item.icon
                            return (
                                <li key={item.to} className="flex-1 md:flex-none">
                                    <NavLink
                                        to={item.to}
                                        className={({ isActive }) =>
                                            "flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors md:justify-start " +
                                            (isActive
                                                ? "bg-primary-50 text-primary"
                                                : "text-gray-600 hover:bg-surface hover:text-gray-900")
                                        }
                                    >
                                        <Icon className="h-4 w-4" aria-hidden="true" />
                                        {item.label}
                                    </NavLink>
                                </li>
                            )
                        })}
                    </ul>
                </nav>

                <main className="min-w-0 flex-1 px-4 py-6 md:px-8 md:py-8">
                    <Outlet />
                </main>
            </div>
        </div>
    )
}
