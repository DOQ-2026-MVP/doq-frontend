import RootRedirect from "../shared/lib/RootRedirect"
import { createBrowserRouter } from "react-router-dom"
import { ExportPage } from "@/pages/ExportPage"
import { InboxPage } from "@/pages/InboxPage"
import { InspectionDetailPage } from "@/pages/InspectionDetailPage"
import { IntakePage } from "@/pages/IntakePage"
import { Layout } from "@/widget/Layout"

export const router = createBrowserRouter(
    [
        {
            element: <Layout />,
            children: [
                {
                    path: "/",
                    element: <RootRedirect />,
                },
                {
                    path: "/intake",
                    element: <IntakePage />,
                },
                {
                    path: "/inbox",
                    element: <InboxPage />,
                },
                {
                    path: "/inspection/:id",
                    element: <InspectionDetailPage />,
                },
                {
                    path: "/export",
                    element: <ExportPage />,
                },
                {
                    path: "*",
                    element: <RootRedirect />,
                },
            ],
        },
    ],
    {
        basename: "/",
    }
)
