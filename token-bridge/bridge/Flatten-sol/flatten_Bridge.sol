// File: contracts/zeppelin/upgradable/Initializable.sol

pragma solidity >=0.4.24 <0.6.0;


/**
 * @title Initializable
 *
 * @dev Helper contract to support initializer functions. To use it, replace
 * the constructor with a function that has the `initializer` modifier.
 * WARNING: Unlike constructors, initializer functions must be manually
 * invoked. This applies both to deploying an Initializable contract, as well
 * as extending an Initializable contract via inheritance.
 * WARNING: When used with inheritance, manual care must be taken to not invoke
 * a parent initializer twice, or ensure that all initializers are idempotent,
 * because this is not dealt with automatically as with constructors.
 */
contract Initializable {

  /**
   * @dev Indicates that the contract has been initialized.
   */
  bool private initialized;

  /**
   * @dev Indicates that the contract is in the process of being initialized.
   */
  bool private initializing;

  /**
   * @dev Modifier to use in the initializer function of a contract.
   */
  modifier initializer() {
    require(initializing || isConstructor() || !initialized, "Contract instance is already initialized");

    bool isTopLevelCall = !initializing;
    if (isTopLevelCall) {
      initializing = true;
      initialized = true;
    }

    _;

    if (isTopLevelCall) {
      initializing = false;
    }
  }

  /// @dev Returns true if and only if the function is running in the constructor
  function isConstructor() private view returns (bool) {
    // extcodesize checks the size of the code stored in an address, and
    // address returns the current address. Since the code is still not
    // deployed when running a constructor, any checks on its code size will
    // yield zero, making it an effective way to detect if a contract is
    // under construction or not.
    uint256 cs;
    assembly { cs := extcodesize(address) }
    return cs == 0;
  }

  // Reserved storage space to allow for layout changes in the future.
  uint256[50] private ______gap;
}

// File: contracts/zeppelin/upgradable/utils/ReentrancyGuard.sol

pragma solidity ^0.5.2;


/**
 * @title Helps contracts guard against reentrancy attacks.
 * @author Remco Bloemen <remco@2π.com>, Eenae <alexey@mixbytes.io>
 * @dev If you mark a function `nonReentrant`, you should also
 * mark it `external`.
 */
contract ReentrancyGuard is Initializable {
    /// @dev counter to allow mutex lock with only one SSTORE operation
    uint256 private _guardCounter;

    function initialize() public initializer {
        // The counter starts at one to prevent changing it from zero to a non-zero
        // value, which is a more expensive operation.
        _guardCounter = 1;
    }

    /**
     * @dev Prevents a contract from calling itself, directly or indirectly.
     * Calling a `nonReentrant` function from another `nonReentrant`
     * function is not supported. It is possible to prevent this from happening
     * by making the `nonReentrant` function external, and make it call a
     * `private` function that does the actual work.
     */
    modifier nonReentrant() {
        _guardCounter += 1;
        uint256 localCounter = _guardCounter;
        _;
        require(localCounter == _guardCounter, "ReentrancyGuard: no reentrant allowed");
    }
}

// File: contracts/zeppelin/GSN/Context.sol

pragma solidity ^0.5.0;

/*
 * @dev Provides information about the current execution context, including the
 * sender of the transaction and its data. While these are generally available
 * via msg.sender and msg.data, they should not be accessed in such a direct
 * manner, since when dealing with GSN meta-transactions the account sending and
 * paying for execution may not be the actual sender (as far as an application
 * is concerned).
 *
 * This contract is only required for intermediate, library-like contracts.
 */
contract Context {
    // Empty internal constructor, to prevent people from mistakenly deploying
    // an instance of this contract, which should be used via inheritance.
    constructor () internal { }
    // solhint-disable-previous-line no-empty-blocks

    function _msgSender() internal view returns (address payable) {
        return msg.sender;
    }

    function _msgData() internal view returns (bytes memory) {
        this; // silence state mutability warning without generating bytecode - see https://github.com/ethereum/solidity/issues/2691
        return msg.data;
    }
}

// File: contracts/zeppelin/access/Roles.sol

pragma solidity ^0.5.0;

/**
 * @title Roles
 * @dev Library for managing addresses assigned to a Role.
 */
library Roles {
    struct Role {
        mapping (address => bool) bearer;
    }

    /**
     * @dev Give an account access to this role.
     */
    function add(Role storage role, address account) internal {
        require(!has(role, account), "Roles: account already has role");
        role.bearer[account] = true;
    }

    /**
     * @dev Remove an account's access to this role.
     */
    function remove(Role storage role, address account) internal {
        require(has(role, account), "Roles: account doesn't have role");
        role.bearer[account] = false;
    }

    /**
     * @dev Check if an account has this role.
     * @return bool
     */
    function has(Role storage role, address account) internal view returns (bool) {
        require(account != address(0), "Roles: account is the zero address");
        return role.bearer[account];
    }
}

// File: contracts/zeppelin/upgradable/access/roles/UpgradablePauserRole.sol

pragma solidity ^0.5.0;




contract UpgradablePauserRole is Initializable, Context {
    using Roles for Roles.Role;

    event PauserAdded(address indexed account);
    event PauserRemoved(address indexed account);

    Roles.Role private _pausers;

    function initialize(address sender) public initializer {
        if (!isPauser(sender)) {
            _addPauser(sender);
        }
    }

    modifier onlyPauser() {
        require(isPauser(_msgSender()), "PauserRole: caller doesn't have the role");
        _;
    }

    function isPauser(address account) public view returns (bool) {
        return _pausers.has(account);
    }

    function addPauser(address account) public onlyPauser {
        _addPauser(account);
    }

    function renouncePauser() public {
        _removePauser(_msgSender());
    }

    function _addPauser(address account) internal {
        _pausers.add(account);
        emit PauserAdded(account);
    }

    function _removePauser(address account) internal {
        _pausers.remove(account);
        emit PauserRemoved(account);
    }
}

// File: contracts/zeppelin/upgradable/lifecycle/UpgradablePausable.sol

pragma solidity ^0.5.0;




/**
 * @dev Contract module which allows children to implement an emergency stop
 * mechanism that can be triggered by an authorized account.
 *
 * This module is used through inheritance. It will make available the
 * modifiers `whenNotPaused` and `whenPaused`, which can be applied to
 * the functions of your contract. Note that they will not be pausable by
 * simply including this module, only once the modifiers are put in place.
 */
contract UpgradablePausable is Initializable, Context, UpgradablePauserRole {
    /**
     * @dev Emitted when the pause is triggered by a pauser (`account`).
     */
    event Paused(address account);

    /**
     * @dev Emitted when the pause is lifted by a pauser (`account`).
     */
    event Unpaused(address account);

    bool private _paused;

    /**
     * @dev Initializes the contract in unpaused state. Assigns the Pauser role
     * to the deployer.
     */
    function initialize(address sender) public initializer {
        UpgradablePauserRole.initialize(sender);

        _paused = false;
    }

    /**
     * @dev Returns true if the contract is paused, and false otherwise.
     */
    function paused() public view returns (bool) {
        return _paused;
    }

    /**
     * @dev Modifier to make a function callable only when the contract is not paused.
     */
    modifier whenNotPaused() {
        require(!_paused, "Pausable: paused");
        _;
    }

    /**
     * @dev Modifier to make a function callable only when the contract is paused.
     */
    modifier whenPaused() {
        require(_paused, "Pausable: not paused");
        _;
    }

    /**
     * @dev Called by a pauser to pause, triggers stopped state.
     */
    function pause() public onlyPauser whenNotPaused {
        _paused = true;
        emit Paused(_msgSender());
    }

    /**
     * @dev Called by a pauser to unpause, returns to normal state.
     */
    function unpause() public onlyPauser whenPaused {
        _paused = false;
        emit Unpaused(_msgSender());
    }
}

