import { NavLink, Outlet } from "react-router-dom"
import { DownloadIcon, InboxIcon, UploadIcon } from "lucide-react"

const NAV_ITEMS = [
    { to: "/intake", label: "인입", icon: UploadIcon },
    { to: "/inbox", label: "검수 인박스", icon: InboxIcon },
    { to: "/export", label: "Export", icon: DownloadIcon },
]

export function Layout() {
    return (
        <div className="flex min-h-full w-full flex-col bg-white">
            <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center border-b border-gray-200 bg-white px-4 md:px-6">
                <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-xs font-bold text-white">
                        검
                    </span>
                    <span className="text-sm font-semibold text-gray-900">구매 증빙 검증 인박스</span>
                </div>
                <span className="ml-3 hidden rounded-md bg-gray-100 px-2 py-0.5 text-xs text-gray-500 md:inline">
                    구매 검수 운영
                </span>
            </header>

            <div className="flex">
                <nav
                    aria-label="주요 메뉴"
                    className="fixed left-0 top-16 bottom-0 z-20 hidden w-56 overflow-y-auto border-r border-gray-200 bg-gray-50 p-3 md:block"
                >
                    <ul className="flex flex-col gap-1">
                        {NAV_ITEMS.map((item) => {
                            const Icon = item.icon

                            return (
                                <li key={item.to}>
                                    <NavLink
                                        to={item.to}
                                        className={({ isActive }) =>
                                            "flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors " +
                                            (isActive
                                                ? "bg-blue-50 text-blue-700"
                                                : "text-gray-600 hover:bg-gray-100 hover:text-gray-900")
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

                <main className="min-w-0 flex-1 md:ml-56">
                    <div className="px-4 py-6 md:px-8 md:py-8">
                        <Outlet />
                    </div>
                </main>
            </div>
        </div>
    )
}
