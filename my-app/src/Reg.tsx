import React, { useEffect, useState } from "react";
import { Routes, Route, useLocation, useNavigate } from "react-router-dom";
import { Box, CircularProgress } from "@mui/material";
import "./App.css";
import { createClient } from "signify-polaris-web";
import { regService } from "./services/reg-server.ts";
import { useConfigMode } from "@context/configMode.tsx";
import { useSnackbar } from "@context/snackbar.tsx";
import { ErrorMessages } from "@services/constants.ts";
import ExtNotFound from "./components/ext-not-found.tsx";
import AppLayout from "./pages/app-layout.tsx";
import HomePage from "./pages/home.tsx";
import ReportsPage from "./pages/reports.tsx";
import StatusPage from "./pages/status.tsx";
import SettingsPage from "./pages/settings.tsx";
import signData from "../test/SignData_rootsid_test.json";

const statusPath = "/status";

const signifyClient = createClient();
window.signifyClient = signifyClient;

const RegComponent = () => {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const from = params.get("from");
  const navigate = useNavigate();
  const { extMode, serverMode } = useConfigMode();
  const { openSnackbar } = useSnackbar();
  const [signatureData, setSignatureData] = useState<any>();
  const [sessionInfoLoaded, setSessionInfoLoaded] = useState(false);
  const [extensionInstalled, setExtensionInstalled] = useState<null | boolean>(
    null
  );

  const [selectedId, setSelectedId] = useState(""); // Step 2 Selection
  const [selectedAcdc, setSelectedAcdc] = useState(null); // Step 3 Selection
  const [serverUrl, setServerUrl] = useState(
    "https://reg-api-test.rootsid.cloud"
  );
  const [logger, setLogger] = useState([]);
  const [vendorConf, setVendorConf] = useState(false);

  const [pingUrl, setPingUrl] = useState(serverUrl + "/ping");
  const [loginUrl, setLoginUrl] = useState(serverUrl + "/login");
  const [checkloginUrl, setCheckloginUrl] = useState(serverUrl + "/checklogin");

  const [aidLoading, setAidLoading] = useState(false);
  const [credLoading, setCredLoading] = useState(false);
  const [autoCredLoading, setAutoCredLoading] = useState(false);

  useEffect(() => {
    setPingUrl(serverUrl + "/ping");
    setLoginUrl(serverUrl + "/login");
    setCheckloginUrl(serverUrl + "/checklogin");
  }, [serverUrl]);

  window.signifyClient = signifyClient;

  const handleSettingVendorUrl = async (url: string) => {
    await signifyClient.configureVendor({ url });
    setVendorConf(true);
  };

  const handleVerifyLogin = async (data) => {
    let vlei_cesr = data?.credential.cesr;
    const requestBody = {
      said: data.credential?.raw?.sad?.d,
      vlei: vlei_cesr,
    };
    const lhead = new Headers();
    lhead.set("Content-Type", "application/json");
    const lRequest = {
      headers: lhead,
      method: "POST",
      body: JSON.stringify(requestBody),
    };
    // loginUrl
    const response = await regService.postLogin(loginUrl, lRequest);

    const responseData = await response.json();

    if (response.status >= 400) {
      await removeData();
      setLogger([
        ...logger,
        {
          origin: loginUrl,
          req: lRequest,
          res: responseData,
          success: response.status < 400,
          msg: responseData.msg,
          time: new Date().toLocaleString(),
        },
      ]);
      throw new Error(responseData.msg);
    }
    if (!response) return;
    if (responseData.msg?.includes(ErrorMessages.cred_crypt_valid)) {
      const checkLogin_endpoint = `${checkloginUrl}/${data?.credential?.raw?.sad?.a?.i}`;
      const checkLogin_headers = {
        method: "GET",
        body: null,
      };
      try {
        const checkLoginResp = await regService.checkLogin(
          checkLogin_endpoint,
          checkLogin_headers
        );
        console.log("checkLoginResp", checkLoginResp);
        setLogger([
          ...logger,
          {
            origin: checkLogin_endpoint,
            req: checkLogin_headers,
            res: checkLoginResp,
            success: true,
            msg: checkLoginResp.msg,
            time: new Date().toLocaleString(),
          },
        ]);
        openSnackbar(checkLoginResp.msg, "success");
      } catch (error) {
        console.log("error", error);
        await removeData();
        setLogger([
          ...logger,
          {
            origin: checkLogin_endpoint,
            req: checkLogin_headers,
            res: error,
            success: false,
            msg: error.msg,
            time: new Date().toLocaleString(),
          },
        ]);
        throw new Error(error?.msg);
      }
    } else {
      setLogger([
        ...logger,
        {
          origin: loginUrl,
          req: lRequest,
          res: responseData,
          success: response.status < 400,
          msg: responseData.msg,
          time: new Date().toLocaleString(),
        },
      ]);
      throw new Error(responseData.msg);
    }
  };

  const handleSignifyData = async (data) => {
    console.log("data received");
    console.log(data);

    if (!data) {
      alert("Could not set signify data");
      return;
    }

    try {
      if (serverMode) {
        await handleVerifyLogin(data);
      } else {
        openSnackbar("Response received: Verified", "success");
      }

      setSignatureData(data);
      setSelectedId(data?.credential?.raw?.sad?.a?.i);
      setSelectedAcdc(data.credential?.raw);
      from && navigate(from);
    } catch (error) {
      if (typeof error?.message === "string")
        openSnackbar(error?.message, "error");
      else
        openSnackbar(`Unable to connect with server at ${loginUrl}`, "error");
    }
  };

  const getSessionInfo = async () => {
    return new Promise(async (resolve, reject) => {
      const timer = setTimeout(() => {
        reject(null);
      }, 3000);

      const sessionObj = await signifyClient.getSessionInfo();
      clearTimeout(timer);
      resolve(sessionObj);
    });
  };
  const populateExtensionStatus = async () => {
    const extensionId = await signifyClient.isExtensionInstalled();
    setExtensionInstalled(Boolean(extensionId));
    if (extensionId) {
      console.log("extensionId", extensionId);
      try {
        if (extMode) {
          const sessionObj = await getSessionInfo();
          await handleSignifyData(sessionObj);
          console.log("sessionObj", sessionObj);
        }
        setSessionInfoLoaded(true);
      } catch (error) {
        console.log("error", error);
        setSessionInfoLoaded(true);
      }
    } else {
      setSessionInfoLoaded(true);
    }
  };

  useEffect(() => {
    populateExtensionStatus();
  }, []);

  const removeData = async () => {
    try {
      await signifyClient.clearSession();
    } catch (error) {
      setSignatureData("");
      openSnackbar("Session cleared!", "success");
    }
  };

  const requestCredentialOnce = async () => {
    if (extMode) {
      const resp = await signifyClient.authorizeCred({
        session: { oneTime: true },
      });
    }
  };

  const handleCredSignin = async (credType?: string) => {
    if (extMode) {
      setCredLoading(true);
      try {
        const resp = await signifyClient.authorizeCred();
        setCredLoading(false);
        console.log("promised resp from signifyClient.authorizeCred()");
        console.log(resp);
        handleSignifyData(resp);
      } catch (error) {
        setCredLoading(false);
        openSnackbar(error?.message, "error");
      }
    } else {
      console.log("credType", credType);
      if (credType === "invalid-role") {
        handleSignifyData(signData.credWithInvalidRole);
      } else if (credType === "invalid-schema") {
        handleSignifyData(signData.credWithInvalidSchema);
      } else if (credType === "invalid-crypt") {
        handleSignifyData(signData.cryptInvalidCred);
      } else if (credType === "diff-org") {
        handleSignifyData(signData.credWithDifOrg);
      } else if (credType === "valid-role") {
        handleSignifyData(signData.validCred);
      }
    }
  };

  const handleAidSignin = async () => {
    if (extMode) {
      // setAidLoading(true);
      // const resp = await signifyClient.authorizeAid();
      // setAidLoading(false);
      // console.log("promised resp from signifyClient.authorizeAid()", resp);
      // handleSignifyData(resp);
    } else {
      handleSignifyData(signData.validCred);
    }
  };

  if (extensionInstalled === null || !sessionInfoLoaded) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        sx={{ height: "100vh" }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (extensionInstalled === false) {
    return <ExtNotFound />;
  }

  return (
    <Box display="flex" justifyContent="center" alignItems="center">
      <AppLayout logger={logger} />
      <Box sx={{ marginTop: "60px", width: "100%" }}>
        <Routes>
          <Route
            path="/"
            element={
              <HomePage
                selectedId={selectedId}
                selectedAcdc={selectedAcdc}
                handleCredSignin={handleCredSignin}
                requestCredentialOnce={requestCredentialOnce}
                handleAidSignin={handleAidSignin}
                aidLoading={aidLoading}
                credLoading={credLoading}
                autoCredLoading={autoCredLoading}
                removeData={removeData}
                signatureData={signatureData}
                loginUrl={loginUrl}
                handleSettingVendorUrl={handleSettingVendorUrl}
                vendorConf={vendorConf}
              />
            }
          />
          <Route
            path="/status"
            element={
              <StatusPage
                selectedAid={signatureData?.credential?.raw?.sad?.a?.i}
                aidName={signatureData?.credential?.raw?.issueeName}
                serverUrl={serverUrl}
                statusPath={statusPath}
                signatureData={signatureData}
                handleSignifyData={handleSignifyData}
                logger={logger}
                setLogger={setLogger}
              />
            }
          />
          <Route
            path="/reports"
            element={
              <ReportsPage
                serverUrl={serverUrl}
                selectedAid={signatureData?.credential?.raw?.sad?.a?.i}
                aidName={signatureData?.credential?.raw?.issueeName}
                selectedAcdc={signatureData?.credential?.raw?.sad?.d}
                signatureData={signatureData}
                logger={logger}
                setLogger={setLogger}
              />
            }
          />
          <Route
            path="/settings"
            element={
              <SettingsPage
                selectedId={signatureData?.credential?.raw?.sad?.a?.i}
                selectedAcdc={selectedAcdc}
                signatureData={signatureData}
                aidName={signatureData?.credential?.raw?.issueeName}
                extensionInstalled={extensionInstalled}
                serverUrl={serverUrl}
                setServerUrl={setServerUrl}
                pingUrl={pingUrl}
                setPingUrl={setPingUrl}
                loginUrl={loginUrl}
                setLoginUrl={setLoginUrl}
                checkloginUrl={checkloginUrl}
                setCheckloginUrl={setCheckloginUrl}
              />
            }
          />
        </Routes>
      </Box>
    </Box>
  );
};

export default RegComponent;
