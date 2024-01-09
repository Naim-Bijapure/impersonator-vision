import deployedContracts from "../../contracts/deployedContracts";
import crypto from "crypto";
import { ethers } from "ethers";
import scaffoldConfig from "~~/scaffold.config";

// import { WALLET_TYPES } from "~~/utils/constants";

export const WALLET_TYPES = {
  ACCOUNT: "account",
  CREATE_WALLET: "createWallet",
  EXECUTE: "Execute",
};

// const userWallets = {};

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.status(405).json({ message: "Method not allowed" }); // 405 Method Not Allowed
    return;
  }

  const { type, pubKey, tokenId, amount, callData } = req.body;
  const WalletToken = deployedContracts[scaffoldConfig.targetNetworks[0].id].WalletToken;
  const ERC6551Account = deployedContracts[scaffoldConfig.targetNetworks[0].id].ERC6551Account;

  const hash = crypto.createHash("sha256");
  hash.update(pubKey);
  const privateKey = hash.digest("hex");

  const provider = new ethers.providers.JsonRpcProvider(
    scaffoldConfig.targetNetworks[0].rpcUrls.default.http[0] as any,
    // "http://host.docker.internal:8547", //n-temp:need to change it
  );
  const signer = new ethers.Wallet(privateKey, provider);
  // mint an token
  const walletToken = new ethers.Contract(WalletToken.address, WalletToken.abi, signer);

  const hashKey = await walletToken.getTransactionHash(pubKey);
  if (type === WALLET_TYPES.ACCOUNT) {
    res.status(200).json({ message: "Wallet created", address: signer.address });
  }

  // check is wallet account is zero
  const balance = await signer.getBalance();

  if (type === WALLET_TYPES.CREATE_WALLET) {
    if (balance.gt(0) === false) {
      return res.status(405).json({ message: "Account dont have any funds" });
    }
    let token = await walletToken.tokenID();
    token = token.toString();
    // mint a nft wallet
    const mintTx = await walletToken.mint(hashKey);
    console.log(`n-🔴 => handler => mintTx:`, mintTx);
    const mintReceipt = await mintTx.wait();
    const boundWalletAddress = await walletToken.tokenBoundWalletAddress(token);
    if (mintReceipt && mintReceipt.status == 1) {
      // Get the network
      const network = await provider.getNetwork();
      const networkName = network.name === "homestead" ? "mainnet" : network.name;

      // Construct the block URL
      const blockUrl = `https://${networkName}.etherscan.io/tx/${mintReceipt.transactionHash}`;
      return res
        .status(200)
        .json({ message: "Wallet created", tokenId: token.toString(), wallet: boundWalletAddress, blockUrl });
    } else {
      return res.status(405).json({ message: "error in wallet creation" });
    }
  }

  if (type === WALLET_TYPES.EXECUTE) {
    if (balance.gt(0) === false) {
      return res.status(405).json({ message: "Account dont have any funds" });
    }
    const boundWalletAddress = await walletToken.tokenBoundWalletAddress(tokenId);

    const boundWallet = new ethers.Contract(boundWalletAddress, ERC6551Account.abi, signer);
    const boundWalletBalance = await provider.getBalance(boundWallet.address);

    if (boundWalletBalance.gt(0) === false) {
      console.log(`n-🔴 => handler => boundWalletBalance:`, boundWalletBalance.toString());
      return res.status(405).json({ message: "Wallet dont have any funds" });
    }

    const executeTx = await boundWallet.execute(
      signer.address,
      ethers.utils.parseEther("" + parseFloat(amount).toFixed(12)) as any,
      callData,
      hashKey,
      {
        gasLimit: 99999,
      },
    );
    console.log(`n-🔴 => handler => executeTx:`, executeTx);
    const executeRcpt = await executeTx.wait();

    if (executeRcpt.status == 1) {
      // Get the network
      const network = await provider.getNetwork();
      const networkName = network.name === "homestead" ? "mainnet" : network.name;

      // Construct the block URL
      const blockUrl = `https://${networkName}.etherscan.io/tx/${executeRcpt.transactionHash}`;
      return res.status(200).json({ message: "TX executed", executeRcpt, blockUrl });
    } else {
      return res.status(405).json({ message: "TX execution failed", executeRcpt });
    }
  }
}
