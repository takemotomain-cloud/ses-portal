/**
 * Data Stack — RDS PostgreSQL + ElastiCache Redis
 *
 * RDS PostgreSQL 16:
 * - Multi-AZ（高可用性）
 * - 暗号化（AES-256, AWS KMS）
 * - 自動バックアップ（30日保持）
 * - PITR有効（5分間隔）
 * - SSL/TLS接続必須
 * - Isolatedサブネットに配置（インターネットからアクセス不可）
 *
 * ElastiCache Redis 7:
 * - セッション管理・キャッシュ用
 * - 暗号化（in-transit）
 *
 * セキュリティ:
 * - DB認証情報はSecrets Managerで管理
 * - 接続はアプリSGからのみ許可
 * - 削除保護（DeletionProtection）有効
 *
 * バックアップ方針（設計書準拠）:
 * - 自動バックアップ: 毎日、30日保持
 * - PITR: 5分間隔
 * - クロスリージョンバックアップ: 別途設定（手動orEventBridge）
 */

import * as cdk from 'aws-cdk-lib';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as elasticache from 'aws-cdk-lib/aws-elasticache';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

interface DataStackProps extends cdk.StackProps {
  vpc: ec2.Vpc;
  dbSecurityGroup: ec2.SecurityGroup;
  redisSecurityGroup: ec2.SecurityGroup;
}

export class DataStack extends cdk.Stack {
  public readonly dbInstance: rds.DatabaseInstance;
  public readonly redisCluster: elasticache.CfnCacheCluster;
  public readonly dbSecret: secretsmanager.ISecret;

  constructor(scope: Construct, id: string, props: DataStackProps) {
    super(scope, id, props);

    // DB認証情報をSecrets Managerで管理
    const dbCredentials = rds.Credentials.fromGeneratedSecret('ses_app', {
      secretName: 'ses-portal/rds-credentials',
    });

    // RDS PostgreSQL 16
    this.dbInstance = new rds.DatabaseInstance(this, 'SesPortalDb', {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_16,
      }),

      // インスタンスタイプ（初期はdb.t3.medium、負荷に応じてスケールアップ）
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T3,
        ec2.InstanceSize.MEDIUM,
      ),

      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      securityGroups: [props.dbSecurityGroup],

      // データベース設定
      databaseName: 'ses_portal',
      credentials: dbCredentials,
      port: 5432,

      // Multi-AZ（高可用性）
      multiAz: true,

      // ストレージ
      allocatedStorage: 50, // 50GB初期
      maxAllocatedStorage: 200, // オートスケーリング上限200GB
      storageType: rds.StorageType.GP3,
      storageEncrypted: true, // AES-256暗号化

      // バックアップ（設計書準拠）
      backupRetention: cdk.Duration.days(30), // 30日保持
      preferredBackupWindow: '18:00-19:00', // JST 03:00-04:00（低負荷時間帯）

      // メンテナンス
      preferredMaintenanceWindow: 'sun:19:00-sun:20:00', // JST 月曜04:00-05:00

      // 削除保護（本番で誤削除防止）
      deletionProtection: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN, // スタック削除してもDBは残す

      // パラメータ
      parameters: {
        'rds.force_ssl': '1', // SSL接続必須
        'log_statement': 'ddl', // DDL操作をログ
        'log_min_duration_statement': '1000', // 1秒以上のスロークエリをログ
      },

      // モニタリング
      enablePerformanceInsights: true,
      monitoringInterval: cdk.Duration.seconds(60),
    });

    this.dbSecret = this.dbInstance.secret!;

    // ElastiCache Redis 7
    const redisSubnetGroup = new elasticache.CfnSubnetGroup(this, 'RedisSubnetGroup', {
      description: 'SES Portal Redis subnet group',
      subnetIds: props.vpc.selectSubnets({
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      }).subnetIds,
    });

    this.redisCluster = new elasticache.CfnCacheCluster(this, 'SesPortalRedis', {
      engine: 'redis',
      engineVersion: '7.1',
      cacheNodeType: 'cache.t3.micro', // 初期は最小。負荷に応じてスケールアップ
      numCacheNodes: 1,
      vpcSecurityGroupIds: [props.redisSecurityGroup.securityGroupId],
      cacheSubnetGroupName: redisSubnetGroup.ref,

      // NOTE:
      // CfnCacheCluster では at-rest 暗号化を直接持てないため、
      // 将来は ReplicationGroup 化して強化する。
      transitEncryptionEnabled: true,
    });

    // Outputs
    new cdk.CfnOutput(this, 'DbEndpoint', {
      value: this.dbInstance.dbInstanceEndpointAddress,
    });
    new cdk.CfnOutput(this, 'DbSecretArn', {
      value: this.dbSecret.secretArn,
    });
    new cdk.CfnOutput(this, 'RedisEndpoint', {
      value: this.redisCluster.attrRedisEndpointAddress,
    });
  }
}
