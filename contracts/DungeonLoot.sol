// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract DungeonLoot is ERC721, ERC721URIStorage, Ownable {
    uint256 private _nextTokenId;

    constructor(address initialOwner) 
        ERC721("Dungeon Loot", "DLOOT") 
        Ownable(initialOwner)
    {}

    function mintItem(address player, string memory _tokenURI)
        public
        onlyOwner
        returns (uint256)
    {
        uint256 tokenId = _nextTokenId++;
        _safeMint(player, tokenId);
        _setTokenURI(tokenId, _tokenURI);
        return tokenId;
    }

    // อัปเดต tokenURI ของ tokenId เดิมตอนตีบวก
    function upgradeItem(uint256 tokenId, string memory _newTokenURI)
        public
        onlyOwner
    {
        _requireOwned(tokenId);
        _setTokenURI(tokenId, _newTokenURI);
    }

    // เผา NFT ทิ้งถาวรบน Blockchain ตอนกดย่อย (Salvage)
    function burnItem(uint256 tokenId)
        public
        onlyOwner
    {
        _requireOwned(tokenId);
        _burn(tokenId);
    }

    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}