// File: contracts/zeppelin/upgradable/ownership/UpgradableOwnable.sol

pragma solidity ^0.5.0;



/**
 * @dev Contract module which provides a basic access control mechanism, where
 * there is an account (an owner) that can be granted exclusive access to
 * specific functions.
 *
 * This module is used through inheritance. It will make available the modifier
 * `onlyOwner`, which can be aplied to your functions to restrict their use to
 * the owner.
 */
contract UpgradableOwnable is Initializable, Context {
    address private _owner;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    /**
     * @dev Initializes the contract setting the deployer as the initial owner.
     */
    function initialize(address sender) public initializer {
        _owner = sender;
        emit OwnershipTransferred(address(0), _owner);
    }

    /**
     * @dev Returns the address of the current owner.
     */
    function owner() public view returns (address) {
        return _owner;
    }

    /**
     * @dev Throws if called by any account other than the owner.
     */
    modifier onlyOwner() {
        require(isOwner(), "Ownable: caller is not the owner");
        _;
    }

    /**
     * @dev Returns true if the caller is the current owner.
     */
    function isOwner() public view returns (bool) {
        return _msgSender() == _owner;
    }

    /**
     * @dev Leaves the contract without owner. It will not be possible to call
     * `onlyOwner` functions anymore. Can only be called by the current owner.
     *
     * > Note: Renouncing ownership will leave the contract without an owner,
     * thereby removing any functionality that is only available to the owner.
     */
    function renounceOwnership() public onlyOwner {
        emit OwnershipTransferred(_owner, address(0));
        _owner = address(0);
    }

    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`).
     * Can only be called by the current owner.
     */
    function transferOwnership(address newOwner) public onlyOwner {
        _transferOwnership(newOwner);
    }

    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`).
     */
    function _transferOwnership(address newOwner) internal {
        require(newOwner != address(0), "Ownable: new owner is zero address");
        emit OwnershipTransferred(_owner, newOwner);
        _owner = newOwner;
    }

}

// File: contracts/zeppelin/introspection/IERC1820Registry.sol

pragma solidity ^0.5.0;

/**
 * @dev Interface of the global ERC1820 Registry, as defined in the
 * https://eips.ethereum.org/EIPS/eip-1820[EIP]. Accounts may register
 * implementers for interfaces in this registry, as well as query support.
 *
 * Implementers may be shared by multiple accounts, and can also implement more
 * than a single interface for each account. Contracts can implement interfaces
 * for themselves, but externally-owned accounts (EOA) must delegate this to a
 * contract.
 *
 * {IERC165} interfaces can also be queried via the registry.
 *
 * For an in-depth explanation and source code analysis, see the EIP text.
 */
interface IERC1820Registry {
    /**
     * @dev Sets `newManager` as the manager for `account`. A manager of an
     * account is able to set interface implementers for it.
     *
     * By default, each account is its own manager. Passing a value of `0x0` in
     * `newManager` will reset the manager to this initial state.
     *
     * Emits a {ManagerChanged} event.
     *
     * Requirements:
     *
     * - the caller must be the current manager for `account`.
     */
    function setManager(address account, address newManager) external;

    /**
     * @dev Returns the manager for `account`.
     *
     * See {setManager}.
     */
    function getManager(address account) external view returns (address);

    /**
     * @dev Sets the `implementer` contract as `account`'s implementer for
     * `interfaceHash`.
     *
     * `account` being the zero address is an alias for the caller's address.
     * The zero address can also be used in `implementer` to remove an old one.
     *
     * See {interfaceHash} to learn how these are created.
     *
     * Emits an {InterfaceImplementerSet} event.
     *
     * Requirements:
     *
     * - the caller must be the current manager for `account`.
     * - `interfaceHash` must not be an {IERC165} interface id (i.e. it must not
     * end in 28 zeroes).
     * - `implementer` must implement {IERC1820Implementer} and return true when
     * queried for support, unless `implementer` is the caller. See
     * {IERC1820Implementer-canImplementInterfaceForAddress}.
     */
    function setInterfaceImplementer(address account, bytes32 interfaceHash, address implementer) external;

    /**
     * @dev Returns the implementer of `interfaceHash` for `account`. If no such
     * implementer is registered, returns the zero address.
     *
     * If `interfaceHash` is an {IERC165} interface id (i.e. it ends with 28
     * zeroes), `account` will be queried for support of it.
     *
     * `account` being the zero address is an alias for the caller's address.
     */
    function getInterfaceImplementer(address account, bytes32 interfaceHash) external view returns (address);

    /**
     * @dev Returns the interface hash for an `interfaceName`, as defined in the
     * corresponding
     * https://eips.ethereum.org/EIPS/eip-1820#interface-name[section of the EIP].
     */
    function interfaceHash(string calldata interfaceName) external pure returns (bytes32);

    /**
     *  @notice Updates the cache with whether the contract implements an ERC165 interface or not.
     *  @param account Address of the contract for which to update the cache.
     *  @param interfaceId ERC165 interface for which to update the cache.
     */
    function updateERC165Cache(address account, bytes4 interfaceId) external;

    /**
     *  @notice Checks whether a contract implements an ERC165 interface or not.
     *  If the result is not cached a direct lookup on the contract address is performed.
     *  If the result is not cached or the cached value is out-of-date, the cache MUST be updated manually by calling
     *  {updateERC165Cache} with the contract address.
     *  @param account Address of the contract to check.
     *  @param interfaceId ERC165 interface to check.
     *  @return True if `account` implements `interfaceId`, false otherwise.
     */
    function implementsERC165Interface(address account, bytes4 interfaceId) external view returns (bool);

    /**
     *  @notice Checks whether a contract implements an ERC165 interface or not without using nor updating the cache.
     *  @param account Address of the contract to check.
     *  @param interfaceId ERC165 interface to check.
     *  @return True if `account` implements `interfaceId`, false otherwise.
     */
    function implementsERC165InterfaceNoCache(address account, bytes4 interfaceId) external view returns (bool);

    event InterfaceImplementerSet(address indexed account, bytes32 indexed interfaceHash, address indexed implementer);

    event ManagerChanged(address indexed account, address indexed newManager);
}

// File: contracts/zeppelin/token/ERC777/IERC777Recipient.sol

pragma solidity ^0.5.0;

/**
 * @dev Interface of the ERC777TokensRecipient standard as defined in the EIP.
 *
 * Accounts can be notified of `IERC777` tokens being sent to them by having a
 * contract implement this interface (contract holders can be their own
 * implementer) and registering it on the
 * [ERC1820 global registry](https://eips.ethereum.org/EIPS/eip-1820).
 *
 * See `IERC1820Registry` and `ERC1820Implementer`.
 */
interface IERC777Recipient {
    /**
     * @dev Called by an `IERC777` token contract whenever tokens are being
     * moved or created into a registered account (`to`). The type of operation
     * is conveyed by `from` being the zero address or not.
     *
     * This call occurs _after_ the token contract's state is updated, so
     * `IERC777.balanceOf`, etc., can be used to query the post-operation state.
     *
     * This function may revert to prevent the operation from being executed.
     */
    function tokensReceived(
        address operator,
        address from,
        address to,
        uint amount,
        bytes calldata userData,
        bytes calldata operatorData
    ) external;
}

// File: contracts/zeppelin/token/ERC20/IERC20.sol

pragma solidity ^0.5.0;

/**
 * @dev Interface of the ERC20 standard as defined in the EIP. Does not include
 * the optional functions; to access them see {ERC20Detailed}.
 */
