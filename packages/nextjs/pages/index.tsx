import { useEffect, useState } from "react";
import Link from "next/link";
import { Address, Balance, InputBase } from "../components/scaffold-eth";
import { bufferToBase64URLString, startAuthentication, startRegistration } from "@simplewebauthn/browser";
import crypto from "crypto";
import type { NextPage } from "next";
import { QRCodeSVG } from "qrcode.react";
import toast from "react-hot-toast";
import { useLocalStorage } from "usehooks-ts";
import { useAccount } from "wagmi";
import { MetaHeader } from "~~/components/MetaHeader";
import deployedContracts from "~~/contracts/deployedContracts";
import { useScaffoldContractRead, useScaffoldContractWrite, useScaffoldEventHistory } from "~~/hooks/scaffold-eth";
import scaffoldConfig from "~~/scaffold.config";
import { BASE_URL } from "~~/utils/constants";
import { notification } from "~~/utils/scaffold-eth";

export const TxnNotification = ({ message, blockExplorerLink }: { message: string; blockExplorerLink?: string }) => {
  return (
    <div className={`flex flex-col ml-1 cursor-default`}>
      <p className="my-0">{message}</p>
      {blockExplorerLink && blockExplorerLink.length > 0 ? (
        <a href={blockExplorerLink} target="_blank" rel="noreferrer" className="block link text-md">
          check out transaction
        </a>
      ) : null}
    </div>
  );
};

export const WalletToken = deployedContracts[scaffoldConfig.targetNetworks[0].id].WalletToken;
export const ERC6551Account = deployedContracts[scaffoldConfig.targetNetworks[0].id].ERC6551Account;

export const getPrivateKey = (pubKey: any) => {
  const hash = crypto.createHash("sha256");
  hash.update(pubKey);
  const privateKey = hash.digest("hex");
  return privateKey;
};

