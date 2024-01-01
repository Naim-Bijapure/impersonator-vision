import { useEffect, useState } from "react";
import { InputBase } from "./scaffold-eth";
import { Address } from "./scaffold-eth/";
import { ImpersonatorIframe, useImpersonatorIframe } from "@impersonator/iframe";
import { bufferToBase64URLString, startAuthentication } from "@simplewebauthn/browser";
import { ethers } from "ethers";
import toast from "react-hot-toast";
import { useDebounce } from "usehooks-ts";
import { hardhat } from "viem/chains";
import { useScaffoldContractRead, useScaffoldContractWrite } from "~~/hooks/scaffold-eth";
import { useTargetNetwork } from "~~/hooks/scaffold-eth/useTargetNetwork";

/**
 * Site footer
 */
export const Impersonator = ({
  walletAddress,
  tokenId,
  tokenHashKey,
}: {
  walletAddress: any;
  tokenId: any;
  tokenHashKey: any;
}) => {
  let walletWebAuthData: any;
  if (typeof window !== "undefined") {
    walletWebAuthData = JSON.parse(localStorage.getItem("walletWebAuthData") || "{}");
    walletWebAuthData = walletWebAuthData[tokenId as string];
  }
  const [currentPublicKey, setCurrentPublicKey] = useState("");

  const { targetNetwork } = useTargetNetwork();
  const { latestTransaction } = useImpersonatorIframe();

  const isLocalNetwork = targetNetwork.id === hardhat.id;
  const rpcUrl = !isLocalNetwork ? targetNetwork.rpcUrls.default.http[0] : "https://cloudflare-eth.com";
  // const rpcUrl = targetNetwork.rpcUrls.default.http[0];

  const [appUrl, setAppUrl] = useState<string>("");
  const [txData, setTxData] = useState<{ to: string; value: any; callData: string; hashKey: string }>();

  const debounceAppUrl = useDebounce(appUrl, 500);

  const { data: hashKey } = useScaffoldContractRead({
    contractName: "WalletToken",
    functionName: "getTransactionHash",
    args: [currentPublicKey],
  });
  const { writeAsync: writeAsyncExecute } = useScaffoldContractWrite({
    contractName: "ERC6551Account",
    functionName: "execute",
    args: [] as any,
  });

  const onImpersonatorExecute = async ({ to, value, callData, hashKey }: any) => {
    // execute
    await writeAsyncExecute({
      args: [to, value as any, callData, hashKey],
      address: walletAddress as any,
    } as any);
  };

  const handleAppUrlChange = (newValue: string) => {
    setAppUrl(newValue);
  };

  const onExecute = async (hashKey: string) => {
    if (hashKey !== tokenHashKey) {
      toast.error("authentication failed");
      return;
    }
    await onImpersonatorExecute({ ...txData, hashKey });
    (document.getElementById("sentModal") as any)?.close();
  };

  const onWebAuthTx = async () => {
    try {
      // generate auth data
      const response = await fetch("/api/generateAuth", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "auth",
          rpID: window.location.hostname,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const authData = await response.json();
      const authResponse = await startAuthentication(authData.options);
      // verify auth

      // convert data to unit8array
      // walletWebAuthData.credentialPublicKey = new Uint8Array(walletWebAuthData.credentialPublicKey);
      // walletWebAuthData.credentialID = new Uint8Array(walletWebAuthData.credentialID);
      const verifyResponse = await fetch("/api/verifyAuth", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          type: "auth",
          rpID: window.location.hostname,
          authResponse,
          expectedChallenge: authData.options.challenge,
          expectedOrigin: window.location.origin,
          authenticator: walletWebAuthData,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const verifyData = await verifyResponse.json();
      console.log(`onWebAuthTx => verifyData:`, verifyData);

      // get a public key string
      const pubKeyStr = bufferToBase64URLString(
        new Uint8Array(Object.values(walletWebAuthData.credentialPublicKey) as any),
      );

      setCurrentPublicKey(pubKeyStr);
    } catch (error) {
      toast.error("Error authenticating");
    }
  };

  //   useEffects

  useEffect(() => {
    if (currentPublicKey !== "" && hashKey !== undefined) {
      onExecute(hashKey as string);
    }
  }, [currentPublicKey, hashKey]);

  useEffect(() => {
    if (latestTransaction) {
      const iframeData: any = latestTransaction;

      const _txData = {
        to: iframeData?.to,
        value: parseInt(iframeData?.value, 16),
        callData: iframeData?.data,
        hashKey,
      };
      // onImpersonatorExecute({ ...txData });
      setTxData({ ...(_txData as any) });
      (document.getElementById("confirmTxWallet") as any)?.showModal();
    }
  }, [latestTransaction]);

  return (
    <div className="flex flex-col items-center">
      <div className="w-full xl:w-1/2 my-2">
        <InputBase placeholder="https://app.uniswap.org/swap" value={appUrl} onChange={handleAppUrlChange} />
      </div>

      {debounceAppUrl && (
        <ImpersonatorIframe
          key={walletAddress}
          height={"1200px"}
          width={"100%"} //set it to the browser width
          src={debounceAppUrl}
          address={walletAddress}
          rpcUrl={rpcUrl}
        />
      )}

      {/* CONFIRMATION TX MODAL */}
      <dialog id="confirmTxWallet" className="modal modal-middle">
        <div className="modal-box">
          <h2 className="text-lg font-bold mb-4">Confirm transaction data</h2>
          <div className="space-y-2">
            <div className="flex items-center">
              <span className="font-bold mr-2">To:</span>
              <Address address={txData?.to} />
            </div>

            {txData?.value && (
              <div className="flex items-center">
                <span className="font-bold mr-2">Value:</span>
                <span>{ethers.utils.formatEther(txData?.value?.toString())} ETH</span>
              </div>
            )}

            {txData?.callData && (
              <div>
                <label htmlFor="calldata" className="font-bold mr-2">
                  Call Data:
                </label>
                <textarea
                  name="calldata"
                  id="calldata"
                  className="w-full mt-1 p-2 border rounded  textarea textarea-primary"
                  disabled
                >
                  {txData.callData}
                </textarea>
              </div>
            )}
          </div>

          <div className="modal-action">
            <form method="dialog">
              <button className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">✕</button>
            </form>

            <button className="btn btn-primary" onClick={onWebAuthTx}>
              Execute
            </button>
          </div>
        </div>
      </dialog>
    </div>
  );
};
