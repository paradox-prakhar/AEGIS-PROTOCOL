// SPDX-License-Identifier: MIT
pragma solidity 0.8.38;
import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {IERC20Metadata} from '@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol';
import {SafeERC20} from '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import {ReentrancyGuard} from '@openzeppelin/contracts/utils/ReentrancyGuard.sol';
interface IAegisV2 {
 struct Report {address reporter;address subject;bytes32 evidenceHash;uint64 createdAt;uint64 resolvedAt;uint32 challengeCount;uint8 status;}
 function VERSION() external view returns(uint256);
 function reports(uint256 id) external view returns(Report memory);
}
/// @notice Testnet-only, unaudited companion staking pool. Trusted registry decisions determine payouts.
contract AegisReportStake is ReentrancyGuard {
 using SafeERC20 for IERC20;
 IAegisV2 public immutable registry;
 IERC20 public immutable token;
 uint256 public constant TIMEOUT=30 days;
 uint256 public constant MIN_STAKE=1e6;
 struct Pool{uint256 yes;uint256 no;bool refundMode;}
 struct Position{uint256 yes;uint256 no;bool claimed;}
 mapping(uint256=>Pool)public pools;
 mapping(uint256=>mapping(address=>Position))public positions;
 event Staked(uint256 indexed reportId,address indexed user,bool support,uint256 amount);
 event Claimed(uint256 indexed reportId,address indexed user,uint256 amount,bool refund);
 constructor(address registry_,address token_){require(registry_!=address(0)&&token_!=address(0),'zero address');registry=IAegisV2(registry_);require(registry.VERSION()==2,'v2 required');require(IERC20Metadata(token_).decimals()==6,'6 decimals required');token=IERC20(token_);}
 function stake(uint256 id,bool support,uint256 amount)external nonReentrant{
  IAegisV2.Report memory report=registry.reports(id);require(report.status<2,'closed');require(block.timestamp<uint256(report.createdAt)+TIMEOUT,'expired');require(amount>=MIN_STAKE,'minimum 1 USDC');Pool storage p=pools[id];require(!p.refundMode,'refunding');Position storage position=positions[id][msg.sender];require(!position.claimed,'claimed');
  uint256 beforeBalance=token.balanceOf(address(this));token.safeTransferFrom(msg.sender,address(this),amount);require(token.balanceOf(address(this))-beforeBalance==amount,'unsupported fee token');
  if(support){p.yes+=amount;position.yes+=amount;}else{p.no+=amount;position.no+=amount;}emit Staked(id,msg.sender,support,amount);
 }
 function claim(uint256 id)external nonReentrant{
  IAegisV2.Report memory report=registry.reports(id);Pool storage p=pools[id];Position storage position=positions[id][msg.sender];require(!position.claimed&&position.yes+position.no>0,'no claim');
  if(report.status<2){require(block.timestamp>=uint256(report.createdAt)+TIMEOUT,'not resolved');p.refundMode=true;}
  uint256 winningTotal=report.status==2?p.yes:p.no;bool refund=p.refundMode||winningTotal==0;
  uint256 amount=refund?position.yes+position.no:(report.status==2?position.yes:position.no)*(p.yes+p.no)/winningTotal;
  position.claimed=true;if(amount>0)token.safeTransfer(msg.sender,amount);emit Claimed(id,msg.sender,amount,refund);
 }
}