const Home: NextPage = () => {
  // const socket = useGlobalState(state => state.socket);

  const { isConnected, address } = useAccount();
  const [currentPublicKey, setCurrentPublicKey] = useState("");

  const [isWebAuth, setIsWebAuth] = useState(false);
  const [sessions, setSessions] = useState([]);
  // const [userName, setUserName] = useState<any>(undefined);

  // local storage states
  const [walletWebAuthData, setWalletWebAuthData] = useLocalStorage<any>("walletWebAuthData", {});
  const [virtualAddress, setVirtualAddress] = useLocalStorage<any>("virtualAddress", undefined);
  const [userName, setUserName] = useLocalStorage<any>("userName", undefined);

  const [publicKey, setPublicKey] = useLocalStorage<any>("publicKey", undefined);

  const [aaguid, setAaguid] = useLocalStorage<any>("aaguid", undefined);

  const [mintedWallets, setMintedWallets] = useLocalStorage<any>("mintedWallets", []);

  // useEffect(() => {
  //   socket.connect();
  //   // n-socket
  //   if (socket.connected) {
  //     console.log("Socket is connected");
  //   } else {
  //     console.log("Socket is not connected");
  //   }

  //   socket.on("setAccount", data => {
  //     const { address } = data;
  //     setVirtualAddress(address);
  //   });

  //   socket.on("setSessions", data => {
  //     const { sessions } = data;
  //     setSessions(sessions);
  //   });
  //   if (aaguid !== undefined) {
  //     socket.emit("getSessions", { aaguid });
  //   }

  //   socket.on("setWallets", data => {
  //     const { wallets } = data;
  //     setMintedWallets(wallets);
  //   });

  //   if (aaguid !== undefined && userName !== undefined) {
  //     socket.emit("getWallets", { userName });
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

  // const { data: tokenBalance } = useScaffoldContractRead({
  //   contractName: "WalletToken",
  //   functionName: "balanceOf",
  //   args: [address],
  // });

  const { data: token } = useScaffoldContractRead({
    contractName: "WalletToken",
    functionName: "tokenID",
  });
  const { data: hashKey } = useScaffoldContractRead({
    contractName: "WalletToken",
    functionName: "getTransactionHash",
    args: [currentPublicKey],
  });
  const { data: TokenBoundEvent } = useScaffoldEventHistory({
    contractName: "WalletToken",
    eventName: "TokenBound",
    fromBlock: BigInt(0),
    transactionData: true,
    receiptData: true,
    watch: true,
  });
  const { writeAsync: writeAsyncMint } = useScaffoldContractWrite({
    contractName: "WalletToken",
    functionName: "mint",
    args: [] as any,
  });

  const onConfirmWallet = async () => {
    (document.getElementById("confirmMintWallet") as HTMLDialogElement)?.showModal();
  };
  const onCreateWallet = async () => {
    try {
      if (isWebAuth) {
        // generate options
        const response = await fetch("/api/generateAuth", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            type: "register",
            rpID: window.location.hostname,
            userID: `${token?.toString()}@${address}`,
            userName: `walletId-${token?.toString()}`,
          }),
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const registerData = await response.json();
        // register
        const authResponse = await startRegistration(registerData.options);
        // verify registration
        const verifyResponse = await fetch("/api/verifyAuth", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            type: "register",
            authResponse: authResponse,
            expectedChallenge: registerData.options.challenge,
            rpID: window.location.hostname,
            expectedOrigin: window.location.origin,
          }),
        });
        const verifyResponseData = await verifyResponse.json();
        // verify registration
        if (verifyResponseData.verification.verified) {
          // setCurrentPublicKey(authResponse.response.publicKey as string);
          const { credentialPublicKey, credentialID, counter } = verifyResponseData.verification.registrationInfo;
          const currentWalletAuthData = {
            credentialPublicKey: credentialPublicKey,
            credentialID: credentialID,
            counter,
            transports: authResponse.response.transports,
          };
          const tokenId = token?.toString() ? +token?.toString() : 0;
          setWalletWebAuthData({ ...walletWebAuthData, [tokenId]: currentWalletAuthData } as any);

          const pubKeyStr = bufferToBase64URLString(
            new Uint8Array(Object.values(currentWalletAuthData.credentialPublicKey) as any),
          );
          setCurrentPublicKey(pubKeyStr as string);
        } else {
          toast.error("Error in registration");
        }
      } else {
        setCurrentPublicKey("false");
      }

      (document.getElementById("confirmMintWallet") as HTMLDialogElement)?.close();
    } catch (error) {
      toast.error("Error in registration");
    }
  };

  const onMint = async (currentPublicKey: string, hashKey: string) => {
    await writeAsyncMint({ args: [hashKey] });
  };

  const onMintPassKey = async () => {
    const toastId = toast.loading("Executing transaction");

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
    if (verifyData.verification.verified) {
      const walletResponse = await fetch(BASE_URL + "/mint-wallet", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          pubKey: publicKey[userName],
          userName,
          aaguid,
        }),
      });
      if (!walletResponse.ok) {
        toast.dismiss(toastId);
        notification.error("error in minting");
        return;
      }
      const walletData = await walletResponse.json();

      const { blockUrl, wallets, status } = walletData;
      if (status) {
        notification.success(<TxnNotification message="Transaction completed at." blockExplorerLink={blockUrl} />);
        setMintedWallets(wallets);
      } else {
        notification.error("Error in minting");
      }

      toast.dismiss(toastId);
      // socket.emit("mintWallet", { pubKey: publicKey, userName, aaguid });
    } else {
      toast.dismiss(toastId);
      notification.error("error in verification");
    }
  };

  const loadSessions = async () => {
    const response = await fetch(BASE_URL + "/sessions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        aaguid,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    const { sessions } = data;
    setSessions(sessions);
  };
  const loadWallets = async () => {
    const response = await fetch(BASE_URL + "/wallets", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userName,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    const { wallets } = data;
    setMintedWallets(wallets);
  };

  const onSignIn = async () => {
    const toastId = toast.loading("Hold on executing transaction...!");
    try {
      let pubKeyStr = "";
      // generate options
      const response = await fetch(BASE_URL + "/generate-auth", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "register",
          rpID: window.location.hostname,
          userID: `${userName}`,
          userName: userName,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const registerData = await response.json();
      // register
      const authResponse = await startRegistration(registerData.options);
      // verify registration
      const verifyResponse = await fetch(BASE_URL + "/verify-auth", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "register",
          authResponse: authResponse,
          expectedChallenge: registerData.options.challenge,
          rpID: window.location.hostname,
          expectedOrigin: window.location.origin,
        }),
      });
      const verifyResponseData = await verifyResponse.json();
      // verify registration

      if (verifyResponseData.verification.verified) {
        // setCurrentPublicKey(authResponse.response.publicKey as string);
        const { credentialPublicKey, credentialID, counter, aaguid } = verifyResponseData.verification.registrationInfo;
        const currentWalletAuthData = {
          credentialPublicKey: credentialPublicKey,
          credentialID: credentialID,
          counter,
          transports: authResponse.response.transports,
        };
        setWalletWebAuthData({ ...walletWebAuthData, [userName]: { ...currentWalletAuthData } } as any);

        pubKeyStr = bufferToBase64URLString(
          new Uint8Array(Object.values(currentWalletAuthData.credentialPublicKey) as any),
        );
        setPublicKey({ ...publicKey, [userName]: pubKeyStr as string });
        setAaguid(aaguid);

        const walletResponse = await fetch(BASE_URL + "/sign-in", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            pubKey: pubKeyStr,
            userName,
            aaguid,
          }),
        });
        if (!walletResponse.ok) {
          toast.dismiss(toastId);
          throw new Error(`HTTP error! status: ${walletResponse.status}`);
        }

        const walletData = await walletResponse.json();
        const { status, address } = walletData;
        if (status) {
          setVirtualAddress(address);
        }

        // socket.emit("getAccount", { pubKey: pubKeyStr, aaguid, userName });
      } else {
        toast.dismiss(toastId);
        toast.error("Error in registration");
      }
      toast.dismiss(toastId);
      toast.success("signed in successfully");
      // (document.getElementById("confirmMintWallet") as HTMLDialogElement)?.close();
    } catch (error) {
      toast.dismiss(toastId);
      toast.error("Error in registration");
    }
  };

  useEffect(() => {
    if (currentPublicKey !== "" && hashKey !== undefined) {
      onMint(currentPublicKey, isWebAuth ? (hashKey as string) : "false");
    }
  }, [currentPublicKey, hashKey]);

  // filter out user tokens
  const userTokens = TokenBoundEvent?.filter(token => token?.args?.owner === address)
    .map(token => {
      return { tokenId: token?.args?.tokenId?.toString(), wallet: token?.args?.wallet, hashKey: token?.args?.hashKey };
    })
    .sort((a: any, b: any) => {
      return parseInt(a.tokenId) - parseInt(b.tokenId);
    });

  useEffect(() => {
    loadSessions();

    if (userName) {
      loadWallets();
    }
  }, [virtualAddress, userName]);

  return (
    <>
      <MetaHeader />
      <div className="flex flex-col items-center justify-center p-5">
        {isConnected === false && (
          <>
            {virtualAddress === undefined && (
              <div className="flex flex-col items-center">
                <div className="my-2">
                  <InputBase
                    value={userName}
                    placeholder="Enter sign in username"
                    onChange={value => {
                      setUserName(value);
                    }}
                  />
                </div>
                <button className="btn btn-primary" onClick={onSignIn} disabled={!userName}>
                  Sign in with pass key
                </button>
                <div className="my-2">Your previous sessions</div>
                <div>
                  {sessions?.map((item: any) => (
                    <div key={item.userName} className="card bg-base-100 shadow-xl w-full m-2">
                      <div>
                        <div className="card-body">
                          <div className="flex flex-col lg:flex-row justify-start items-center">
                            <QRCodeSVG
                              className="rounded-2xl w-50 lg:w-auto mb-4 lg:mb-0"
                              size={100}
                              value={item.address as string}
                            ></QRCodeSVG>

                            <div className="m-2 flex flex-col items-center">
                              <div className="ml-2"> {item.userName}</div>
                              <div className="ml-2">
                                <Address address={item.address} disableAddressLink />
                              </div>
                              <Balance address={item.address} />
                            </div>
                          </div>

                          <div className="card-actions justify-end">
                            {/* <button className="btn btn-primary">View</button> */}
                            {/* <Link href={`/wallet/${token.tokenId}/${token.wallet}`}>
                              <button className="btn btn-primary">View</button>
                            </Link> */}

                            <button
                              className="btn btn-primary"
                              onClick={() => {
                                setVirtualAddress(item.address);
                                setUserName(item.userName);
                              }}
                            >
                              Sign in
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {virtualAddress !== undefined && userName !== undefined && (
              // WALLET ADDRESS

              <>
                <div className="flex flex-col justify-center items-center self-end">
                  <div className="flex justify-between  w-full">
                    <div className="text-xs text-success ">{userName}</div>
                    <div className="text-xs text-success ">Virtual wallet</div>
                  </div>

                  <div className="flex items-center  border-2  rounded-md ">
                    <div className="flex flex-col items-center">
                      <Balance address={virtualAddress} />
                      <div className="text-xs text-warning">{scaffoldConfig.targetNetworks[0].name}</div>
                    </div>

                    <div>
                      <Address address={virtualAddress} />
                    </div>
                  </div>
                </div>

                <div className="m-2">
                  <button className="btn btn-primary mb-4" onClick={onMintPassKey}>
                    Mint nft wallet
                  </button>
                </div>

                <div>
                  <div className="w-full lg:w-2/3 xl:w-1/2">
                    {mintedWallets?.map((token: any) => (
                      <div key={token.tokenId} className="card bg-base-100 shadow-xl w-full m-2">
                        <div>
                          <div className="card-body">
                            <div className="flex flex-col lg:flex-row justify-start items-center">
                              <QRCodeSVG
                                className="rounded-2xl w-50 lg:w-auto mb-4 lg:mb-0"
                                size={200}
                                value={token.wallet as string}
                              ></QRCodeSVG>

                              <div className="m-2">
                                <div className="ml-2">Token id - {token.tokenId}</div>
                                <div className="ml-2">
                                  <Address address={token.wallet} disableAddressLink />
                                </div>
                                <Balance address={token.wallet} />
                              </div>
                            </div>

                            <div className="card-actions justify-end">
                              {/* <button className="btn btn-primary">View</button> */}
                              <Link href={`/wallet/${token.tokenId}/${token.wallet}`}>
                                <button className="btn btn-primary">View</button>
                              </Link>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </>
        )}
        {/* sing in with pass key */}

        {isConnected && (
          <>
            <div className="flex flex-col justify-center items-center w-full lg:w-3/4 xl:w-1/2">
              <button className="btn btn-primary mb-4" onClick={onConfirmWallet}>
                Mint nft wallet
              </button>
              <div>Nft Bound wallets</div>
              <div className="w-full lg:w-2/3 xl:w-1/2">
                {userTokens?.map(token => (
                  <div key={token.tokenId} className="card bg-base-100 shadow-xl w-full m-2">
                    <div>
                      <div className="card-body">
                        <div className="flex flex-col lg:flex-row justify-start items-center">
                          <QRCodeSVG
                            className="rounded-2xl w-50 lg:w-auto mb-4 lg:mb-0"
                            size={200}
                            value={token.wallet as string}
                          ></QRCodeSVG>

                          <div className="m-2">
                            <div className="ml-2">Token id - {token.tokenId}</div>
                            <div className="ml-2">
                              <Address address={token.wallet} disableAddressLink />
                            </div>
                            <Balance address={token.wallet} />
                          </div>
                        </div>

                        <div className="card-actions justify-end">
                          {/* <button className="btn btn-primary">View</button> */}
                          <Link href={`/wallet/${token.tokenId}/${token.wallet}`}>
                            <button className="btn btn-primary">View</button>
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* create wallet modal */}
        {/* Open the modal using document.getElementById('ID').showModal() method */}
        {/* <button className="btn" onClick={() => document.getElementById("confirmMintWallet").showModal()}>
          open modal
        </button> */}
        <dialog id="confirmMintWallet" className="modal">
          <div className="modal-box">
            <h3 className="font-bold text-lg">Enable webuathn security ?</h3>

            <div className="flex justify-around">
              <div className="form-control">
                <label className="label cursor-pointer">
                  <span className="label-text mx-2">Yes</span>
                  <input
                    type="radio"
                    name="radio-10"
                    className="radio radio-success"
                    checked={isWebAuth === true}
                    onChange={() => {
                      setIsWebAuth(!isWebAuth);
                    }}
                  />
                </label>
              </div>
              <div className="form-control">
                <label className="label cursor-pointer">
                  <span className="label-text mx-2">No</span>
                  <input
                    type="radio"
                    name="radio-10"
                    className="radio radio-error"
                    checked={isWebAuth === false}
                    onChange={() => {
                      setIsWebAuth(!isWebAuth);
                    }}
                  />
                </label>
              </div>
            </div>
            <div>
              <span className="text-xs text-warning">
                After Enabling webuathn it will create a passKey on your device. it can add extra security to your
                wallet.
              </span>
            </div>
            <div className="modal-action">
              <form method="dialog">
                {/* if there is a button in form, it will close the modal */}
                <button className="btn" onClick={onCreateWallet}>
                  Create
                </button>
              </form>
            </div>
          </div>
        </dialog>
      </div>
    </>
  );
};

export default Home;