interface IERC20 {
    /**
     * @dev Returns the amount of tokens in existence.
     */
    function totalSupply() external view returns (uint256);

    /**
     * @dev Returns the amount of tokens owned by `account`.
     */
    function balanceOf(address account) external view returns (uint256);

    /**
     * @dev Moves `amount` tokens from the caller's account to `recipient`.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * Emits a {Transfer} event.
     */
    function transfer(address recipient, uint256 amount) external returns (bool);

    /**
     * @dev Returns the remaining number of tokens that `spender` will be
     * allowed to spend on behalf of `owner` through {transferFrom}. This is
     * zero by default.
     *
     * This value changes when {approve} or {transferFrom} are called.
     */
    function allowance(address owner, address spender) external view returns (uint256);

    /**
     * @dev Sets `amount` as the allowance of `spender` over the caller's tokens.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * IMPORTANT: Beware that changing an allowance with this method brings the risk
     * that someone may use both the old and the new allowance by unfortunate
     * transaction ordering. One possible solution to mitigate this race
     * condition is to first reduce the spender's allowance to 0 and set the
     * desired value afterwards:
     * https://github.com/ethereum/EIPs/issues/20#issuecomment-263524729
     *
     * Emits an {Approval} event.
     */
    function approve(address spender, uint256 amount) external returns (bool);

    /**
     * @dev Moves `amount` tokens from `sender` to `recipient` using the
     * allowance mechanism. `amount` is then deducted from the caller's
     * allowance.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * Emits a {Transfer} event.
     */
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);

    /**
     * @dev Emitted when `value` tokens are moved from one account (`from`) to
     * another (`to`).
     *
     * Note that `value` may be zero.
     */
    event Transfer(address indexed from, address indexed to, uint256 value);

    /**
     * @dev Emitted when the allowance of a `spender` for an `owner` is set by
     * a call to {approve}. `value` is the new allowance.
     */
    event Approval(address indexed owner, address indexed spender, uint256 value);
}

// File: contracts/zeppelin/math/SafeMath.sol

pragma solidity ^0.5.0;

/**
 * @dev Wrappers over Solidity's arithmetic operations with added overflow
 * checks.
 *
 * Arithmetic operations in Solidity wrap on overflow. This can easily result
 * in bugs, because programmers usually assume that an overflow raises an
 * error, which is the standard behavior in high level programming languages.
 * `SafeMath` restores this intuition by reverting the transaction when an
 * operation overflows.
 *
 * Using this library instead of the unchecked operations eliminates an entire
 * class of bugs, so it's recommended to use it always.
 */
library SafeMath {
    /**
     * @dev Returns the addition of two unsigned integers, reverting on
     * overflow.
     *
     * Counterpart to Solidity's `+` operator.
     *
     * Requirements:
     * - Addition cannot overflow.
     */
    function add(uint256 a, uint256 b) internal pure returns (uint256) {
        uint256 c = a + b;
        require(c >= a, "SafeMath: addition overflow");

        return c;
    }

    /**
     * @dev Returns the subtraction of two unsigned integers, reverting on
     * overflow (when the result is negative).
     *
     * Counterpart to Solidity's `-` operator.
     *
     * Requirements:
     * - Subtraction cannot overflow.
     */
    function sub(uint256 a, uint256 b) internal pure returns (uint256) {
        return sub(a, b, "SafeMath: subtraction overflow");
    }

    /**
     * @dev Returns the subtraction of two unsigned integers, reverting with custom message on
     * overflow (when the result is negative).
     *
     * Counterpart to Solidity's `-` operator.
     *
     * Requirements:
     * - Subtraction cannot overflow.
     *
     * _Available since v2.4.0._
     */
    function sub(uint256 a, uint256 b, string memory errorMessage) internal pure returns (uint256) {
        require(b <= a, errorMessage);
        uint256 c = a - b;

        return c;
    }

    /**
     * @dev Returns the multiplication of two unsigned integers, reverting on
     * overflow.
     *
     * Counterpart to Solidity's `*` operator.
     *
     * Requirements:
     * - Multiplication cannot overflow.
     */
    function mul(uint256 a, uint256 b) internal pure returns (uint256) {
        // Gas optimization: this is cheaper than requiring 'a' not being zero, but the
        // benefit is lost if 'b' is also tested.
        // See: https://github.com/OpenZeppelin/openzeppelin-contracts/pull/522
        if (a == 0) {
            return 0;
        }

        uint256 c = a * b;
        require(c / a == b, "SafeMath: multiplication overflow");

        return c;
    }

    /**
     * @dev Returns the integer division of two unsigned integers. Reverts on
     * division by zero. The result is rounded towards zero.
     *
     * Counterpart to Solidity's `/` operator. Note: this function uses a
     * `revert` opcode (which leaves remaining gas untouched) while Solidity
     * uses an invalid opcode to revert (consuming all remaining gas).
     *
     * Requirements:
     * - The divisor cannot be zero.
     */
    function div(uint256 a, uint256 b) internal pure returns (uint256) {
        return div(a, b, "SafeMath: division by zero");
    }

    /**
     * @dev Returns the integer division of two unsigned integers. Reverts with custom message on
     * division by zero. The result is rounded towards zero.
     *
     * Counterpart to Solidity's `/` operator. Note: this function uses a
     * `revert` opcode (which leaves remaining gas untouched) while Solidity
     * uses an invalid opcode to revert (consuming all remaining gas).
     *
     * Requirements:
     * - The divisor cannot be zero.
     *
     * _Available since v2.4.0._
     */
    function div(uint256 a, uint256 b, string memory errorMessage) internal pure returns (uint256) {
        // Solidity only automatically asserts when dividing by 0
        require(b > 0, errorMessage);
        uint256 c = a / b;
        // assert(a == b * c + a % b); // There is no case in which this doesn't hold

        return c;
    }

    /**
     * @dev Returns the remainder of dividing two unsigned integers. (unsigned integer modulo),
     * Reverts when dividing by zero.
     *
     * Counterpart to Solidity's `%` operator. This function uses a `revert`
     * opcode (which leaves remaining gas untouched) while Solidity uses an
     * invalid opcode to revert (consuming all remaining gas).
     *
     * Requirements:
     * - The divisor cannot be zero.
     */
    function mod(uint256 a, uint256 b) internal pure returns (uint256) {
        return mod(a, b, "SafeMath: modulo by zero");
    }

    /**
     * @dev Returns the remainder of dividing two unsigned integers. (unsigned integer modulo),
     * Reverts with custom message when dividing by zero.
     *
     * Counterpart to Solidity's `%` operator. This function uses a `revert`
     * opcode (which leaves remaining gas untouched) while Solidity uses an
     * invalid opcode to revert (consuming all remaining gas).
     *
     * Requirements:
     * - The divisor cannot be zero.
     *
     * _Available since v2.4.0._
     */
    function mod(uint256 a, uint256 b, string memory errorMessage) internal pure returns (uint256) {
        require(b != 0, errorMessage);
        return a % b;
    }
}

// File: contracts/zeppelin/utils/Address.sol

pragma solidity ^0.5.0;

/**
 * @dev Collection of functions related to the address type,
 */
library Address {
    /**
     * @dev Returns true if `account` is a contract.
     *
     * [IMPORTANT]
     * ====
     * It is unsafe to assume that an address for which this function returns
     * false is an externally-owned account (EOA) and not a contract.
     *
     * Among others, `isContract` will return false for the following
     * types of addresses:
     *
     *  - an externally-owned account
     *  - a contract in construction
     *  - an address where a contract will be created
     *  - an address where a contract lived, but was destroyed
     * ====
     */
    function isContract(address account) internal view returns (bool) {
        // According to EIP-1052, 0x0 is the value returned for not-yet created accounts
        // and 0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470 is returned
        // for accounts without code, i.e. `keccak256('')`
        bytes32 codehash;
        bytes32 accountHash = 0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470;
        // solhint-disable-next-line no-inline-assembly
        assembly { codehash := extcodehash(account) }
        return (codehash != accountHash && codehash != 0x0);
    }
}

