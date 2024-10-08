import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter as Router } from "react-router-dom";
import { LocaleProvider } from "@src/_locales";
import { ConfigModeProvider } from "./context/configMode.tsx";
import { SnackbarProvider } from "./context/snackbar.tsx";
import RegComponent from "./Reg.tsx";
import "./index.css";

const root = ReactDOM.createRoot(document.getElementById("root"));

root.render(
  <React.StrictMode>
    <Router>
      <LocaleProvider>
        <SnackbarProvider>
          <ConfigModeProvider>
            <RegComponent />
          </ConfigModeProvider>
        </SnackbarProvider>
      </LocaleProvider>
    </Router>
  </React.StrictMode>
);
