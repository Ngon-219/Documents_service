import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import FormData from "form-data";
import got from "got";

interface PinataUploadResponse {
  IpfsHash: string;
  PinSize: number;
  Timestamp: string;
}

interface PinataV3UploadResponse {
  data: {
    id: string;
    name: string;
    cid: string;
    size: number;
    created_at: string;
  };
}

@Injectable()
export class IPFSService {
  private readonly logger = new Logger(IPFSService.name);
  private readonly useMock: boolean;
  private readonly pinataJwt: string;
  private readonly pinataGateway: string;

  constructor(private configService: ConfigService) {
    this.pinataJwt = this.configService.get<string>('PINATA_JWT') || '';
    this.pinataGateway = this.configService.get<string>('PINATA_GATEWAY') || 'gateway.pinata.cloud';
  }

  async uploadFile(
    buffer: Buffer,
    fileName: string,
    keyvalues?: Record<string, any>,
  ): Promise<string> {
      let data = new FormData();
      const url = `https://uploads.pinata.cloud/v3/files`;
      
      // Append buffer directly (FormData accepts Buffer)
      data.append('file', buffer, {
        filename: fileName,
        contentType: 'application/octet-stream',
      });
      data.append('network', 'public');
      
      this.logger.log(`Uploading file to IPFS: ${fileName} (${buffer.length} bytes)`);

      const response = await got(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.pinataJwt}`,
        },
        body: data,
      }).on("uploadProgress", (progress) => {
        console.log(progress);
      });
      const result: PinataV3UploadResponse = JSON.parse(response.body);
      const ipfsHash = result.data.cid;
      return ipfsHash;
  }

  /**
   * Upload JSON metadata to IPFS using Pinata
   * @param metadata - JSON object to upload
   * @param name - Optional custom name for the file
   * @param keyvalues - Optional metadata for searching (key-value pairs)
   * @returns IPFS CID (hash)
   */
  async uploadMetadata(
    metadata: any,
    name?: string,
    keyvalues?: Record<string, any>,
  ): Promise<string> {
    if (this.useMock) {
      return this.mockUpload(metadata);
    }

    try {
      // Convert JSON metadata to Buffer and upload as file using v3 API
      const jsonString = JSON.stringify(metadata, null, 2);
      const buffer = Buffer.from(jsonString, 'utf-8');
      const fileName = name || `metadata-${Date.now()}.json`;
      
      const FormData = require('form-data');
      const formData = new FormData();
      
      formData.append('file', buffer, { 
        filename: fileName,
        contentType: 'application/json'
      });
      formData.append('network', 'public');

      const response = await fetch('https://uploads.pinata.cloud/v3/files', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.pinataJwt}`,
          ...formData.getHeaders(),
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Pinata upload failed: ${response.statusText} - ${errorData}`);
      }

      const result: PinataV3UploadResponse = await response.json();
      const ipfsHash = result.data.cid;
      
      this.logger.log(`📌 Successfully uploaded metadata to IPFS: ${ipfsHash}`);
      this.logger.debug(`📊 Metadata details - CID: ${ipfsHash}, Size: ${result.data.size} bytes`);
      
      return ipfsHash;
    } catch (error) {
      this.logger.error('❌ Failed to upload metadata to IPFS via Pinata', error);
      throw new Error(`IPFS upload failed: ${error.message}`);
    }
  }

  /**
   * Retrieve metadata from IPFS
   * Uses Pinata gateway or public IPFS gateway
   */
  async getMetadata(ipfsHash: string): Promise<any> {
    if (this.useMock) {
      this.logger.warn(`Mock mode: Cannot retrieve actual data for hash ${ipfsHash}`);
      return { mock: true, hash: ipfsHash };
    }

    try {
      // Use Pinata gateway if configured, otherwise use public gateway
      const gateway = this.configService.get<string>('PINATA_GATEWAY') || 'gateway.pinata.cloud';
      const url = `https://${gateway}/ipfs/${ipfsHash}`;
      
      this.logger.log(`Fetching metadata from: ${url}`);
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch from IPFS: ${response.statusText}`);
      }
      
      const data = await response.json();
      this.logger.log(`Successfully retrieved metadata from IPFS: ${ipfsHash}`);
      
      return data;
    } catch (error) {
      this.logger.error(`Failed to get metadata from IPFS: ${ipfsHash}`, error);
      throw new Error(`IPFS retrieval failed: ${error.message}`);
    }
  }

  /**
   * Mock IPFS upload - generates deterministic hash from metadata
   * For development/testing purposes when Pinata credentials are not available
   */
  private mockUpload(metadata: any): string {
    try {
      const metadataString = JSON.stringify(metadata, null, 2);
      const hash = ethers.keccak256(ethers.toUtf8Bytes(metadataString));
      
      // Convert hash to IPFS-like CID format (base58btc)
      // Real IPFS CID starts with "Qm" (CIDv0) or "bafy" (CIDv1)
      const ipfsHash = 'Qm' + hash.slice(2, 46); // Take first 44 chars after 0x
      
      this.logger.log(`Mock IPFS upload: ${ipfsHash}`);
      this.logger.debug(`Metadata: ${metadataString}`);
      
      return ipfsHash;
    } catch (error) {
      this.logger.error('Failed to generate mock IPFS hash', error);
      throw error;
    }
  }

  /**
   * Mock IPFS file upload - generates deterministic hash from buffer
   */
  private mockUploadFile(buffer: Buffer, fileName: string): string {
    try {
      const hash = ethers.keccak256(buffer);
      const ipfsHash = 'Qm' + hash.slice(2, 46);
      
      this.logger.log(`Mock IPFS file upload: ${fileName} -> ${ipfsHash}`);
      this.logger.debug(`File size: ${buffer.length} bytes`);
      
      return ipfsHash;
    } catch (error) {
      this.logger.error('Failed to generate mock IPFS file hash', error);
      throw error;
    }
  }

  /**
   * Delete/unpin file from Pinata
   * @param ipfsHash - IPFS CID to unpin
   */
  async unpinFile(ipfsHash: string): Promise<void> {
    if (this.useMock) {
      this.logger.warn(`🧪 Mock mode: Cannot unpin ${ipfsHash}`);
      return;
    }

    try {
      const response = await fetch(`https://api.pinata.cloud/pinning/unpin/${ipfsHash}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${this.pinataJwt}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to unpin: ${response.statusText}`);
      }

      this.logger.log(`🗑️ Successfully unpinned: ${ipfsHash}`);
    } catch (error) {
      this.logger.error(`❌ Failed to unpin file from IPFS: ${ipfsHash}`, error);
      throw new Error(`IPFS unpin failed: ${error.message}`);
    }
  }

  /**
   * List all pinned files using Pinata API
   */
  async listPinnedFiles(options?: { pageLimit?: number; pageOffset?: number }): Promise<any> {
    if (this.useMock) {
      this.logger.warn('🧪 Mock mode: No files to list');
      return { rows: [], count: 0 };
    }

    try {
      const params = new URLSearchParams({
        pageLimit: (options?.pageLimit || 10).toString(),
        pageOffset: (options?.pageOffset || 0).toString(),
      });

      const response = await fetch(`https://api.pinata.cloud/data/pinList?${params}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.pinataJwt}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to list files: ${response.statusText}`);
      }

      const data = await response.json();
      this.logger.log(`📋 Retrieved ${data.count} pinned files`);
      
      return data;
    } catch (error) {
      this.logger.error('❌ Failed to list pinned files', error);
      throw new Error(`List files failed: ${error.message}`);
    }
  }
}

