/**
 * Network Stack — VPC・サブネット・セキュリティグループ
 *
 * 構成:
 *   VPC (10.0.0.0/16)
 *   ├── Public Subnets (2 AZ) — ALB, NAT Gateway
 *   ├── Private Subnets (2 AZ) — ECS Fargate
 *   └── Isolated Subnets (2 AZ) — RDS, ElastiCache
 *
 * セキュリティ:
 * - DBはIsolatedサブネット（インターネット不可）
 * - アプリからDBへのアクセスのみ許可（SG制御）
 * - 全通信をSGでホワイトリスト方式
 */

import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

export class NetworkStack extends cdk.Stack {
  public readonly vpc: ec2.Vpc;
  public readonly dbSecurityGroup: ec2.SecurityGroup;
  public readonly redisSecurityGroup: ec2.SecurityGroup;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // VPC: 2 AZ, Public + Private + Isolated
    this.vpc = new ec2.Vpc(this, 'SesPortalVpc', {
      maxAzs: 2,
      natGateways: 1, // コスト最適化。本番は2に変更
      subnetConfiguration: [
        {
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24,
        },
        {
          name: 'Private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
          cidrMask: 24,
        },
        {
          name: 'Isolated',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
          cidrMask: 24,
        },
      ],
    });

    // Security Group: データベース（RDS）
    this.dbSecurityGroup = new ec2.SecurityGroup(this, 'DbSg', {
      vpc: this.vpc,
      description: 'RDS PostgreSQL',
      allowAllOutbound: false, // DBからのアウトバウンドは不要
    });

    // Security Group: Redis（ElastiCache）
    this.redisSecurityGroup = new ec2.SecurityGroup(this, 'RedisSg', {
      vpc: this.vpc,
      description: 'ElastiCache Redis',
      allowAllOutbound: false,
    });

    // Outputs
    new cdk.CfnOutput(this, 'VpcId', { value: this.vpc.vpcId });
  }
}
