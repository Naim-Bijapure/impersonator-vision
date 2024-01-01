import { ImpersonatorIframe } from "@impersonator/iframe";
import { hardhat } from "viem/chains";
import { useTargetNetwork } from "~~/hooks/scaffold-eth/useTargetNetwork";

/**
 * Site footer
 */
export const AddressVisionImpersonator = ({ walletAddress }: { walletAddress: any }) => {
  const { targetNetwork } = useTargetNetwork();
  const isLocalNetwork = targetNetwork.id === hardhat.id;

  const rpcUrl = !isLocalNetwork ? targetNetwork.rpcUrls.default.http[0] : "https://cloudflare-eth.com";

  return (
    <div className="flex flex-col items-center">
      <ImpersonatorIframe
        key={walletAddress}
        height={"1200px"}
        width={"100%"} //set it to the browser width
        src={`https://address.vision/${walletAddress}`}
        address={walletAddress}
        rpcUrl={rpcUrl}
      />
    </div>
  );
};
