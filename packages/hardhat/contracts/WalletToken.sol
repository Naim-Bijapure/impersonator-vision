// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Burnable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "hardhat/console.sol";

import "./interfaces/IERC6551Registry.sol";
import "./interfaces/IERC6551Account.sol";

contract WalletToken is
	ERC721,
	ERC721Enumerable,
	ERC721URIStorage,
	Pausable,
	Ownable,
	ERC721Burnable
{
	using Counters for Counters.Counter;

	Counters.Counter private _tokenIdCounter;
	string private baseURI;

	IERC6551Registry public ERC6551Registry;
	address payable public ERC6551AccountImplementation;

	// create a map which stores the token id and the hash key
	mapping(uint256 => string) public tokenHashKey;

	// create an event which captures the token id and account address
	event TokenBound(
		address owner,
		uint256 tokenId,
		address wallet,
		string hashKey
	);

	constructor(
		string memory baseURINew,
		address _ERC6551Registry,
		address payable _ERC6551AccountImplementation
	) ERC721("WalletToken", "WT") {
		baseURI = baseURINew;

		ERC6551Registry = IERC6551Registry(_ERC6551Registry);
		ERC6551AccountImplementation = _ERC6551AccountImplementation;
	}

	function _baseURI() internal view override returns (string memory) {
		return baseURI;
	}

	function pause() public onlyOwner {
		_pause();
	}

	function unpause() public onlyOwner {
		_unpause();
	}

	function mint(string calldata uri) external returns (uint256) {
		uint256 tokenId = _tokenIdCounter.current();
		_tokenIdCounter.increment();
		_safeMint(msg.sender, tokenId);
		_setTokenURI(tokenId, uri);

		// Check that the TBA creation was success

		require(tokenBoundCreation(tokenId, uri), "TBA creation failed");

		return tokenId;
	}

	function tokenBoundCreation(
		uint256 tokenId,
		string calldata hashKey
	) internal returns (bool) {
		ERC6551Registry.createAccount(
			ERC6551AccountImplementation,
			0,
			block.chainid,
			address(this),
			tokenId
		);

		// IERC6551Account(ERC6551AccountImplementation).init(msg.sender, hashKey);
		tokenHashKey[tokenId] = hashKey;

		address tokenAccount = tokenBoundWalletAddress(tokenId);

		emit TokenBound(msg.sender, tokenId, tokenAccount, hashKey);

		return true;
	}

	function tokenBoundWalletAddress(
		uint256 tokenId
	) public view returns (address boundWallet) {
		return
			ERC6551Registry.account(
				ERC6551AccountImplementation,
				0,
				block.chainid,
				address(this),
				tokenId
			);
	}

	function tokenID() public view returns (uint256) {
		return _tokenIdCounter.current();
	}

	function _beforeTokenTransfer(
		address from,
		address to,
		uint256 tokenId,
		uint256 batchSize
	) internal override(ERC721, ERC721Enumerable) whenNotPaused {
		super._beforeTokenTransfer(from, to, tokenId, batchSize);
	}

	// The following functions are overrides required by Solidity.

	function _burn(
		uint256 tokenId
	) internal override(ERC721, ERC721URIStorage) {
		super._burn(tokenId);
	}

	function tokenURI(
		uint256 tokenId
	) public view override(ERC721, ERC721URIStorage) returns (string memory) {
		return super.tokenURI(tokenId);
	}

	function supportsInterface(
		bytes4 interfaceId
	) public view override(ERC721, ERC721Enumerable) returns (bool) {
		return super.supportsInterface(interfaceId);
	}

	function setTokenURI(
		uint256 tokenId,
		string memory _tokenURI
	) public whenNotPaused {
		require(
			_isApprovedOrOwner(_msgSender(), tokenId),
			"ERC721: transfer caller is not owner nor approved"
		);

		_setTokenURI(tokenId, _tokenURI);
	}

	function transferWithWalletAuth(
		address from,
		address to,
		uint256 tokenId,
		string memory _tokenURI
	) public whenNotPaused {
		require(
			_isApprovedOrOwner(_msgSender(), tokenId),
			"ERC721: transfer caller is not owner nor approved"
		);
		require(
			ownerOf(tokenId) == from,
			"ERC721: transfer of token that is not own"
		);

		_transfer(from, to, tokenId);
		setTokenURI(tokenId, _tokenURI);
	}

	function getTransactionHash(
		string memory pubKey
	) public view returns (bytes32) {
		return keccak256(abi.encodePacked(address(this), pubKey));
	}

	function recover(
		bytes32 _hash,
		bytes calldata _signature
	) public pure returns (address) {
		bytes32 ethSignedMessageHash = ECDSA.toEthSignedMessageHash(_hash);

		return ECDSA.recover(ethSignedMessageHash, _signature);
	}
}