// File: contracts/zeppelin/token/ERC20/SafeERC20.sol

pragma solidity ^0.5.0;




/**
 * @title SafeERC20
 * @dev Wrappers around ERC20 operations that throw on failure (when the token
 * contract returns false). Tokens that return no value (and instead revert or
 * throw on failure) are also supported, non-reverting calls are assumed to be
 * successful.
 * To use this library you can add a `using SafeERC20 for ERC20;` statement to your contract,
 * which allows you to call the safe operations as `token.safeTransfer(...)`, etc.
 */
library SafeERC20 {
    using SafeMath for uint256;
    using Address for address;

    function safeTransfer(IERC20 token, address to, uint256 value) internal {
        callOptionalReturn(token, abi.encodeWithSelector(token.transfer.selector, to, value));
    }

    function safeTransferFrom(IERC20 token, address from, address to, uint256 value) internal {
        callOptionalReturn(token, abi.encodeWithSelector(token.transferFrom.selector, from, to, value));
    }

    function safeApprove(IERC20 token, address spender, uint256 value) internal {
        // safeApprove should only be called when setting an initial allowance,
        // or when resetting it to zero. To increase and decrease it, use
        // 'safeIncreaseAllowance' and 'safeDecreaseAllowance'
        // solhint-disable-next-line max-line-length
        require((value == 0) || (token.allowance(address(this), spender) == 0),
            "SafeERC20: approve non-zero to non-zero allowance"
        );
        callOptionalReturn(token, abi.encodeWithSelector(token.approve.selector, spender, value));
    }

    function safeIncreaseAllowance(IERC20 token, address spender, uint256 value) internal {
        uint256 newAllowance = token.allowance(address(this), spender).add(value);
        callOptionalReturn(token, abi.encodeWithSelector(token.approve.selector, spender, newAllowance));
    }

    function safeDecreaseAllowance(IERC20 token, address spender, uint256 value) internal {
        uint256 newAllowance = token.allowance(address(this), spender).sub(value, "SafeERC20: decreased allowance below zero");
        callOptionalReturn(token, abi.encodeWithSelector(token.approve.selector, spender, newAllowance));
    }

    /**
     * @dev Imitates a Solidity high-level call (i.e. a regular function call to a contract), relaxing the requirement
     * on the return value: the return value is optional (but if data is returned, it must not be false).
     * @param token The token targeted by the call.
     * @param data The call data (encoded using abi.encode or one of its variants).
     */
    function callOptionalReturn(IERC20 token, bytes memory data) private {
        // We need to perform a low level call here, to bypass Solidity's return data size checking mechanism, since
        // we're implementing it ourselves.

        // A Solidity high level call has three parts:
        //  1. The target address is checked to verify it contains contract code
        //  2. The call itself is made, and success asserted
        //  3. The return value is decoded, which in turn checks the size of the returned data.
        // solhint-disable-next-line max-line-length
        require(address(token).isContract(), "SafeERC20: call to non-contract");

        // solhint-disable-next-line avoid-low-level-calls
        (bool success, bytes memory returndata) = address(token).call(data);
        require(success, "SafeERC20: low-level call failed");

        if (returndata.length > 0) { // Return data is optional
            // solhint-disable-next-line max-line-length
            require(abi.decode(returndata, (bool)), "SafeERC20: ERC20 operation did not succeed");
        }
    }
}

// File: contracts/zeppelin/token/ERC20/ERC20Detailed.sol

pragma solidity ^0.5.0;


/**
 * @dev Optional functions from the ERC20 standard.
 */
contract ERC20Detailed is IERC20 {
    string private _name;
    string private _symbol;
    uint8 private _decimals;

    /**
     * @dev Sets the values for `name`, `symbol`, and `decimals`. All three of
     * these values are immutable: they can only be set once during
     * construction.
     */
    constructor (string memory name, string memory symbol, uint8 decimals) public {
        _name = name;
        _symbol = symbol;
        _decimals = decimals;
    }

    /**
     * @dev Returns the name of the token.
     */
    function name() public view returns (string memory) {
        return _name;
    }

    /**
     * @dev Returns the symbol of the token, usually a shorter version of the
     * name.
     */
    function symbol() public view returns (string memory) {
        return _symbol;
    }

    /**
     * @dev Returns the number of decimals used to get its user representation.
     * For example, if `decimals` equals `2`, a balance of `505` tokens should
     * be displayed to a user as `5,05` (`505 / 10 ** 2`).
     *
     * Tokens usually opt for a value of 18, imitating the relationship between
     * Ether and Wei.
     *
     * NOTE: This information is only used for _display_ purposes: it in
     * no way affects any of the arithmetic of the contract, including
     * {IERC20-balanceOf} and {IERC20-transfer}.
     */
    function decimals() public view returns (uint8) {
        return _decimals;
    }
}

// File: contracts/IBridge.sol

pragma solidity ^0.5.0;


interface IBridge {
    function version() external pure returns (string memory);

    //function getFeePercentage() external view returns(uint);

    //function calcMaxWithdraw() external view returns (uint);

    /**
     * ERC-20 tokens approve and transferFrom pattern
     * See https://eips.ethereum.org/EIPS/eip-20#transferfrom
     */
    function receiveTokens(address tokenToUse, uint256 amount) external returns(bool);

    /**
     * ERC-20 tokens approve and transferFrom pattern
     * See https://eips.ethereum.org/EIPS/eip-20#transferfrom
     */
    function receiveTokensAt(
        address tokenToUse,
        uint256 amount,
        address receiver,
        bytes calldata extraData
    ) external returns(bool);

    /**
     * ERC-777 tokensReceived hook allows to send tokens to a contract and notify it in a single transaction
     * See https://eips.ethereum.org/EIPS/eip-777#motivation for details
     */
    function tokensReceived (
        address operator,
        address from,
        address to,
        uint amount,
        bytes calldata userData,
        bytes calldata operatorData
    ) external;

    /**
     * Accepts the transaction from the other chain that was voted and sent by the federation contract
     */
    function acceptTransfer(
        address originalTokenAddress,
        address receiver,
        uint256 amount,
        string calldata symbol,
        bytes32 blockHash,
        bytes32 transactionHash,
        uint32 logIndex,
        uint8 decimals,
        uint256 granularity
    ) external returns(bool);

    function acceptTransferAt(
        address originalTokenAddress,
        address receiver,
        uint256 amount,
        string calldata symbol,
        bytes32 blockHash,
        bytes32 transactionHash,
        uint32 logIndex,
        uint8 decimals,
        uint256 granularity,
        bytes calldata userData
    ) external returns(bool);

    function receiveEthAt(address _receiver, bytes calldata _extraData) external payable;

    event Cross(address indexed _tokenAddress, address indexed _to, uint256 _amount, string _symbol, bytes _userData,
        uint8 _decimals, uint256 _granularity);
    event NewSideToken(address indexed _newSideTokenAddress, address indexed _originalTokenAddress, string _newSymbol, uint256 _granularity);
    event AcceptedCrossTransfer(address indexed _tokenAddress, address indexed _to, uint256 _amount, uint8 _decimals, uint256 _granularity,
        uint256 _formattedAmount, uint8 _calculatedDecimals, uint256 _calculatedGranularity, bytes _userData);
    //event FeePercentageChanged(uint256 _amount);
    event ErrorTokenReceiver(bytes _errorData);
    //event AllowTokenChanged(address _newAllowToken);
    //event PrefixUpdated(bool _isPrefix, string _prefix);

}

