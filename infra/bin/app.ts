#!/usr/bin/env node
/**
 * CDK App エントリーポイント
 *
 * 3つのスタックに分離:
 * 1. NetworkStack: VPC、サブネット、セキュリティグループ
 * 2. DataStack: RDS PostgreSQL、ElastiCache Redis
 * 3. AppStack: ECS Fargate（API + Web）、CloudFront、S3、SES
 *
 * なぜ分離: データ層とアプリ層のライフサイクルが異なるため。
 * DBを壊さずにアプリだけ再デプロイできるようにする。
 */

import * as cdk from 'aws-cdk-lib';
import { NetworkStack } from '../lib/network-stack';
import { DataStack } from '../lib/data-stack';
import { AppStack } from '../lib/app-stack';

const app = new cdk.App();

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: 'ap-northeast-1', // 東京リージョン
};

// 1. ネットワーク基盤
const network = new NetworkStack(app, 'SesPortalNetwork', { env });

// 2. データ層（RDS + Redis）
const data = new DataStack(app, 'SesPortalData', {
  env,
  vpc: network.vpc,
  dbSecurityGroup: network.dbSecurityGroup,
  redisSecurityGroup: network.redisSecurityGroup,
});

// 3. アプリケーション層（ECS + CloudFront）
new AppStack(app, 'SesPortalApp', {
  env,
  vpc: network.vpc,
  dbInstance: data.dbInstance,
  dbSecurityGroup: network.dbSecurityGroup,
  redisCluster: data.redisCluster,
  redisSecurityGroup: network.redisSecurityGroup,
  dbSecret: data.dbSecret,
});

app.synth();
