import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import { BrowserRouter } from "react-router-dom";
import "antd/dist/reset.css";
import "./index.css";
import App from "./App";
import { store } from "./app/store.ts";
import { configureApiAuthentication } from "./config/apiConfig";
import { registerSessionRestoreGuard } from "./app/sessionLifecycle";

configureApiAuthentication(() => store.getState().app.token);
registerSessionRestoreGuard(() => window.location.replace("/"));

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Provider store={store}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </Provider>
  </StrictMode>,
);
