pragma solidity ^0.5.0;

import "../IBridge.sol";
import "../zeppelin/token/ERC20/IERC20.sol";
contract mockReceiveTokensCall {
    address public bridge;

    constructor(address _bridge) public {
        bridge = _bridge;
    }
    function approveTokensForBridge(address _token,uint256 _amount) public returns(bool success){
        success= IERC20(_token).approve(bridge,_amount);
        require(success,"Not able to approved");
    }
    function callReceiveTokens(address tokenToUse, uint256 amount) public returns(bool) {
        return IBridge(bridge).receiveTokens(tokenToUse, amount);
    }
}