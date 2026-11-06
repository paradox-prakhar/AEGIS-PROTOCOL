// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
/// @notice Prototype evidence registry. No asset freeze or recovery authority.
/// @dev Reviewer is a trust assumption; use a reviewed multisig before deployment.
contract AegisRegistry {
    enum Status { Pending, Challenged, Confirmed, Rejected }
    struct Report { address reporter; address subject; bytes32 evidenceHash; uint64 createdAt; Status status; }
    address public immutable reviewer;
    uint256 public constant REVIEW_DELAY = 2 days;
    Report[] public reports;
    mapping(uint256 => mapping(address => bool)) public challenged;
    event Submitted(uint256 indexed id, address indexed subject, bytes32 evidenceHash);
    event Challenge(uint256 indexed id, address indexed challenger, bytes32 evidenceHash);
    event Resolved(uint256 indexed id, Status status);
    constructor(address reviewer_) { require(reviewer_ != address(0), "zero reviewer"); reviewer = reviewer_; }
    function submit(address subject, bytes32 evidenceHash) external returns(uint256 id) {
        require(subject != address(0) && evidenceHash != bytes32(0), "invalid evidence");
        id = reports.length;
        reports.push(Report(msg.sender, subject, evidenceHash, uint64(block.timestamp), Status.Pending));
        emit Submitted(id, subject, evidenceHash);
    }
    function challenge(uint256 id, bytes32 evidenceHash) external {
        Report storage r = reports[id];
        require(r.status == Status.Pending || r.status == Status.Challenged, "closed");
        require(!challenged[id][msg.sender] && evidenceHash != bytes32(0), "invalid challenge");
        challenged[id][msg.sender] = true;
        r.status = Status.Challenged;
        emit Challenge(id, msg.sender, evidenceHash);
    }
    function resolve(uint256 id, bool confirmed) external {
        require(msg.sender == reviewer, "reviewer only");
        Report storage r = reports[id];
        require(r.status == Status.Pending || r.status == Status.Challenged, "closed");
        require(block.timestamp >= r.createdAt + REVIEW_DELAY, "review window");
        r.status = confirmed ? Status.Confirmed : Status.Rejected;
        emit Resolved(id, r.status);
    }
    function reportCount() external view returns(uint256) { return reports.length; }
}
