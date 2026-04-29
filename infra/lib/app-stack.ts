/**
 * App Stack — ECS Fargate + CloudFront
 *
 * 構成:
 *   CloudFront (CDN)
 *   ├── /* → ALB → ECS Fargate (Next.js Web)
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
 * - CloudFrontでWeb/APIの入口を一本化
 * - Next.js Web / NestJS API をそれぞれ Fargate で水平スケーリング
 */

import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecsPatterns from 'aws-cdk-lib/aws-ecs-patterns';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as elasticache from 'aws-cdk-lib/aws-elasticache';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

interface AppStackProps extends cdk.StackProps {
  vpc: ec2.Vpc;
  dbInstance: rds.DatabaseInstance;
  dbSecurityGroup: ec2.SecurityGroup;
  redisCluster: elasticache.CfnCacheCluster;
  redisSecurityGroup: ec2.SecurityGroup;
  dbSecret: secretsmanager.ISecret;
}

export class AppStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: AppStackProps) {
    super(scope, id, props);

    const portalUrl = 'https://portal.example.com';

    // ============================================================
    // ECS Cluster
    // ============================================================
    const cluster = new ecs.Cluster(this, 'SesPortalCluster', {
      vpc: props.vpc,
      clusterName: 'ses-portal',
    });

    const serviceSecurityGroup = new ec2.SecurityGroup(this, 'ServiceSg', {
      vpc: props.vpc,
      description: 'ECS services for SES Portal',
      allowAllOutbound: true,
    });

    new ec2.CfnSecurityGroupIngress(this, 'DbFromServiceIngress', {
      groupId: props.dbSecurityGroup.securityGroupId,
      ipProtocol: 'tcp',
      fromPort: 5432,
      toPort: 5432,
      sourceSecurityGroupId: serviceSecurityGroup.securityGroupId,
      description: 'Allow PostgreSQL from ECS services',
    });
    new ec2.CfnSecurityGroupIngress(this, 'RedisFromServiceIngress', {
      groupId: props.redisSecurityGroup.securityGroupId,
      ipProtocol: 'tcp',
      fromPort: 6379,
      toPort: 6379,
      sourceSecurityGroupId: serviceSecurityGroup.securityGroupId,
      description: 'Allow Redis from ECS services',
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
        minHealthyPercent: 100,

        taskImageOptions: {
          // ECRにプッシュしたAPIイメージを指定
          // 初回は手動でECRリポジトリを作成してプッシュ
          image: ecs.ContainerImage.fromRegistry('ses-portal-api:latest'),
          containerPort: 3001,

          // 環境変数（機密情報はSecretsから注入）
          environment: {
            NODE_ENV: 'production',
            PORT: '3001',
            CORS_ORIGIN: portalUrl,
            APP_BASE_URL: portalUrl,
            JWT_EXPIRY: '24h',
            FREEE_SYNC_MODE: 'disabled',
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
        securityGroups: [serviceSecurityGroup],

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
    // Web Service (Next.js on Fargate + ALB)
    // ============================================================
    const webService = new ecsPatterns.ApplicationLoadBalancedFargateService(
      this,
      'WebService',
      {
        cluster,
        serviceName: 'ses-portal-web',
        cpu: 512,
        memoryLimitMiB: 1024,
        desiredCount: 1,
        minHealthyPercent: 100,
        taskImageOptions: {
          image: ecs.ContainerImage.fromRegistry('ses-portal-web:latest'),
          containerPort: 3000,
          environment: {
            NODE_ENV: 'production',
            PORT: '3000',
            NEXT_PUBLIC_API_URL: `http://${apiService.loadBalancer.loadBalancerDnsName}`,
            NEXTAUTH_URL: portalUrl,
          },
          logDriver: ecs.LogDrivers.awsLogs({
            streamPrefix: 'ses-portal-web',
            logRetention: logs.RetentionDays.ONE_MONTH,
          }),
        },
        assignPublicIp: false,
        securityGroups: [serviceSecurityGroup],
        healthCheck: {
          command: ['CMD-SHELL', 'wget --no-verbose --tries=1 --spider http://localhost:3000/login || exit 1'],
          interval: cdk.Duration.seconds(30),
          timeout: cdk.Duration.seconds(5),
          retries: 3,
        },
      },
    );

    // ============================================================
    // CloudFront CDN
    // ============================================================
    const distribution = new cloudfront.Distribution(this, 'CdnDistribution', {
      defaultBehavior: {
        origin: new origins.LoadBalancerV2Origin(webService.loadBalancer, {
          protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY,
        }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER,

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
        '/_next/static/*': {
          origin: new origins.LoadBalancerV2Origin(webService.loadBalancer, {
            protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY,
          }),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        },
      },
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
    new cdk.CfnOutput(this, 'WebAlbUrl', {
      value: webService.loadBalancer.loadBalancerDnsName,
      description: 'Web ALB DNS（内部アクセス用）',
    });
  }
}
