import { useEffect, useState } from "react";
import Link from "next/link";
import { Address, Balance } from "../components/scaffold-eth";
import { bufferToBase64URLString, startRegistration } from "@simplewebauthn/browser";
import type { NextPage } from "next";
import { QRCodeSVG } from "qrcode.react";
import toast from "react-hot-toast";
import { useLocalStorage } from "usehooks-ts";
import { useAccount } from "wagmi";
import { MetaHeader } from "~~/components/MetaHeader";
import { useScaffoldContractRead, useScaffoldContractWrite, useScaffoldEventHistory } from "~~/hooks/scaffold-eth";

const Home: NextPage = () => {
  const { isConnected, address } = useAccount();
  const [currentPublicKey, setCurrentPublicKey] = useState("");
  const [walletWebAuthData, setWalletWebAuthData] = useLocalStorage<any>("walletWebAuthData", {});

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

  const onCreateWallet = async () => {
    try {
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
    } catch (error) {
      toast.error("Error in registration");
    }
  };

  const onMint = async (currentPublicKey: string, hashKey: string) => {
    await writeAsyncMint({ args: [hashKey] });
  };

  useEffect(() => {
    if (currentPublicKey !== "" && hashKey !== undefined) {
      onMint(currentPublicKey, hashKey as string);
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
  return (
    <>
      <MetaHeader />
      <div className="flex flex-col items-center justify-center p-8">
        {isConnected === false && (
          <>
            <div>Connect with wallet</div>
          </>
        )}
        {isConnected && (
          <>
            <div className="flex flex-col justify-center items-center w-full lg:w-3/4 xl:w-1/2">
              <button className="btn btn-primary mb-4" onClick={onCreateWallet}>
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
      </div>
    </>
  );
};

export default Home;