// File: contracts/ISideToken.sol

pragma solidity ^0.5.0;

interface ISideToken {

    function name() external view returns (string memory);

    function symbol() external view returns (string memory);

    function decimals() external pure returns (uint8);

    function granularity() external view returns (uint256);

    function burn(uint256 amount, bytes calldata data) external;

    function mint(address account, uint256 amount, bytes calldata userData, bytes calldata operatorData) external;

    function totalSupply() external view returns (uint256);

    function balanceOf(address owner) external view returns (uint256);

    function send(address recipient, uint256 amount, bytes calldata data) external;

    function transfer(address recipient, uint256 amount) external returns (bool);

    function allowance(address owner, address spender) external view returns (uint256);

    function approve(address spender, uint256 amount) external returns (bool);

    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
}

// File: contracts/ISideTokenFactory.sol

pragma solidity ^0.5.0;

interface ISideTokenFactory {

    function createSideToken(string calldata name, string calldata symbol, uint256 granularity) external returns(address);

    event SideTokenCreated(address indexed sideToken, string symbol, uint256 granularity);
}

// File: contracts/IAllowTokens.sol

pragma solidity ^0.5.0;

interface IAllowTokens {

    function getFeePerToken(address token) external view returns(uint256); 
    function isValidTokenTransfer(address tokenToUse, uint amount, uint spentToday, bool isSideToken) external view returns (bool);
    function calcMaxWithdraw(uint spentToday) external view returns (uint);
}

// File: contracts/zeppelin/token/ERC777/IERC777.sol

pragma solidity ^0.5.0;

/**
 * @dev Interface of the ERC777Token standard as defined in the EIP.
 *
 * This contract uses the
 * [ERC1820 registry standard](https://eips.ethereum.org/EIPS/eip-1820) to let
 * token holders and recipients react to token movements by using setting implementers
 * for the associated interfaces in said registry. See `IERC1820Registry` and
 * `ERC1820Implementer`.
 */
interface IERC777 {
    /**
     * @dev Returns the name of the token.
     */
    function name() external view returns (string memory);

    /**
     * @dev Returns the symbol of the token, usually a shorter version of the
     * name.
     */
    function symbol() external view returns (string memory);

    /**
     * @dev Returns the smallest part of the token that is not divisible. This
     * means all token operations (creation, movement and destruction) must have
     * amounts that are a multiple of this number.
     *
     * For most token contracts, this value will equal 1.
     */
    function granularity() external view returns (uint256);

    /**
     * @dev Returns the amount of tokens in existence.
     */
    function totalSupply() external view returns (uint256);

    /**
     * @dev Returns the amount of tokens owned by an account (`owner`).
     */
    function balanceOf(address owner) external view returns (uint256);

    /**
     * @dev Moves `amount` tokens from the caller's account to `recipient`.
     *
     * If send or receive hooks are registered for the caller and `recipient`,
     * the corresponding functions will be called with `data` and empty
     * `operatorData`. See `IERC777Sender` and `IERC777Recipient`.
     *
     * Emits a `Sent` event.
     *
     * Requirements
     *
     * - the caller must have at least `amount` tokens.
     * - `recipient` cannot be the zero address.
     * - if `recipient` is a contract, it must implement the `tokensReceived`
     * interface.
     */
    function send(address recipient, uint256 amount, bytes calldata data) external;

    /**
     * @dev Destroys `amount` tokens from the caller's account, reducing the
     * total supply.
     *
     * If a send hook is registered for the caller, the corresponding function
     * will be called with `data` and empty `operatorData`. See `IERC777Sender`.
     *
     * Emits a `Burned` event.
     *
     * Requirements
     *
     * - the caller must have at least `amount` tokens.
     */
    function burn(uint256 amount, bytes calldata data) external;

    /**
     * @dev Returns true if an account is an operator of `tokenHolder`.
     * Operators can send and burn tokens on behalf of their owners. All
     * accounts are their own operator.
     *
     * See `operatorSend` and `operatorBurn`.
     */
    function isOperatorFor(address operator, address tokenHolder) external view returns (bool);

    /**
     * @dev Make an account an operator of the caller.
     *
     * See `isOperatorFor`.
     *
     * Emits an `AuthorizedOperator` event.
     *
     * Requirements
     *
     * - `operator` cannot be calling address.
     */
    function authorizeOperator(address operator) external;

    /**
     * @dev Make an account an operator of the caller.
     *
     * See `isOperatorFor` and `defaultOperators`.
     *
     * Emits a `RevokedOperator` event.
     *
     * Requirements
     *
     * - `operator` cannot be calling address.
     */
    function revokeOperator(address operator) external;

    /**
     * @dev Returns the list of default operators. These accounts are operators
     * for all token holders, even if `authorizeOperator` was never called on
     * them.
     *
     * This list is immutable, but individual holders may revoke these via
     * `revokeOperator`, in which case `isOperatorFor` will return false.
     */
    function defaultOperators() external view returns (address[] memory);

    /**
     * @dev Moves `amount` tokens from `sender` to `recipient`. The caller must
     * be an operator of `sender`.
     *
     * If send or receive hooks are registered for `sender` and `recipient`,
     * the corresponding functions will be called with `data` and
     * `operatorData`. See `IERC777Sender` and `IERC777Recipient`.
     *
     * Emits a `Sent` event.
     *
     * Requirements
     *
     * - `sender` cannot be the zero address.
     * - `sender` must have at least `amount` tokens.
     * - the caller must be an operator for `sender`.
     * - `recipient` cannot be the zero address.
     * - if `recipient` is a contract, it must implement the `tokensReceived`
     * interface.
     */
    function operatorSend(
        address sender,
        address recipient,
        uint256 amount,
        bytes calldata data,
        bytes calldata operatorData
    ) external;

    /**
     * @dev Destoys `amount` tokens from `account`, reducing the total supply.
     * The caller must be an operator of `account`.
     *
     * If a send hook is registered for `account`, the corresponding function
     * will be called with `data` and `operatorData`. See `IERC777Sender`.
     *
     * Emits a `Burned` event.
     *
     * Requirements
     *
     * - `account` cannot be the zero address.
     * - `account` must have at least `amount` tokens.
     * - the caller must be an operator for `account`.
     */
    function operatorBurn(
        address account,
        uint256 amount,
        bytes calldata data,
        bytes calldata operatorData
    ) external;

    event Sent(
        address indexed operator,
        address indexed from,
        address indexed to,
        uint256 amount,
        bytes data,
        bytes operatorData
    );

    event Minted(address indexed operator, address indexed to, uint256 amount, bytes data, bytes operatorData);

    event Burned(address indexed operator, address indexed from, uint256 amount, bytes data, bytes operatorData);

    event AuthorizedOperator(address indexed operator, address indexed tokenHolder);

    event RevokedOperator(address indexed operator, address indexed tokenHolder);
}

// File: contracts/Utils.sol

pragma solidity ^0.5.0;




