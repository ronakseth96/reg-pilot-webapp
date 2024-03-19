import { useState, useEffect } from "react";
import { useIntl } from "react-intl";
import { configService } from "@pages/background/services/config";
import { useLocale, languageCodeMap } from "@src/_locales";
import { isValidUrl, setActionIcon } from "@pages/background/utils";
import { Button, Dropdown, Input } from "@components/ui";

const langMap = Object.entries(languageCodeMap).map((s) => ({
  label: s[1],
  value: s[0],
}));

export function Config(props: any): JSX.Element {
  const [vendorUrl, setVendorUrl] = useState("");
  const [vendorUrlError, setVendorUrlError] = useState("");
  const [agentUrl, setAgentUrl] = useState("");
  const [agentUrlError, setAgentUrlError] = useState("");

  const [hasOnboarded, setHasOnboarded] = useState();

  const { formatMessage } = useIntl();
  const { changeLocale, currentLocale } = useLocale();
  const validUrlMsg = formatMessage({ id: "config.error.enterUrl" });
  const invalidAgentUrlMsg = formatMessage({
    id: "config.error.invalidAgentUrl",
  });
  const invalidVendorUrlError = formatMessage({
    id: "config.error.invalidVendorUrl",
  });

  const getVendorInfo = async () => {
    const response = await configService.getAgentAndVendorInfo();
    setVendorUrl(response.vendorUrl);
    setAgentUrl(response.agentUrl);
    setHasOnboarded(response.hasOnboarded);
  };

  useEffect(() => {
    getVendorInfo();
  }, []);

  const checkErrorVendorUrl = () => {
    if (!vendorUrl || !isValidUrl(vendorUrl)) {
      setVendorUrlError(validUrlMsg);
      return true;
    } else {
      setVendorUrlError("");
      return false;
    }
  };

  const checkErrorAgentUrl = async (_url: string) => {
    const urlObject = isValidUrl(_url);
    if (!_url || !urlObject) {
      setAgentUrlError(validUrlMsg);
      return true;
    }
    if (urlObject && urlObject?.origin) {
      try {
        await (await fetch(`${urlObject?.origin}/health`)).json();
      } catch (error) {
        setAgentUrlError(invalidAgentUrlMsg);
        return true;
      }
    }
  };

  const handleSetAgentUrl = async (_url: string) => {
    const hasError = await checkErrorAgentUrl(_url);
    if (hasError) return;

    await configService.setAgentUrl(_url);
    setAgentUrl(_url);
    setAgentUrlError("");

    if (!hasOnboarded) {
      await configService.setHasOnboarded(true);
      props.handleBack();
    }
  };

  const handleSetVendorUrl = async () => {
    let hasError = checkErrorVendorUrl();
    try {
      const resp = await (await fetch(vendorUrl)).json();
      if (resp?.agentUrl) {
        await handleSetAgentUrl(resp?.agentUrl);
      }
      await configService.setData(resp);
      if (resp?.icon) {
        await setActionIcon(resp?.icon);
      }
    } catch (error) {
      setVendorUrlError(invalidVendorUrlError);
      hasError = true;
    }
    if (!hasError) {
      await configService.setUrl(vendorUrl);
      props.afterSetUrl();
    }
  };

  const handleSave = async () => {
    const hasError = checkErrorVendorUrl();
    if (hasError) return;
    await handleSetVendorUrl();
  };

  const handleBack = async () => {
    const hasError = await checkErrorAgentUrl(agentUrl);
    if (hasError) return;
    props.handleBack();
  };

  return (
    <>
      <div className="px-4 relative mb-2">
        <Input
          id="vendor_url"
          label={formatMessage({ id: "config.vendorUrl.label" })}
          error={vendorUrlError}
          placeholder={formatMessage({ id: "config.vendorUrl.placeholder" })}
          value={vendorUrl}
          onChange={(e) => setVendorUrl(e.target.value)}
          onBlur={checkErrorVendorUrl}
        />
        <div className="absolute right-[16px] bottom-[-28px]">
          <Button
            handleClick={handleSave}
            className="text-white flex flex-row focus:outline-none font-medium rounded-full text-sm px-3 py-[2px]"
          >
            <p className="font-medium text-md">
              {formatMessage({ id: "action.load" })}
            </p>
          </Button>
        </div>
      </div>
      <div className="px-4">
        <Input
          id="agent_url"
          label={`${formatMessage({ id: "config.agentUrl.label" })} *`}
          error={agentUrlError}
          placeholder={formatMessage({ id: "config.agentUrl.placeholder" })}
          value={agentUrl}
          onChange={(e) => setAgentUrl(e.target.value)}
          onBlur={() => handleSetAgentUrl(agentUrl)}
        />
      </div>
      <div className="px-4">
        <p className="text-sm font-bold">
          {formatMessage({ id: "config.language.label" })}
        </p>
        <Dropdown
          selectedOption={langMap.find((s) => s.value === currentLocale)}
          options={langMap}
          onSelect={(option) => changeLocale(option.value)}
        />
      </div>
      {hasOnboarded ? (
        <div className="text-xs flex flex-row justify-center px-4 mt-3">
          <Button
            handleClick={handleBack}
            className="text-white flex flex-row focus:outline-none font-medium rounded-full text-sm px-3 py-[2px]"
          >
            <p className="font-medium text-md">
              {formatMessage({ id: "action.save" })}
            </p>
          </Button>
        </div>
      ) : (
        <></>
      )}
    </>
  );
}
