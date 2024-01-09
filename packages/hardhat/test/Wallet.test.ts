import { expect } from "chai";
import { ethers } from "hardhat";
import { YourContract, WalletToken, ERC6551Account, ERC6551Registry } from "../typechain-types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

describe("Wallet app test", function () {
  // We define a fixture to reuse the same setup in every test.

  let walletToken: WalletToken;
  let erc6551Account: ERC6551Account;
  let erc6551Registry: ERC6551Registry;

  let ownerA: SignerWithAddress;
  let ownerB: SignerWithAddress;
  let boundWalletAddress = "";

  const webAuthnMock = {
    pubKey:
      "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEybcDzlozQCk8AdqO-Gq28wtK3IszK-F8x_6p_T5ZUlIHE8LEI1-mhjuwozijwThwqRGRk-OX536NMkp8uQ5Eog",
    signature: "MEYCIQDbqtjJ110Jw-qzEwA4FUR_rTD_kidTvLboah8QRJIwOQIhAL_Srj4SLJ1c3N3jVLze8K5dceWKFaHYZcGl-ifM8tYZ",
    authenticatorData: "SZYN5YgOjGh0NBcPZHZgW4_krrmihjLHmVzzuoMdl2MFAAAABA",
    clientData:
      "eyJ0eXBlIjoid2ViYXV0aG4uZ2V0IiwiY2hhbGxlbmdlIjoiRGRiZGNSWWZnMkVHV1VQTnlFUHdpLWpnR01mRlRPT29fQzRoQ1IwZ2VIRSIsIm9yaWdpbiI6Imh0dHA6Ly9sb2NhbGhvc3Q6ODAwMCIsImNyb3NzT3JpZ2luIjpmYWxzZX0",
    clientChallenge: "DdbdcRYfg2EGWUPNyEPwi-jgGMfFTOOo_C4hCR0geHE",
  };

  before(async () => {
    const [owner1, owner2] = await ethers.getSigners();
    ownerA = owner1;
    ownerB = owner2;

    //     erc5651 account implementation
    const erc6551AccountContractFactory = await ethers.getContractFactory("ERC6551Account");
    erc6551Account = (await erc6551AccountContractFactory.deploy()) as ERC6551Account;
    //     await erc6551Account.deployed();

    //     registry
    const erc6551RegistryContractFactory = await ethers.getContractFactory("ERC6551Registry");
    erc6551Registry = (await erc6551RegistryContractFactory.deploy()) as ERC6551Registry;

    const walletTokenContractFactory = await ethers.getContractFactory("WalletToken");
    walletToken = (await walletTokenContractFactory.deploy(
      "https//example.com/",
      erc6551Registry.address,
      erc6551Account.address,
    )) as WalletToken;
    await walletToken.deployed();
  });

  describe("Deployment", function () {
    it("Wallet token mint ", async function () {
      const hashKey = await walletToken.getTransactionHash(webAuthnMock.pubKey);
      // const hashKey = "false";
      // estimate gas cost
      // const estimateGas = await walletToken.estimateGas.mint(webAuthnMock.pubKey, hashKey, { gasLimit: 999999 });
      //       formate  estimateGas with formatEther
      // console.log(`n-🔴 => estimateGas:`, ethers.utils.formatEther(estimateGas.toString()));

      const mintTx = await walletToken.mint(hashKey, { gasLimit: 999999 });
      const mintRcpt = await mintTx.wait();

      const ownerATokens = await walletToken.balanceOf(ownerA.address);
      console.log(`n-🔴 => ownerATokens:`, ownerATokens.toString());
      const tokenUrl = await walletToken.tokenURI(0);
      console.log(`n-🔴 => tokenUrl:`, tokenUrl);

      //       const setTokenUriTx = await walletToken.setTokenURI(0, "cool man");
      // const setTokenUriRcpt = await setTokenUriTx.wait();

      //       tokenUrl = await walletToken.tokenURI(0);
      //       console.log(`n-🔴 => tokenUrl:`, tokenUrl);

      //       await walletToken.connect(ownerA).approve(ownerB.address, tokenId);
      // await walletToken.connect(ownerB).transferFrom(ownerA.address, ownerB.address, tokenId);

      //       const owner = await walletToken.ownerOf(tokenId);
      //       console.log(`n-🔴 => owner:`, owner);

      const tokenId = 0;
      boundWalletAddress = await walletToken.tokenBoundWalletAddress(tokenId);

      //       ownerATokens = await walletToken.balanceOf(ownerA.address);
      //     const ownerBTokens = await walletToken.balanceOf(ownerB.address);
      //     console.log(`n-🔴 =>ownerATokens, ownerBTokens:`, ownerATokens.toString(), ownerBTokens.toString());
    });

    it("token bound wallet execute", async function () {
      const boundWallet = new ethers.Contract(boundWalletAddress, erc6551Account.interface, ownerA) as ERC6551Account;
      //       check the owner
      const owner = await boundWallet.owner();
      expect(owner).to.equal(ownerA.address);

      // execute
      await ownerA.sendTransaction({ value: ethers.utils.parseEther("10"), to: boundWallet.address });

      const hashKey = await walletToken.getTransactionHash(webAuthnMock.pubKey);
      const executeTx = await boundWallet.execute(ownerB.address, ethers.utils.parseEther("1"), "0x", hashKey, {
        gasLimit: 99999,
      });
      const executeRcpt = await executeTx.wait();

      const boundWalletBalance = await ethers.provider.getBalance(boundWallet.address);
      console.log(`Bound Wallet Balance: ${ethers.utils.formatEther(boundWalletBalance.toString())} ETH`);

      // Get the Transfer events from the walletToken contract
      // const filter = walletToken.filters.Transfer(null, null, null);
      // const events = await walletToken.queryFilter(filter);
      // for (const event of events) {
      //   const { from, to, tokenId } = event.args;
      //   console.log(`n-🔴 => walletToken.on => tokenId: ${tokenId.toString()}`);
      // }

      // const tokenId = 0;
      // transfer ownership
      // await walletToken.connect(ownerA).approve(ownerB.address, tokenId);
      // // await walletToken.connect(ownerB).transferFrom(ownerA.address, ownerB.address, tokenId);
      // await walletToken.connect(ownerB).transferWithWalletAuth(ownerA.address, ownerB.address, tokenId, "cool man");

      // console.log(`n-🔴 => ownerA:`, ownerA.address);
      // console.log(`n-🔴 => ownerB:`, ownerB.address);

      // const tokenOwner = await walletToken.ownerOf(tokenId);
      // console.log(`n-🔴 => tokenOwner:`, tokenOwner);

      // const tokenUrl = await walletToken.tokenURI(0);
      // console.log(`n-🔴 => tokenUrl:`, tokenUrl);

      // HASH , SIGN AND RECOVER ADDRESS
      // const txHash = await walletToken.getTransactionHash(webAuthnMock.pubKey);
      // console.log(`n-🔴 => txHash:`, txHash);
      // const signature = await ownerA?.signMessage(ethers.utils.arrayify(txHash));
      // console.log(`n-🔴 => signature:`, signature);
      // const recoverSigner = await walletToken.recover(txHash, signature);
      // console.log(`n-🔴 => recoverSigner:`, recoverSigner);
    });
  });
});