library Utils {
    using SafeMath for uint256;

    IERC1820Registry constant private _erc1820 = IERC1820Registry(0x1820a4B7618BdE71Dce8cdc73aAB6C95905faD24);
    // keccak256("ERC777Token")
    bytes32 constant private TOKENS_ERC777_HASH = 0xac7fbab5f54a3ca8194167523c6753bfeb96a445279294b6125b68cce2177054;

    function getTokenInfo(address tokenToUse) external view returns (uint8 decimals, uint256 granularity, string memory symbol) {
        decimals = getDecimals(tokenToUse);
        granularity = getGranularity(tokenToUse);
        symbol = getSymbol(tokenToUse);
    }

    function getSymbol(address tokenToUse) public view returns (string memory symbol) {
        //support 32 bytes or string symbol
        (bool success, bytes memory data) = tokenToUse.staticcall(abi.encodeWithSignature("symbol()"));
        require(success, "Utils: Token hasn't symbol()");
        if (data.length == 32) {
            symbol = bytes32ToString(abi.decode(data, (bytes32)));
        } else {
            symbol = abi.decode(data, (string));
        }
        require(bytes(symbol).length > 0, "Utils: Token empty symbol");
        return symbol;
    }

    function getDecimals(address tokenToUse) public view returns (uint8) {
        //support decimals as uint256 or uint8
        (bool success, bytes memory data) = tokenToUse.staticcall(abi.encodeWithSignature("decimals()"));
        require(success, "Utils: No decimals");
        require(data.length == 32, "Utils: Decimals not uint<M>");
        // uint<M>: enc(X) is the big-endian encoding of X,
        //padded on the higher-order (left) side with zero-bytes such that the length is 32 bytes.
        uint256 decimalsDecoded = abi.decode(data, (uint256));
        require(decimalsDecoded <= 18, "Utils: Decimals not in 0 to 18");
        return uint8(decimalsDecoded);
    }

    function getGranularity(address tokenToUse) public view returns (uint256 granularity) {
        granularity = 1;
        //support granularity if ERC777
        address implementer = _erc1820.getInterfaceImplementer(tokenToUse, TOKENS_ERC777_HASH);
        if (implementer != address(0)) {
            granularity = IERC777(implementer).granularity();
            //Verify granularity is power of 10 to keep it compatible with ERC20 decimals
            granularityToDecimals(granularity);
        }
        return granularity;
    }

    /* bytes32 (fixed-size array) to string (dynamically-sized array) */
    function bytes32ToString(bytes32 _bytes32) internal pure returns (string memory) {
        uint8 i = 0;
        while(i < 32 && _bytes32[i] != 0) {
            i++;
        }
        bytes memory bytesArray = new bytes(i);
        for (i = 0; i < 32 && _bytes32[i] != 0; i++) {
            bytesArray[i] = _bytes32[i];
        }
        return string(bytesArray);
    }

    function decimalsToGranularity(uint8 decimals) public pure returns (uint256) {
        require(decimals <= 18, "Utils: Decimals not in 0 to 18");
        return uint256(10)**(18-decimals);
    }

    function granularityToDecimals(uint256 granularity) public pure returns (uint8) {
        if(granularity == 1) return 18;
        if(granularity == 10) return 17;
        if(granularity == 100) return 16;
        if(granularity == 1000) return 15;
        if(granularity == 10000) return 14;
        if(granularity == 100000) return 13;
        if(granularity == 1000000) return 12;
        if(granularity == 10000000) return 11;
        if(granularity == 100000000) return 10;
        if(granularity == 1000000000) return 9;
        if(granularity == 10000000000) return 8;
        if(granularity == 100000000000) return 7;
        if(granularity == 1000000000000) return 6;
        if(granularity == 10000000000000) return 5;
        if(granularity == 100000000000000) return 4;
        if(granularity == 1000000000000000) return 3;
        if(granularity == 10000000000000000) return 2;
        if(granularity == 100000000000000000) return 1;
        if(granularity == 1000000000000000000) return 0;
        require(false, "Utils: invalid granularity");
    }

    function calculateGranularityAndAmount(uint8 decimals, uint256 granularity, uint256 amount) external pure
        returns(uint256 calculatedGranularity, uint256 formattedAmount) {

        if(decimals == 18) {
            //tokenAddress is a ERC20 with 18 decimals should have 1 granularity
            //tokenAddress is a ERC777 token we give the same granularity
            calculatedGranularity = granularity;
            formattedAmount = amount;
        } else {
            //tokenAddress is a ERC20 with other than 18 decimals
            calculatedGranularity = decimalsToGranularity(decimals);
            formattedAmount = amount.mul(calculatedGranularity);
        }
    }

    function calculateDecimalsAndAmount(address tokenAddress, uint256 granularity, uint256 amount)
        external view returns (uint8 calculatedDecimals, uint256 formattedAmount) {
        uint8 tokenDecimals = getDecimals(tokenAddress);
        //As side tokens are ERC777 we need to convert granularity to decimals
        calculatedDecimals = granularityToDecimals(granularity);
        require(tokenDecimals == calculatedDecimals, "Utils: Token decimals differ from decimals obtained from granularity");
        formattedAmount = amount.div(granularity);
    }

}

// File: contracts/Briidge.sol

pragma solidity ^0.5.0;

// Import base Initializable contract

// Import interface and library from OpenZeppelin contracts















