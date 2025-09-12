// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract CertificateContract {
    struct Certificate {
        uint256 id;
        address recipient;
        string name;
        string course;
        string institution;
        uint256 dateIssued;
        bool isValid;
        bytes32 documentHash; // ✅ added this field properly
    }

    mapping(uint256 => Certificate) public certificates;
    mapping(address => uint256[]) public recipientCertificates;
    uint256 public nextCertificateId;
    address public owner;

    event CertificateIssued(
        uint256 indexed certificateId,
        address indexed recipient,
        string name,
        string course,
        bytes32 documentHash
    );

    event CertificateRevoked(uint256 indexed certificateId);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can perform this action");
        _;
    }

    modifier validCertificate(uint256 _certificateId) {
        require(_certificateId < nextCertificateId, "Certificate does not exist");
        _;
    }

    constructor() {
        owner = msg.sender;
        nextCertificateId = 1; // Start from 1
    }

    // ✅ Cleaned up issueCertificate (single version only)
    function issueCertificate(
        address _recipient,
        string memory _name,
        string memory _course,
        string memory _institution,
        uint256 _dateIssued,
        bytes32 _documentHash
    ) public onlyOwner returns (uint256) {
        require(_recipient != address(0), "Invalid recipient address");
        require(bytes(_name).length > 0, "Name cannot be empty");
        require(bytes(_course).length > 0, "Course cannot be empty");
        require(bytes(_institution).length > 0, "Institution cannot be empty");
        require(_dateIssued > 0, "Invalid date");

        uint256 certificateId = nextCertificateId;
        nextCertificateId++;

        certificates[certificateId] = Certificate({
            id: certificateId,
            recipient: _recipient,
            name: _name,
            course: _course,
            institution: _institution,
            dateIssued: _dateIssued,
            isValid: true,
            documentHash: _documentHash
        });

        recipientCertificates[_recipient].push(certificateId);

        emit CertificateIssued(certificateId, _recipient, _name, _course, _documentHash);

        return certificateId;
    }

    function getCertificate(uint256 _certificateId)
        public
        view
        validCertificate(_certificateId)
        returns (Certificate memory)
    {
        return certificates[_certificateId];
    }

    function verifyCertificate(uint256 _certificateId)
        public
        view
        validCertificate(_certificateId)
        returns (bool)
    {
        return certificates[_certificateId].isValid;
    }

    function isIssued(bytes32 _documentHash) public view returns (bool) {
        for (uint256 i = 1; i < nextCertificateId; i++) {
            if (certificates[i].documentHash == _documentHash && certificates[i].isValid) {
                return true;
            }
        }
        return false;
    }

    function revokeCertificate(uint256 _certificateId)
        public
        onlyOwner
        validCertificate(_certificateId)
    {
        require(certificates[_certificateId].isValid, "Certificate already revoked");
        certificates[_certificateId].isValid = false;
        emit CertificateRevoked(_certificateId);
    }

    function getRecipientCertificates(address _recipient)
        public
        view
        returns (uint256[] memory)
    {
        return recipientCertificates[_recipient];
    }

    function getTotalCertificates() public view returns (uint256) {
        return nextCertificateId - 1;
    }

    function transferOwnership(address newOwner) public onlyOwner {
        require(newOwner != address(0), "Invalid new owner address");
        owner = newOwner;
    }
}
