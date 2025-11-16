import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { join } from 'path';

interface VerifyMfaCodeRequest {
  user_id: string;
  authenticator_code: string;
}

interface VerifyMfaCodeResponse {
  is_valid: boolean;
  reason: string;
  message: string;
  locked_until?: number;
}

@Injectable()
export class MfaService implements OnModuleInit {
  private readonly logger = new Logger(MfaService.name);
  private mfaClient: any;

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    this.initializeGrpcClient();
  }

  private initializeGrpcClient() {
    try {
      // Use process.cwd() to get project root, works in both dev and production
      const protoPath = join(process.cwd(), 'proto/mfa.proto');
      const packageDefinition = protoLoader.loadSync(protoPath, {
        keepCase: true,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true,
      });

      const mfaProto = grpc.loadPackageDefinition(packageDefinition) as any;
      const mfaServiceUrl = this.configService.get<string>('MFA_SERVICE_URL') || 'localhost:50051';

      this.mfaClient = new mfaProto.mfa.MfaService(
        mfaServiceUrl,
        grpc.credentials.createInsecure(),
      );

      this.logger.log(`MFA gRPC client initialized: ${mfaServiceUrl}`);
    } catch (error) {
      this.logger.error('Failed to initialize MFA gRPC client', error);
      throw error;
    }
  }

  /**
   * Verify MFA authenticator code for a user
   */
  async verifyMfaCode(
    userId: string,
    authenticatorCode: string,
  ): Promise<VerifyMfaCodeResponse> {
    return new Promise((resolve, reject) => {
      const request: VerifyMfaCodeRequest = {
        user_id: userId,
        authenticator_code: authenticatorCode,
      };

      this.mfaClient.VerifyMfaCode(request, (error: any, response: VerifyMfaCodeResponse) => {
        if (error) {
          this.logger.error(`MFA verification failed for user ${userId}`, error);
          reject(error);
        } else {
          this.logger.log(`MFA verification result for user ${userId}: ${response.is_valid}`);
          resolve(response);
        }
      });
    });
  }
}

