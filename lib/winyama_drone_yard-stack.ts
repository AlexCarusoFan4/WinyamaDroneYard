import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as batch from '@aws-cdk/aws-batch-alpha';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3n from 'aws-cdk-lib/aws-s3-notifications'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as s3Deploy from 'aws-cdk-lib/aws-s3-deployment';
import { DockerImageAsset } from 'aws-cdk-lib/aws-ecr-assets';

const fs = require('fs');
const path = require('path');
const awsConfig = require('../awsconfig.json');

// eslint-disable-next-line no-underscore-dangle
const directory = path.resolve();

export class WinyamaDroneYardStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const vpc = new ec2.Vpc(this, 'VPC', {
      natGateways: 0,
      subnetConfiguration: [
        {
          name: 'Public',
          cidrMask: 24,
          subnetType: ec2.SubnetType.PUBLIC
        }
      ]
    });

    const userData = fs.readFileSync('./userdata.sh', 'base64').toString();

    const launchTemplate = new ec2.CfnLaunchTemplate(this, 'DroneYardLaunchTemplate', {

      launchTemplateName: `DroneYardLaunchTemplate`,
      launchTemplateData: {
        userData,
        blockDeviceMappings: [
          {
            deviceName: '/dev/xvda',
            ebs : {
              volumeSize: 250,
              volumeType: 'gp2'
            }
          }
        ]
      },
    });

    const dockerRole = new iam.Role(this, 'instance-role', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      description: 'Execution role for the docker container, has access to the DroneYard S3 bucket',
      managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonEC2ContainerServiceforEC2Role')]
    });

    const instanceProfile = new iam.CfnInstanceProfile(this, 'instance-profile', {
      instanceProfileName: `DroneYard-instance-profile`,
      roles: [dockerRole.roleName],
    });

    const awsManagedEnvironment = new batch.ComputeEnvironment(this, 'DroneYardComputeEnvironment', {
      computeResources: {
        type: batch.ComputeResourceType.SPOT,
        bidPercentage: awsConfig.computeEnv.bidPercentage,
        minvCpus: awsConfig.computeEnv.minvCpus,
        maxvCpus: awsConfig.computeEnv.maxvCpus,
        instanceTypes: awsConfig.computeEnv.instanceTypes,
        instanceRole: instanceProfile.attrArn,
        vpc,
        launchTemplate: {
          launchTemplateName: launchTemplate.launchTemplateName,
        },
      }
  });

    const jobQueue = new batch.JobQueue(this, 'DroneYardJobQueue', {
      computeEnvironments: [
        {
          computeEnvironment: awsManagedEnvironment,
          order: 1
        }
      ]
    });

    const dockerImage = new DockerImageAsset(this, 'DroneYardDockerImage', {
      directory: path.join(directory, awsConfig.computeEnv.useGpu ? 'dockergpu' : 'docker'),
    });

    const logging = new ecs.AwsLogDriver({ streamPrefix: "droneyardruns" })

    const jobDefinition = new batch.JobDefinition(this, 'DroneYardJobDefinition', {
      container: {
        command: [
          'sh',
          '-c',
          '/entry.sh',
          'Ref::bucket',
          'Ref::key',
          'output',
        ],
        gpuCount: awsConfig.computeEnv.useGpu ? 1 : 0,
        image: ecs.ContainerImage.fromDockerImageAsset(dockerImage),
        logConfiguration: {
          logDriver: batch.LogDriver.AWSLOGS,
        },
        // TODO: Probably could set this dynamically or make it a part of the config
        memoryLimitMiB: 120000,
        mountPoints: [{
          containerPath: '/local',
          readOnly: false,
          sourceVolume: 'local',
        }],
        privileged: true,
        vcpus: 0,
        volumes: [{
          name: 'local',
          host: {
            sourcePath: '/local',
          },
        }],
      },
      // TODO: Make this configurable
      timeout: cdk.Duration.hours(24),
    });

    const lambdaRole = new iam.Role(this, 'lambda-role', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com')
    })

    lambdaRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaBasicExecutionRole"));
    lambdaRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonS3FullAccess"));
    lambdaRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName("AWSBatchFullAccess"));

    const lambdaFunction = new lambda.Function(this, 'DispatchHandler', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('functions/dispatch-handler'),
      role: lambdaRole,
      environment: {
        JOB_DEFINITION: jobDefinition.jobDefinitionName,
        JOB_QUEUE: jobQueue.jobQueueName
      }
    })

    const dronePhotosBucket = new s3.Bucket(this, 'DronePhotos', {
      
    });

    dronePhotosBucket.addEventNotification(s3.EventType.OBJECT_CREATED, new s3n.LambdaDestination(lambdaFunction), {suffix: 'dispatch'});
    dronePhotosBucket.grantReadWrite(dockerRole);

    new s3Deploy.BucketDeployment(this, 'settings yaml', {
      sources: [s3Deploy.Source.asset(directory, { exclude: ['**', '.*', '!settings.yaml'] })],
      destinationBucket: dronePhotosBucket
    });
  }
}
