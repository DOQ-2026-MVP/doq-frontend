import TestPage from "@/pages/test/TestPage";
import { createBrowserRouter } from "react-router-dom";
import RootRedirect from "../shared/lib/RootRedirect";

export const router = createBrowserRouter(
  [
    {
      path: "/",
      element: <RootRedirect />,
    },
    {
      path: "/home",
      element: <TestPage />,
    },
  ],
  {
    basename: "/",
  },
);
