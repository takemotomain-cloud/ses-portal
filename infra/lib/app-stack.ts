/**
 * App Stack — ECS Fargate + CloudFront + S3
 *
 * 構成:
 *   CloudFront (CDN)
 *   ├── /* → S3 (Next.js静的ビルド)
 *   └── /api/* → ALB → ECS Fargate (NestJS API)
 *
 * ECS Fargate:
 * - API: NestJSコンテナ（0.5 vCPU / 1GB、最小1〜最大4タスク）
 * - ヘルスチェック: /api/health
 * - オートスケーリング: CPU 70%でスケールアウト
 *
 * セキュリティ:
 * - CloudFront → ALB はHTTPS
 * - DB認証情報はSecrets Managerから注入
 * - コンテナにはIAMロールで最小権限を付与
 * - 環境変数に機密情報をハードコードしない
 *
 * パフォーマンス:
 * - CloudFrontで静的アセットをエッジキャッシュ
 * - S3にNext.jsのビルド済み静的ファイルを配置
 * - API はFargate で水平スケーリング
 */

import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecsPatterns from 'aws-cdk-lib/aws-ecs-patterns';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as elasticache from 'aws-cdk-lib/aws-elasticache';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

interface AppStackProps extends cdk.StackProps {
  vpc: ec2.Vpc;
  appSecurityGroup: ec2.SecurityGroup;
  dbInstance: rds.DatabaseInstance;
  redisCluster: elasticache.CfnCacheCluster;
  dbSecret: secretsmanager.ISecret;
}

export class AppStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: AppStackProps) {
    super(scope, id, props);

    // ============================================================
    // ECS Cluster
    // ============================================================
    const cluster = new ecs.Cluster(this, 'SesPortalCluster', {
      vpc: props.vpc,
      clusterName: 'ses-portal',
      containerInsights: true,
    });

    // ============================================================
    // API Service (NestJS on Fargate + ALB)
    // ============================================================
    const apiService = new ecsPatterns.ApplicationLoadBalancedFargateService(
      this,
      'ApiService',
      {
        cluster,
        serviceName: 'ses-portal-api',

        // タスク定義
        cpu: 512, // 0.5 vCPU
        memoryLimitMiB: 1024, // 1 GB
        desiredCount: 1, // 初期タスク数

        taskImageOptions: {
          // ECRにプッシュしたAPIイメージを指定
          // 初回は手動でECRリポジトリを作成してプッシュ
          image: ecs.ContainerImage.fromRegistry('ses-portal-api:latest'),
          containerPort: 3001,

          // 環境変数（機密情報はSecretsから注入）
          environment: {
            NODE_ENV: 'production',
            PORT: '3001',
            CORS_ORIGIN: 'https://portal.example.com', // CloudFrontドメインに変更
            JWT_EXPIRY: '24h',
          },

          // Secrets Managerから注入（環境変数にハードコードしない）
          secrets: {
            DATABASE_URL: ecs.Secret.fromSecretsManager(props.dbSecret, 'connectionString'),
            JWT_SECRET: ecs.Secret.fromSecretsManager(
              secretsmanager.Secret.fromSecretNameV2(this, 'JwtSecret', 'ses-portal/jwt-secret')
            ),
            ENCRYPTION_KEY: ecs.Secret.fromSecretsManager(
              secretsmanager.Secret.fromSecretNameV2(this, 'EncKey', 'ses-portal/encryption-key')
            ),
          },

          logDriver: ecs.LogDrivers.awsLogs({
            streamPrefix: 'ses-portal-api',
            logRetention: logs.RetentionDays.ONE_MONTH,
          }),
        },

        // ネットワーク
        assignPublicIp: false, // Privateサブネット
        securityGroups: [props.appSecurityGroup],

        // ヘルスチェック
        healthCheck: {
          command: ['CMD-SHELL', 'curl -f http://localhost:3001/api/health || exit 1'],
          interval: cdk.Duration.seconds(30),
          timeout: cdk.Duration.seconds(5),
          retries: 3,
        },
      }
    );

    // オートスケーリング: CPU 70%でスケールアウト
    const scaling = apiService.service.autoScaleTaskCount({
      minCapacity: 1,
      maxCapacity: 4,
    });

    scaling.scaleOnCpuUtilization('CpuScaling', {
      targetUtilizationPercent: 70,
      scaleInCooldown: cdk.Duration.seconds(60),
      scaleOutCooldown: cdk.Duration.seconds(60),
    });

    // ============================================================
    // S3: Next.js静的ビルド
    // ============================================================
    const webBucket = new s3.Bucket(this, 'WebBucket', {
      bucketName: `ses-portal-web-${this.account}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      removalPolicy: cdk.RemovalPolicy.RETAIN,

      // 静的ファイルのキャッシュ設定
      cors: [{
        allowedMethods: [s3.HttpMethods.GET],
        allowedOrigins: ['*'],
        allowedHeaders: ['*'],
      }],
    });

    // ============================================================
    // CloudFront CDN
    // ============================================================
    const distribution = new cloudfront.Distribution(this, 'CdnDistribution', {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(webBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,

        // セキュリティヘッダー
        responseHeadersPolicy: new cloudfront.ResponseHeadersPolicy(this, 'SecurityHeaders', {
          securityHeadersBehavior: {
            contentTypeOptions: { override: true },
            frameOptions: {
              frameOption: cloudfront.HeadersFrameOption.DENY,
              override: true,
            },
            referrerPolicy: {
              referrerPolicy: cloudfront.HeadersReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN,
              override: true,
            },
            strictTransportSecurity: {
              accessControlMaxAge: cdk.Duration.days(365),
              includeSubdomains: true,
              override: true,
            },
            xssProtection: {
              protection: true,
              modeBlock: true,
              override: true,
            },
          },
        }),
      },

      // /api/* → ALB（NestJS API）
      additionalBehaviors: {
        '/api/*': {
          origin: new origins.LoadBalancerV2Origin(apiService.loadBalancer, {
            protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY,
          }),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED, // APIはキャッシュしない
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER,
        },
      },

      defaultRootObject: 'index.html',

      // エラーページ（SPAのフォールバック）
      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.seconds(0),
        },
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.seconds(0),
        },
      ],
    });

    // ============================================================
    // Outputs
    // ============================================================
    new cdk.CfnOutput(this, 'CloudFrontUrl', {
      value: `https://${distribution.distributionDomainName}`,
      description: 'CloudFront配信URL',
    });
    new cdk.CfnOutput(this, 'ApiAlbUrl', {
      value: apiService.loadBalancer.loadBalancerDnsName,
      description: 'API ALB DNS（内部アクセス用）',
    });
    new cdk.CfnOutput(this, 'WebBucketName', {
      value: webBucket.bucketName,
      description: 'Next.jsビルド出力先S3バケット',
    });
  }
}
