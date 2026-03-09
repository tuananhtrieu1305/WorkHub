import { createBrowserRouter } from "react-router-dom";
import App from "../App";
import Test from "../modules/auth/Test";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      {
        index: true,
        element: <Test />,
      },
    ],
  },
]);
