// SPDX-License-Identifier: MIT
pragma solidity 0.8.38;

/// @title Aegis evidence registry (v2)
/// @notice Public, append-only registry of address-risk allegations backed by evidence hashes.
///         Reports are allegations until a trusted reviewer resolves them after a review delay.
///         The contract holds no funds and has no power to freeze or recover assets.
/// @dev The reviewer is a trust assumption. In production it should be a reviewed multisig.
///      Reviewer rotation is two-step to avoid transferring control to a mistyped address.
contract AegisRegistry {
    // ---------------------------------------------------------------------
    // Types
    // ---------------------------------------------------------------------

    enum Status {
        Pending,
        Challenged,
        Confirmed,
        Rejected
    }

    struct Report {
        address reporter;
        address subject;
        bytes32 evidenceHash;
        uint64 createdAt;
        uint64 resolvedAt;
        uint32 challengeCount;
        Status status;
    }

    struct SubjectStats {
        uint64 total;
        uint64 open;
        uint64 confirmed;
        uint64 rejected;
    }

    // ---------------------------------------------------------------------
    // Constants
    // ---------------------------------------------------------------------

    uint256 public constant VERSION = 2;
    uint256 public constant REVIEW_DELAY = 2 days;
    uint256 public constant MAX_URI_LENGTH = 256;
    uint256 public constant MAX_PAGE_SIZE = 100;

    // ---------------------------------------------------------------------
    // Storage
    // ---------------------------------------------------------------------

    address public reviewer;
    address public pendingReviewer;
    bool public paused;

    Report[] private _reports;
    mapping(address subject => uint256[] ids) private _subjectReports;
    mapping(address subject => SubjectStats) private _stats;
    mapping(address subject => mapping(address reporter => bool)) public hasOpenReport;
    mapping(uint256 id => mapping(address challenger => bool)) public challenged;

    // ---------------------------------------------------------------------
    // Events
    // ---------------------------------------------------------------------

    event Submitted(
        uint256 indexed id,
        address indexed subject,
        address indexed reporter,
        bytes32 evidenceHash,
        string evidenceURI
    );
    event Challenge(uint256 indexed id, address indexed challenger, bytes32 evidenceHash, string evidenceURI);
    event Resolved(uint256 indexed id, Status status, address indexed reviewer);
    event ReviewerTransferStarted(address indexed currentReviewer, address indexed pendingReviewer);
    event ReviewerTransferred(address indexed previousReviewer, address indexed newReviewer);
    event Paused(address indexed by);
    event Unpaused(address indexed by);

    // ---------------------------------------------------------------------
    // Errors
    // ---------------------------------------------------------------------

    error ZeroAddress();
    error InvalidEvidence();
    error UriTooLong();
    error SelfReport();
    error DuplicateOpenReport();
    error ReportNotFound(uint256 id);
    error ReportClosed(uint256 id);
    error AlreadyChallenged(uint256 id);
    error ReporterCannotChallenge(uint256 id);
    error ReviewWindowActive(uint256 id, uint256 availableAt);
    error NotReviewer();
    error NotPendingReviewer();
    error IsPaused();
    error InvalidPage();

    // ---------------------------------------------------------------------
    // Modifiers
    // ---------------------------------------------------------------------

    modifier onlyReviewer() {
        if (msg.sender != reviewer) revert NotReviewer();
        _;
    }

    modifier whenNotPaused() {
        if (paused) revert IsPaused();
        _;
    }

    constructor(address reviewer_) {
        if (reviewer_ == address(0)) revert ZeroAddress();
        reviewer = reviewer_;
        emit ReviewerTransferred(address(0), reviewer_);
    }

    // ---------------------------------------------------------------------
    // Public writes
    // ---------------------------------------------------------------------

    /// @notice Submit an allegation against `subject`. Only the evidence hash (and an optional URI) is published.
    /// @param subject Address alleged to be malicious.
    /// @param evidenceHash keccak256 of the exact evidence package kept offchain by the reporter.
    /// @param evidenceURI Optional pointer (e.g. ipfs://CID). Must not contain personal data.
    function submit(address subject, bytes32 evidenceHash, string calldata evidenceURI)
        external
        whenNotPaused
        returns (uint256 id)
    {
        if (subject == address(0)) revert ZeroAddress();
        if (evidenceHash == bytes32(0)) revert InvalidEvidence();
        if (bytes(evidenceURI).length > MAX_URI_LENGTH) revert UriTooLong();
        if (subject == msg.sender) revert SelfReport();
        if (hasOpenReport[subject][msg.sender]) revert DuplicateOpenReport();

        id = _reports.length;
        _reports.push(
            Report({
                reporter: msg.sender,
                subject: subject,
                evidenceHash: evidenceHash,
                createdAt: uint64(block.timestamp),
                resolvedAt: 0,
                challengeCount: 0,
                status: Status.Pending
            })
        );
        _subjectReports[subject].push(id);
        hasOpenReport[subject][msg.sender] = true;
        SubjectStats storage st = _stats[subject];
        unchecked {
            st.total += 1;
            st.open += 1;
        }
        emit Submitted(id, subject, msg.sender, evidenceHash, evidenceURI);
    }

    /// @notice Publicly dispute an open report with counter-evidence.
    function challenge(uint256 id, bytes32 evidenceHash, string calldata evidenceURI) external whenNotPaused {
        Report storage r = _get(id);
        if (r.status != Status.Pending && r.status != Status.Challenged) revert ReportClosed(id);
        if (evidenceHash == bytes32(0)) revert InvalidEvidence();
        if (bytes(evidenceURI).length > MAX_URI_LENGTH) revert UriTooLong();
        if (r.reporter == msg.sender) revert ReporterCannotChallenge(id);
        if (challenged[id][msg.sender]) revert AlreadyChallenged(id);

        challenged[id][msg.sender] = true;
        unchecked {
            r.challengeCount += 1;
        }
        r.status = Status.Challenged;
        emit Challenge(id, msg.sender, evidenceHash, evidenceURI);
    }

    // ---------------------------------------------------------------------
    // Reviewer actions
    // ---------------------------------------------------------------------

    /// @notice Resolve an open report after the review delay. Allowed while paused so adjudication can continue.
    function resolve(uint256 id, bool confirmed) external onlyReviewer {
        Report storage r = _get(id);
        if (r.status != Status.Pending && r.status != Status.Challenged) revert ReportClosed(id);
        uint256 availableAt = uint256(r.createdAt) + REVIEW_DELAY;
        if (block.timestamp < availableAt) revert ReviewWindowActive(id, availableAt);

        r.status = confirmed ? Status.Confirmed : Status.Rejected;
        r.resolvedAt = uint64(block.timestamp);
        hasOpenReport[r.subject][r.reporter] = false;
        SubjectStats storage st = _stats[r.subject];
        unchecked {
            st.open -= 1;
            if (confirmed) st.confirmed += 1;
            else st.rejected += 1;
        }
        emit Resolved(id, r.status, msg.sender);
    }

    function pause() external onlyReviewer {
        paused = true;
        emit Paused(msg.sender);
    }

    function unpause() external onlyReviewer {
        paused = false;
        emit Unpaused(msg.sender);
    }

    /// @notice Step 1 of reviewer rotation. Pass address(0) to cancel a pending transfer.
    function transferReviewer(address newReviewer) external onlyReviewer {
        pendingReviewer = newReviewer;
        emit ReviewerTransferStarted(msg.sender, newReviewer);
    }

    /// @notice Step 2 of reviewer rotation, called by the nominated address.
    function acceptReviewer() external {
        if (msg.sender != pendingReviewer || msg.sender == address(0)) revert NotPendingReviewer();
        address previous = reviewer;
        reviewer = msg.sender;
        pendingReviewer = address(0);
        emit ReviewerTransferred(previous, msg.sender);
    }

    // ---------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------

    function reportCount() external view returns (uint256) {
        return _reports.length;
    }

    function reports(uint256 id) external view returns (Report memory) {
        return _getView(id);
    }

    /// @notice Page through all reports in id order.
    function getReports(uint256 offset, uint256 limit) external view returns (Report[] memory page) {
        if (limit == 0 || limit > MAX_PAGE_SIZE) revert InvalidPage();
        uint256 total = _reports.length;
        if (offset >= total) return new Report[](0);
        uint256 end = offset + limit > total ? total : offset + limit;
        page = new Report[](end - offset);
        for (uint256 i = offset; i < end; ++i) {
            page[i - offset] = _reports[i];
        }
    }

    function subjectReportCount(address subject) external view returns (uint256) {
        return _subjectReports[subject].length;
    }

    /// @notice Page through the ids of every report filed against `subject` (complete history, no truncation).
    function reportIdsOf(address subject, uint256 offset, uint256 limit) external view returns (uint256[] memory ids) {
        if (limit == 0 || limit > MAX_PAGE_SIZE) revert InvalidPage();
        uint256[] storage all = _subjectReports[subject];
        uint256 total = all.length;
        if (offset >= total) return new uint256[](0);
        uint256 end = offset + limit > total ? total : offset + limit;
        ids = new uint256[](end - offset);
        for (uint256 i = offset; i < end; ++i) {
            ids[i - offset] = all[i];
        }
    }

    /// @notice O(1) aggregate used by wallet screening; covers the subject's complete history.
    function subjectSummary(address subject) external view returns (SubjectStats memory) {
        return _stats[subject];
    }

    // ---------------------------------------------------------------------
    // Internal
    // ---------------------------------------------------------------------

    function _get(uint256 id) private view returns (Report storage) {
        if (id >= _reports.length) revert ReportNotFound(id);
        return _reports[id];
    }

    function _getView(uint256 id) private view returns (Report memory) {
        if (id >= _reports.length) revert ReportNotFound(id);
        return _reports[id];
    }
}
