#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { WinyamaDroneYardStack } from '../lib/winyama_drone_yard-stack';

const app = new cdk.App();
new WinyamaDroneYardStack(app, 'WinyamaDroneYardStack', {
});