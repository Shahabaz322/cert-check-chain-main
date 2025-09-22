// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract CertificateContract {
    struct Certificate {
        uint256 id;
        string rollNumber;
        address recipient; // Optional: can be set later when student claims certificate
        string name;
        string course;
        string institution;
        uint256 dateIssued;
        bool isValid;
        bytes32 documentHash;
        bool isClaimed; // Track if student has claimed this certificate
    }

    mapping(uint256 => Certificate) public certificates;
    mapping(string => uint256[]) public rollNumberCertificates; // Roll number to certificate IDs
    mapping(address => uint256[]) public recipientCertificates; // Address to certificate IDs
    mapping(bytes32 => uint256) public hashToCertificateId; // Hash to certificate ID for quick lookup
    mapping(string => bool) public rollNumberExists; // Check if roll number has any certificates
    
    uint256 public nextCertificateId;
    address public owner;

    event CertificateIssued(
        uint256 indexed certificateId,
        string indexed rollNumber,
        string name,
        string course,
        bytes32 documentHash
    );

    event CertificateRevoked(uint256 indexed certificateId);
    
    event CertificateClaimed(
        uint256 indexed certificateId,
        string indexed rollNumber,
        address indexed recipient
    );

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

    function issueCertificate(
        string memory _rollNumber,
        string memory _name,
        string memory _course,
        string memory _institution,
        uint256 _dateIssued,
        bytes32 _documentHash
    ) public onlyOwner returns (uint256) {
        require(bytes(_rollNumber).length > 0, "Roll number cannot be empty");
        require(bytes(_name).length > 0, "Name cannot be empty");
        require(bytes(_course).length > 0, "Course cannot be empty");
        require(bytes(_institution).length > 0, "Institution cannot be empty");
        require(_dateIssued > 0, "Invalid date");
        require(_documentHash != bytes32(0), "Invalid document hash");
        require(hashToCertificateId[_documentHash] == 0, "Certificate with this hash already exists");

        uint256 certificateId = nextCertificateId;
        nextCertificateId++;

        certificates[certificateId] = Certificate({
            id: certificateId,
            rollNumber: _rollNumber,
            recipient: address(0), // Initially no recipient address
            name: _name,
            course: _course,
            institution: _institution,
            dateIssued: _dateIssued,
            isValid: true,
            documentHash: _documentHash,
            isClaimed: false
        });

        rollNumberCertificates[_rollNumber].push(certificateId);
        hashToCertificateId[_documentHash] = certificateId;
        rollNumberExists[_rollNumber] = true;

        emit CertificateIssued(certificateId, _rollNumber, _name, _course, _documentHash);

        return certificateId;
    }

    // Allow students to claim their certificates by providing their roll number
    function claimCertificate(string memory _rollNumber, uint256 _certificateId) 
        public 
        validCertificate(_certificateId) 
    {
        Certificate storage cert = certificates[_certificateId];
        require(keccak256(abi.encodePacked(cert.rollNumber)) == keccak256(abi.encodePacked(_rollNumber)), 
                "Roll number doesn't match");
        require(!cert.isClaimed, "Certificate already claimed");
        require(cert.isValid, "Certificate is not valid");

        cert.recipient = msg.sender;
        cert.isClaimed = true;
        recipientCertificates[msg.sender].push(_certificateId);

        emit CertificateClaimed(_certificateId, _rollNumber, msg.sender);
    }

    function getCertificate(uint256 _certificateId)
        public
        view
        validCertificate(_certificateId)
        returns (Certificate memory)
    {
        return certificates[_certificateId];
    }

    function getCertificateByHash(bytes32 _documentHash)
        public
        view
        returns (Certificate memory)
    {
        uint256 certificateId = hashToCertificateId[_documentHash];
        require(certificateId != 0, "Certificate not found");
        return certificates[certificateId];
    }

    function verifyCertificate(uint256 _certificateId)
        public
        view
        validCertificate(_certificateId)
        returns (bool)
    {
        return certificates[_certificateId].isValid;
    }

    function verifyCertificateByHash(bytes32 _documentHash)
        public
        view
        returns (bool)
    {
        uint256 certificateId = hashToCertificateId[_documentHash];
        if (certificateId == 0) return false;
        return certificates[certificateId].isValid;
    }

    function verifyCertificateByRollNumber(string memory _rollNumber, bytes32 _documentHash)
        public
        view
        returns (bool)
    {
        uint256 certificateId = hashToCertificateId[_documentHash];
        if (certificateId == 0) return false;
        
        Certificate memory cert = certificates[certificateId];
        return cert.isValid && 
               keccak256(abi.encodePacked(cert.rollNumber)) == keccak256(abi.encodePacked(_rollNumber));
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

    function getRollNumberCertificates(string memory _rollNumber)
        public
        view
        returns (uint256[] memory)
    {
        return rollNumberCertificates[_rollNumber];
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

    // Check if a roll number has any certificates
    function hasRollNumber(string memory _rollNumber) public view returns (bool) {
        return rollNumberExists[_rollNumber];
    }
}