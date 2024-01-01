interface IERC6551Account {
	receive() external payable;

	function token()
		external
		view
		returns (uint256 chainId, address tokenContract, uint256 tokenId);

	function state() external view returns (uint256);

	function isValidSigner(
		address signer,
		bytes calldata context
	) external view returns (bytes4 magicValue);

	function execute(
		address payable to,
		uint256 value,
		bytes calldata data,
		string calldata hashKey
	) external payable returns (bytes memory);

	// function init(
	// 	address owner,
	// 	bytes32 hashKey
	// ) external returns (bool result);
}
