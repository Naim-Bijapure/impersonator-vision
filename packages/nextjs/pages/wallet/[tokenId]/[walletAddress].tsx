import { useState } from "react";
import { useRouter } from "next/router";
import { startAuthentication } from "@simplewebauthn/browser";
import { NextPage } from "next";
import { QRCodeSVG } from "qrcode.react";
import toast from "react-hot-toast";
import { useAccount } from "wagmi";
import {
  ArrowsRightLeftIcon as SendIcon,
  ArrowTopRightOnSquareIcon as TransferIcon,
} from "@heroicons/react/24/outline";
import { AddressVisionImpersonator } from "~~/components/AddressVisionImpersonator";
import { Impersonator } from "~~/components/Impersonator";
import { Address, AddressInput, Balance, EtherInput, InputBase } from "~~/components/scaffold-eth";
import { useScaffoldContractRead } from "~~/hooks/scaffold-eth";
import { TxnNotification } from "~~/pages";
import { BASE_URL } from "~~/utils/constants";
import { notification } from "~~/utils/scaffold-eth";

const WalletPage: NextPage = () => {
  // const socket = useGlobalState(state => state.socket);

  const { isConnected } = useAccount();

  const router = useRouter();
  const { tokenId, walletAddress } = router.query;

  const [recipient, setRecipent] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [callData, setCallData] = useState<string>("");
  // const [currentPublicKey, setCurrentPublicKey] = useState("");

  let walletWebAuthData: any;
  // let virtualAddress: any;
  let publicKey: any;
  let userName: any;
  let aaguid: any;
  if (typeof window !== "undefined") {
    walletWebAuthData = JSON.parse(localStorage.getItem("walletWebAuthData") || "{}");
    // virtualAddress = JSON.parse(localStorage.getItem("virtualAddress") || "");
    publicKey = JSON.parse(localStorage.getItem("publicKey") || "");
    userName = JSON.parse(localStorage.getItem("userName") || "");
    aaguid = JSON.parse(localStorage.getItem("aaguid") || "");

    if (isConnected) {
      walletWebAuthData = walletWebAuthData[tokenId as string];
    }
  }

  // const { data: hashKey } = useScaffoldContractRead({
  //   contractName: "WalletToken",
  //   functionName: "getTransactionHash",
  //   args: [currentPublicKey],
  // });

  const { data: tokenHashKey } = useScaffoldContractRead({
    contractName: "WalletToken",
    functionName: "tokenHashKey",
    args: [BigInt(tokenId ? +tokenId : 0)],
  });
  // const { writeAsync: writeAsyncExecute } = useScaffoldContractWrite({
  //   contractName: "ERC6551Account",
  //   functionName: "execute",
  //   args: [] as any,
  // });

  const onWebAuthTx = async () => {
    const toastId = toast.loading("Executing transaction");
    try {
      // generate auth data
      const response = await fetch(BASE_URL + "/generate-auth", {
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
      const verifyResponse = await fetch(BASE_URL + "/verify-auth", {
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
          authenticator: walletWebAuthData[userName],
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const verifyData = await verifyResponse.json();
      if (tokenHashKey !== "false" && isConnected && verifyData.verification.verified) {
        // get a public key string
        // const pubKeyStr = bufferToBase64URLString(
        //   new Uint8Array(Object.values(walletWebAuthData.credentialPublicKey) as any),
        // );
        // setCurrentPublicKey(pubKeyStr);
      }
      if (tokenHashKey === "false" && isConnected && verifyData.verification.verified) {
        // setCurrentPublicKey(tokenHashKey);
      }

      // on sign in pass key flow
      if (isConnected === false && verifyData.verification.verified) {
        // const pubKey = bufferToBase64URLString(
        //   new Uint8Array(Object.values(walletWebAuthData.credentialPublicKey) as any),
        // );
        const walletResponse = await fetch(BASE_URL + "/execute", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            pubKey: publicKey[userName],
            userName,
            aaguid,
            tokenId,
            recipient,
            amount,
            callData: Boolean(callData) ? callData : "0x",
          }),
        });
        if (!walletResponse.ok) {
          toast.dismiss(toastId);
          toast.error("Error in tx execution");
          throw new Error(`HTTP error! status: ${walletResponse.status}`);
        }
        toast.dismiss(toastId);
        const walletData = await walletResponse.json();
        const { status, blockUrl } = walletData;

        if (status) {
          notification.success(<TxnNotification message="Tx executed at" blockExplorerLink={blockUrl} />);
        } else {
          notification.error("Transaction failed");
        }

        (document.getElementById("sentModal") as any)?.close();

        // socket.emit("executeWallet", {
        //   pubKey: publicKey,
        //   userName,
        //   aaguid,
        //   tokenId,
        //   recipient,
        //   amount,
        //   callData: Boolean(callData) ? callData : "0x",
        // });
      }
    } catch (error) {
      toast.dismiss(toastId);
      toast.error("Error authenticating");
    }
  };

  // const onExecute = async (currentPublicKey: string, hashKey: string) => {
  //   if (hashKey !== tokenHashKey && tokenHashKey !== "false") {
  //     toast.error("authentication failed");
  //     return;
  //   }

  //   // EXECUTE
  //   await writeAsyncExecute({
  //     args: [
  //       recipient,
  //       ethers.utils.parseEther("" + parseFloat(amount).toFixed(12)) as any,
  //       Boolean(callData) ? callData : "0x",
  //       tokenHashKey !== "false" ? hashKey : "false",
  //     ],
  //     address: walletAddress as any,
  //   } as any);
  //   (document.getElementById("sentModal") as any)?.close();
  //   setRecipent("");
  //   setAmount("");
  //   setCurrentPublicKey("");
  // };

  // useEffect(() => {
  //   if (currentPublicKey !== "" && hashKey !== undefined) {
  //     onExecute(currentPublicKey, hashKey as string);
  //   }
  // }, [currentPublicKey, hashKey]);

  // useEffect(() => {
  //   if (virtualAddress !== undefined && publicKey !== undefined) {
  //     // add signer and provider on mount
  //     const provider = new ethers.providers.JsonRpcProvider(
  //       scaffoldConfig.targetNetworks[0].rpcUrls.default.http[0] as any,
  //     );

  //     const signer = new ethers.Wallet(getPrivateKey(publicKey), provider);

  //     setSigner(signer);
  //     setProvider(provider);
  //   }
  // }, [virtualAddress, publicKey]);

  // useEffect(() => {
  //   // n-socket
  //   if (socket.connected) {
  //     console.log("Socket is connected");
  //   } else {
  //     console.log("Socket is not connected");
  //   }

  //   socket.on("emptyBalance", data => {
  //     toast.dismiss();
  //     notification.error("Not sufficient balance");
  //   });

  //   socket.on("setMinting", data => {
  //     const { blockUrl } = data;
  //     toast.dismiss();
  //     notification.success(
  //       <TxnNotification message="Waiting for transaction to complete." blockExplorerLink={blockUrl} />,
  //     );
  //   });

  //   socket.on("setMinted", data => {
  //     const { blockUrl } = data;
  //     toast.dismiss();
  //     notification.success(<TxnNotification message="Transaction completed at." blockExplorerLink={blockUrl} />);
  //     socket.emit("getWallets", { userName });
  //   });
  // }, []);

  return (
    <div className="">
      {/* wallet header */}
      <div className="flex justify-around lg:justify-center ">
        <QRCodeSVG
          className="rounded-2xl w-50 m-2  lg:w-auto mb-4 lg:mb-0"
          size={200}
          value={walletAddress as string}
        ></QRCodeSVG>

        <div className="m-2">
          <div className="ml-2 text-success"> {userName}</div>
          <div className="ml-2">
            <Address address={walletAddress as string} disableAddressLink />
          </div>
          {walletAddress && <Balance address={walletAddress as string} />}
          <div className="my-10">
            <button
              className="btn btn-primary mx-2 tooltip"
              data-tip="Send eth"
              onClick={() => (document.getElementById("sentModal") as any)?.showModal()}
            >
              <SendIcon className="h-5 w-5" />
            </button>
            <button
              className="btn btn-primary mx-2 tooltip"
              data-tip="Transfer wallet"
              onClick={() => (document.getElementById("transferWallet") as any)?.showModal()}
            >
              <TransferIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
      {/* wallet action tabs */}
      <div role="tablist" className="tabs tabs-lifted lg:mx-8">
        <input type="radio" name="my_tabs_2" role="tab" className="tab" aria-label="Impersonator" checked />
        <div role="tabpanel" className="tab-content bg-base-100 border-base-300 rounded-box p-6">
          <Impersonator
            walletAddress={walletAddress}
            tokenId={tokenId}
            tokenHashKey={tokenHashKey}
            publicKey={publicKey}
            userName={userName}
            aaguid={aaguid}
          />
        </div>

        <input type="radio" name="my_tabs_2" role="tab" className="tab" aria-label="Address Vision" />
        <div role="tabpanel" className="tab-content bg-base-100 border-base-300 rounded-box p-6">
          <AddressVisionImpersonator walletAddress={walletAddress} />
        </div>

        <input type="radio" name="my_tabs_2" role="tab" className="tab" aria-label="settings" />
        <div role="tabpanel" className="tab-content bg-base-100 border-base-300 rounded-box p-6">
          coming soon
        </div>
      </div>

      {/* SEND ETH MODAL */}
      <dialog id="sentModal" className="modal modal-middle">
        <div className="modal-box">
          <h3 className="font-bold text-lg">Send Eth</h3>
          <div className="flex flex-col">
            <div className="my-2">
              <AddressInput
                value={recipient}
                onChange={value => {
                  setRecipent(value);
                }}
                placeholder="Enter recipient address"
              />
            </div>

            <div>
              <EtherInput
                value={amount}
                onChange={value => {
                  setAmount(value);
                }}
                placeholder="Enter value"
              />
            </div>

            <div className="my-2">
              <InputBase
                value={callData}
                onChange={value => {
                  setCallData(value);
                }}
                placeholder="Enter call data"
              />
            </div>
          </div>
          <div className="modal-action">
            <form method="dialog">
              <button className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">✕</button>
            </form>

            <button className="btn" onClick={onWebAuthTx} disabled={recipient === "" || amount === ""}>
              Submit
            </button>
          </div>
        </div>
      </dialog>

      {/* TRANSFER WALLET MODAL */}
      {/* TRANSFER MODAL */}
      <dialog id="transferWallet" className="modal modal-middle">
        <div className="modal-box">
          <h3 className="font-bold text-lg">Transfer Wallet</h3>
          <div className="text-warning">WIP</div>

          <form method="dialog">
            <button className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">✕</button>
          </form>
        </div>
      </dialog>
    </div>
  );
};

export default WalletPage;
