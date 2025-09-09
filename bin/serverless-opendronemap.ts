#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { ServerlessOdmStack } from '../lib/ServerlessOdmStack';

const app = new cdk.App();
new ServerlessOdmStack(app, 'ServerlessOdmStack', {
});