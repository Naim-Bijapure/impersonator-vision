// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/interfaces/IERC1271.sol";
import "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import "hardhat/console.sol";

import "./interfaces/IERC6551Account.sol";
import "./WalletToken.sol";

contract ERC6551Account is IERC165, IERC1271, IERC6551Account {
	uint256 public state;
	bytes32 public walletKey;
	address walletOwner;

	receive() external payable {}

	constructor() payable {
		walletOwner = msg.sender;
	}

	function execute(
		address payable to,
		uint256 value,
		bytes calldata data,
		string calldata hashKey
	) external payable virtual returns (bytes memory result) {
		require(_isValidSigner(msg.sender), "Invalid signer");
		// require(operation == 0, "Only call operations are supported");

		(uint256 chainId, address tokenContract, uint256 tokenId) = token();
		require(chainId == block.chainid, "Invalid chain id");

		string memory tokenHashKey = WalletToken(tokenContract).tokenHashKey(
			tokenId
		);
		bool isValidKey = keccak256(abi.encodePacked(hashKey)) ==
			keccak256(abi.encodePacked(tokenHashKey));
		require(isValidKey, "Invalid hash key");

		++state;

		(bool success, bytes memory result) = to.call{ value: value }(data);

		if (!success) {
			assembly {
				revert(add(result, 32), mload(result))
			}
		}
	}

	function isValidSigner(
		address signer,
		bytes calldata
	) external view virtual returns (bytes4) {
		if (_isValidSigner(signer)) {
			return IERC6551Account.isValidSigner.selector;
		}

		return bytes4(0);
	}

	function isValidSignature(
		bytes32 hash,
		bytes memory signature
	) external view virtual returns (bytes4 magicValue) {
		bool isValid = SignatureChecker.isValidSignatureNow(
			owner(),
			hash,
			signature
		);

		if (isValid) {
			return IERC1271.isValidSignature.selector;
		}

		return bytes4(0);
	}

	function supportsInterface(
		bytes4 interfaceId
	) public view virtual returns (bool) {
		return
			interfaceId == type(IERC165).interfaceId ||
			interfaceId == type(IERC6551Account).interfaceId;
	}

	function token() public view virtual returns (uint256, address, uint256) {
		bytes memory footer = new bytes(0x60);

		assembly {
			extcodecopy(address(), add(footer, 0x20), 0x4d, 0x60)
		}

		return abi.decode(footer, (uint256, address, uint256));
	}

	function owner() public view virtual returns (address) {
		(uint256 chainId, address tokenContract, uint256 tokenId) = token();
		if (chainId != block.chainid) return address(0);

		return IERC721(tokenContract).ownerOf(tokenId);
	}

	function _isValidSigner(
		address signer
	) internal view virtual returns (bool) {
		return signer == owner();
	}

	// function init(
	// 	address tokenOwner,
	// 	bytes32 hashKey
	// ) external returns (bool result) {
	// 	console.log("tokenOwner", tokenOwner);
	// 	// require(_isValidSigner(owner), "Invalid owner");
	// 	console.log("walletOwner", walletOwner);
	// 	walletKey = hashKey;
	// 	return true;
	// }
}