contract Bridge is
    Initializable,
    IBridge,
    IERC777Recipient,
    UpgradablePausable,
    UpgradableOwnable,
    ReentrancyGuard
{
    using SafeMath for uint256;
    using SafeERC20 for IERC20;
    using Address for address;

    address private constant NULL_ADDRESS = address(0);
    bytes32 private constant NULL_HASH = bytes32(0);
    IERC1820Registry private constant erc1820 =
        IERC1820Registry(0x1820a4B7618BdE71Dce8cdc73aAB6C95905faD24);

    address private federation;
    string public symbolPrefix;
    uint256 public lastDay;
    uint256 public spentToday;

    mapping(address => ISideToken) public mappedTokens; // OirignalToken => SideToken
    mapping(address => address) public originalTokens; // SideToken => OriginalToken
    mapping(address => bool) public knownTokens; // OriginalToken => true
    mapping(bytes32 => bool) public processed; // ProcessedHash => true
    IAllowTokens public allowTokens;
    ISideTokenFactory public sideTokenFactory;
   
    bool public initialPrefixSetup;
    bool public isSuffix;
    bool private ethFirstTransfer;
    uint256 public ethFeeCollected;
    address private WETHAddr;
    string private nativeTokenSymbol;

    event FederationChanged(address _newFederation);
    event SideTokenFactoryChanged(address _newSideTokenFactory);

    event AllowTokenChanged(address _newAllowToken);
    //event PrefixUpdated(bool _isSuffix, string _prefix);

    // We are not using this initializer anymore because we are upgrading.
        function initialize(
            address _manager,
            address _federation,
            address _allowTokens,
            address _sideTokenFactory,
            string memory _symbolPrefix
        ) public initializer {
            UpgradableOwnable.initialize(_manager);
            UpgradablePausable.initialize(_manager);
            symbolPrefix = _symbolPrefix;
            allowTokens = IAllowTokens(_allowTokens);
            _changeSideTokenFactory(_sideTokenFactory);
            _changeFederation(_federation);
            //keccak256("ERC777TokensRecipient")
            erc1820.setInterfaceImplementer(address(this), 0xb281fc8c12954d22544db45de3159a39272895b169a852b314f9cc762e44c53b, address(this));
        }

    function version() external pure returns (string memory) {
        return "v0";
    }

    modifier onlyFederation() {
        require(msg.sender == federation, "Bridge: Sender not Federation");
        _;
    }


    function acceptTransfer(
        address tokenAddress,
        address receiver,
        uint256 amount,
        string calldata symbol,
        bytes32 blockHash,
        bytes32 transactionHash,
        uint32 logIndex,
        uint8 decimals,
        uint256 granularity
    ) external returns (bool) {
        return
            _acceptTransfer(
                tokenAddress,
                receiver,
                amount,
                symbol,
                blockHash,
                transactionHash,
                logIndex,
                decimals,
                granularity,
                ""
            );
    }

    function acceptTransferAt(
        address tokenAddress,
        address receiver,
        uint256 amount,
        string calldata symbol,
        bytes32 blockHash,
        bytes32 transactionHash,
        uint32 logIndex,
        uint8 decimals,
        uint256 granularity,
        bytes calldata userData
    ) external returns (bool) {
        return
            _acceptTransfer(
                tokenAddress,
                receiver,
                amount,
                symbol,
                blockHash,
                transactionHash,
                logIndex,
                decimals,
                granularity,
                userData
            );
    }

    function _acceptTransfer(
        address tokenAddress,
        address receiver,
        uint256 amount,
        string memory symbol,
        bytes32 blockHash,
        bytes32 transactionHash,
        uint32 logIndex,
        uint8 decimals,
        uint256 granularity,
        bytes memory userData
    ) internal onlyFederation whenNotPaused nonReentrant returns (bool) {
        require(tokenAddress != NULL_ADDRESS, "Bridge: Token is null");
        require(receiver != NULL_ADDRESS, "Bridge: Receiver is null");
        require(amount > 0, "Bridge: Amount 0");
        require(bytes(symbol).length > 0, "Bridge: Empty symbol");
        require(blockHash != NULL_HASH, "Bridge: BlockHash is null");
        require(transactionHash != NULL_HASH, "Bridge: Transaction is null");
        require(decimals <= 18, "Bridge: Decimals bigger 18");
        require(
            Utils.granularityToDecimals(granularity) <= 18,
            "Bridge: invalid granularity"
        );

        _processTransaction(
            blockHash,
            transactionHash,
            receiver,
            amount,
            logIndex
        );

        if (knownTokens[tokenAddress]) {
            _acceptCrossBackToToken(
                receiver,
                tokenAddress,
                decimals,
                granularity,
                amount
            );
        } else {
            _acceptCrossToSideToken(
                receiver,
                tokenAddress,
                decimals,
                granularity,
                amount,
                symbol,
                userData
            );
        }
        return true;
    }

    function _acceptCrossToSideToken(
        address receiver,
        address tokenAddress,
        uint8 decimals,
        uint256 granularity,
        uint256 amount,
        string memory symbol,
        bytes memory userData
    ) private {
        (uint256 calculatedGranularity, uint256 formattedAmount) =
            Utils.calculateGranularityAndAmount(decimals, granularity, amount);
        ISideToken sideToken = mappedTokens[tokenAddress];
        if (address(sideToken) == NULL_ADDRESS) {
            sideToken = _createSideToken(
                tokenAddress,
                symbol,
                calculatedGranularity
            );
        } else {
            require(
                calculatedGranularity == sideToken.granularity(),
                "Bridge: Granularity differ from side token"
            );
        }
        sideToken.mint(receiver, formattedAmount, userData, "");

        if (receiver.isContract()) {
            (bool success, bytes memory errorData) =
                receiver.call(
                    abi.encodeWithSignature(
                        "onTokensMinted(uint256,address,bytes)",
                        formattedAmount,
                        sideToken,
                        userData
                    )
                );
            if (!success) {
                emit ErrorTokenReceiver(errorData);
            }
        }

        emit AcceptedCrossTransfer(
            tokenAddress,
            receiver,
            amount,
            decimals,
            granularity,
            formattedAmount,
            18,
            calculatedGranularity,
            userData
        );
    }

    function _acceptCrossBackToToken(
        address receiver,
        address tokenAddress,
        uint8 decimals,
        uint256 granularity,
        uint256 amount
    ) private {
        require(decimals == 18, "Bridge: Invalid decimals cross back");
        //As side tokens are ERC777 we need to convert granularity to decimals
        (uint8 calculatedDecimals, uint256 formattedAmount) =
            Utils.calculateDecimalsAndAmount(tokenAddress, granularity, amount);
        if (tokenAddress == WETHAddr) {
            address payable payableReceiver = address(uint160(receiver));
            payableReceiver.transfer(amount);
        } else {
            IERC20(tokenAddress).safeTransfer(receiver, formattedAmount);
        }
        emit AcceptedCrossTransfer(
            tokenAddress,
            receiver,
            amount,
            decimals,
            granularity,
            formattedAmount,
            calculatedDecimals,
            1,
            ""
        );
    }

    /**
     * ERC-20 tokens approve and transferFrom pattern
     * See https://eips.ethereum.org/EIPS/eip-20#transferfrom
     */
    function receiveTokensAt(
        address tokenToUse,
        uint256 amount,
        address receiver,
        bytes calldata extraData
    ) external returns (bool) {
        return _receiveTokens(tokenToUse, amount, receiver, extraData);
    }

    /**
     * ERC-20 tokens approve and transferFrom pattern
     * See https://eips.ethereum.org/EIPS/eip-20#transferfrom
     */
    function receiveTokens(address tokenToUse, uint256 amount)
        external
        returns (bool)
    {
        return _receiveTokens(tokenToUse, amount, _msgSender(), "");
    }

    /**
     * ERC-20 tokens approve and transferFrom pattern
     * See https://eips.ethereum.org/EIPS/eip-20#transferfrom
     */
    function _receiveTokens(
        address tokenToUse,
        uint256 amount,
        address receiver,
        bytes memory extraData
    ) private  whenNotPaused nonReentrant returns (bool) {
        require(tokenToUse != WETHAddr, "Bridge: Cannot transfer WETH");
        //Transfer the tokens on IERC20, they should be already Approved for the bridge Address to use them
        IERC20(tokenToUse).safeTransferFrom(
            _msgSender(),
            address(this),
            amount
        );
        crossTokens(tokenToUse, receiver, amount, extraData);
        return true;
    }

    /**
     * ERC-777 tokensReceived hook allows to send tokens to a contract and notify it in a single transaction
     * See https://eips.ethereum.org/EIPS/eip-777#motivation for details
     */
    function tokensReceived(
        address operator,
        address from,
        address to,
        uint256 amount,
        bytes calldata userData,
        bytes calldata
    ) external whenNotPaused nonReentrant  {
        //Hook from ERC777address
        if (operator == address(this)) return; // Avoid loop from bridge calling to ERC77transferFrom
        require(to == address(this), "Bridge: Not to address");
        address tokenToUse = _msgSender();
        require(tokenToUse != WETHAddr, "Bridge: Cannot transfer WETH");
        //This can only be used with trusted contracts
        crossTokens(tokenToUse, from, amount, userData);
    }

    function crossTokens(
        address tokenToUse,
        address receiver,
        uint256 amount,
        bytes memory userData
    ) private {
        bool isASideToken = originalTokens[tokenToUse] != NULL_ADDRESS;
        uint256 fee = allowTokens.getFeePerToken(tokenToUse);
        if (fee > 0) {
            if (tokenToUse == WETHAddr) {
                ethFeeCollected = ethFeeCollected.add(fee);
            } else {
                //Send the payment to the MultiSig of the Federation
                IERC20(tokenToUse).safeTransfer(owner(), fee);
            }
        }
        uint256 amountMinusFees = amount.sub(fee);
        if (isASideToken) {
            verifyWithAllowTokens(tokenToUse, amount, isASideToken);
            //Side Token Crossing
            ISideToken(tokenToUse).burn(amountMinusFees, userData);
            // solium-disable-next-line max-len
            emit Cross(
                originalTokens[tokenToUse],
                receiver,
                amountMinusFees,
                ISideToken(tokenToUse).symbol(),
                userData,
                ISideToken(tokenToUse).decimals(),
                ISideToken(tokenToUse).granularity()
            );
        } else {
            //Main Token Crossing
            uint8 decimals;
            uint256 granularity;
            string memory symbol;

            knownTokens[tokenToUse] = true;
            if (tokenToUse == WETHAddr) {
                decimals = 18;
                granularity = 1;
                symbol = nativeTokenSymbol;
            } else {
                (decimals, granularity, symbol) = Utils.getTokenInfo(
                    tokenToUse
                );
            }
            uint256 formattedAmount = amount;
            if (decimals != 18) {
                formattedAmount = amount.mul(uint256(10)**(18 - decimals));
            }
            //We consider the amount before fees converted to 18 decimals to check the limits
            verifyWithAllowTokens(tokenToUse, formattedAmount, isASideToken);
            emit Cross(
                tokenToUse,
                receiver,
                amountMinusFees,
                symbol,
                userData,
                decimals,
                granularity
            );
        }
    }

    function _createSideToken(
        address token,
        string memory symbol,
        uint256 granularity
    ) private returns (ISideToken sideToken) {
        initialPrefixSetup = true;
        string memory newSymbol;
        if (!isSuffix) {
            newSymbol = string(abi.encodePacked(symbolPrefix, symbol));
        } else {
            newSymbol = string(abi.encodePacked(symbol, symbolPrefix));
        }

        address sideTokenAddress =
            sideTokenFactory.createSideToken(newSymbol, newSymbol, granularity);
        sideToken = ISideToken(sideTokenAddress);
        mappedTokens[token] = sideToken;
        originalTokens[sideTokenAddress] = token;
        emit NewSideToken(sideTokenAddress, token, newSymbol, granularity);
        return sideToken;
    }

    function verifyWithAllowTokens(
        address tokenToUse,
        uint256 amount,
        bool isASideToken
    ) private {
        // solium-disable-next-line security/no-block-members
        if (now > lastDay + 24 hours) {
            // solium-disable-next-line security/no-block-members
            lastDay = now;
            spentToday = 0;
        }
        require(
            allowTokens.isValidTokenTransfer(
                tokenToUse,
                amount,
                spentToday,
                isASideToken
            ),
            "Bridge: Validation limit increase/decrease or Tokens fee doesn't set or token fee=0"
        );
        spentToday = spentToday.add(amount);
    }

    function getTransactionId(
        bytes32 _blockHash,
        bytes32 _transactionHash,
        address _receiver,
        uint256 _amount,
        uint32 _logIndex
    ) public pure returns (bytes32) {
        return
            keccak256(
                abi.encodePacked(
                    _blockHash,
                    _transactionHash,
                    _receiver,
                    _amount,
                    _logIndex
                )
            );
    }

    function _processTransaction(
        bytes32 _blockHash,
        bytes32 _transactionHash,
        address _receiver,
        uint256 _amount,
        uint32 _logIndex
    ) private {
        bytes32 compiledId =
            getTransactionId(
                _blockHash,
                _transactionHash,
                _receiver,
                _amount,
                _logIndex
            );
        require(!processed[compiledId], "Bridge: Already processed");
        processed[compiledId] = true;
    }



    function calcMaxWithdraw() external view returns (uint256) {
        uint256 spent = spentToday;
        // solium-disable-next-line security/no-block-members
        if (now > lastDay + 24 hours) spent = 0;
        return allowTokens.calcMaxWithdraw(spent);
    }

    function changeFederation(address newFederation)
        external
        onlyOwner
        returns (bool)
    {
        _changeFederation(newFederation);
        return true;
    }

    function _changeFederation(address newFederation) internal {
        require(newFederation != NULL_ADDRESS, "Bridge: Federation is empty");
        federation = newFederation;
        emit FederationChanged(federation);
    }

    function getFederation() external view returns (address) {
        return federation;
    }

    function changeSideTokenFactory(address newSideTokenFactory)
        external
        onlyOwner
        returns (bool)
    {
        _changeSideTokenFactory(newSideTokenFactory);
        return true;
    }

    function _changeSideTokenFactory(address newSideTokenFactory) internal {
        require(
            newSideTokenFactory != NULL_ADDRESS,
            "Bridge: SideTokenFactory is empty"
        );
        sideTokenFactory = ISideTokenFactory(newSideTokenFactory);
        emit SideTokenFactoryChanged(newSideTokenFactory);
    }

    function receiveEthAt(address _receiver, bytes calldata _extraData)
        external
        payable
        whenNotPaused
        nonReentrant
    {
        require(
            msg.value > 0 &&
                !(Address.isContract(msg.sender)) &&
                (WETHAddr != address(0)),
            "Set WETHAddr. Send not from SC"
        );
        if (!ethFirstTransfer) {
            ethFirstTransfer = true;
        }
        crossTokens(WETHAddr, _receiver, msg.value, _extraData);
    }

    //     if(aggregatorAddr != address(0)){
    //         crossTokens(WETHAddr, aggregatorAddr, msg.value, abi.encodePacked(msg.sender));
    //     }
    //     else {
    //         bytes memory _userData = "";
    //         crossTokens(WETHAddr, msg.sender, msg.value, _userData);
    //     }
    // }
    // function setAggregatorAddr(address _aggregatorAddr) external onlyOwner {
    //     aggregatorAddr = _aggregatorAddr;
    // }

    function setWETHAddress(address _WETHAddr) external onlyOwner {
        require(
            _WETHAddr != address(0) && !ethFirstTransfer,
            "No set WETHAddr AF 1st transfer"
        );
        //require(!ethFirstTransfer, "cannot change WETHAddr after first transfer");
        WETHAddr = _WETHAddr;
    }

    function changeAllowTokens(address newAllowTokens)
        external
        onlyOwner
        returns (bool)
    {
        _changeAllowTokens(newAllowTokens);
        return true;
    }

    function _changeAllowTokens(address newAllowTokens) internal {
        require(
            newAllowTokens != NULL_ADDRESS,
            "Bridge: newAllowTokens is empty"
        );
        allowTokens = IAllowTokens(newAllowTokens);
        //emit AllowTokenChanged(newAllowTokens);
    }

    function initialSymbolPrefixSetup(bool _isSuffix, string calldata _prefix)
        external
        onlyOwner
    {
        require(!initialPrefixSetup, "Bridge: initialPrefixSetup Done");
        isSuffix = _isSuffix;
        symbolPrefix = _prefix;
        //emit PrefixUpdated(isSuffix, _prefix);
    }

    function withdrawAllEthFees(address payable _to) public payable onlyOwner {
        require(address(this).balance >= ethFeeCollected);
        ethFeeCollected = 0;
        _to.transfer(ethFeeCollected);
    }

    function setNativeTokenSymbol(string calldata _nativeTokenSymbol)
        external
        onlyOwner
    {
        nativeTokenSymbol = _nativeTokenSymbol;
    }

    function getNativeTokenSymbol() external view returns (string memory) {
        return nativeTokenSymbol;
    }

    // Commented because it is unused for us and need decrease contract size
    //This method is only to recreate the USDT and USDC tokens on rsk without granularity restrictions.
    //    function clearSideToken() external onlyOwner returns(bool) {
    //        require(!alreadyRun, "already done");
    //        alreadyRun = true;
    //        address payable[4] memory sideTokens = [
    //            0xe506F698b31a66049BD4653ed934E7a07Cbc5549,
    //            0x5a42221D7AaE8e185BC0054Bb036D9757eC18857,
    //            0xcdc8ccBbFB6407c53118fE47259e8d00C81F42CD,
    //            0x6117C9529F15c52e2d3188d5285C745B757b5825
    //        ];
    //        for (uint i = 0; i < sideTokens.length; i++) {
    //            address originalToken = address(originalTokens[sideTokens[i]]);
    //            originalTokens[sideTokens[i]] = NULL_ADDRESS;
    //            mappedTokens[originalToken] = ISideToken(NULL_ADDRESS);
    //        }
    //        return true;
    //    }
}
